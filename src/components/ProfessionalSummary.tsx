"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import { Appointment, Professional } from "@/types";
import { addDays, dayOfWeek, todayStr } from "@/lib/dates";

type Mode = "day" | "week" | "month";

const MONTHS = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"];
const DAYS = ["Dg", "Dl", "Dt", "Dc", "Dj", "Dv", "Ds"];
const MONEY_KEY = "diana_show_money";

const money = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
const hours = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};
const de = (month: string) => (["abril", "agost", "octubre"].includes(month) ? "d'" : "de ");

function getRange(mode: Mode, anchor: string): { start: string; end: string; label: string } {
  const [y, m, d] = anchor.split("-").map(Number);
  if (mode === "day") {
    return { start: anchor, end: anchor, label: `${DAYS[dayOfWeek(anchor)]} ${d} ${de(MONTHS[m - 1])}${MONTHS[m - 1]}` };
  }
  if (mode === "week") {
    const dow = dayOfWeek(anchor);
    const start = addDays(anchor, dow === 0 ? -6 : 1 - dow);
    const end = addDays(start, 6);
    const [, m1, d1] = start.split("-").map(Number);
    const [, m2, d2] = end.split("-").map(Number);
    const label = m1 === m2
      ? `${d1} – ${d2} ${de(MONTHS[m2 - 1])}${MONTHS[m2 - 1]}`
      : `${d1} ${de(MONTHS[m1 - 1])}${MONTHS[m1 - 1]} – ${d2} ${de(MONTHS[m2 - 1])}${MONTHS[m2 - 1]}`;
    return { start, end, label };
  }
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const monthName = MONTHS[m - 1];
  return { start, end, label: `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${y}` };
}

function shiftAnchor(mode: Mode, anchor: string, dir: 1 | -1): string {
  if (mode === "day") return addDays(anchor, dir);
  if (mode === "week") return addDays(anchor, 7 * dir);
  const [y, m] = anchor.split("-").map(Number);
  const nm = new Date(Date.UTC(y, m - 1 + dir, 1));
  return nm.toISOString().slice(0, 10);
}

interface ProStats {
  id: number;
  name: string;
  color: string;
  count: number;
  pending: number;
  cancelled: number;
  minutes: number;
  revenue: number;
  services: { name: string; count: number }[];
}

export function ProfessionalSummary({ professionals, canSeeMoney = true }: { professionals: Professional[]; canSeeMoney?: boolean }) {
  const [mode, setMode] = useState<Mode>("week");
  const [anchor, setAnchor] = useState<string>(() => todayStr());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [moneyToggle, setShowMoney] = useState(false);
  // L'equip (contrasenya d'empleada) mai veu els imports
  const showMoney = canSeeMoney && moneyToggle;

  // Recordem en aquest navegador si es volen veure els imports (per defecte, ocults)
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowMoney(localStorage.getItem(MONEY_KEY) === "1");
    } catch {
      // sense localStorage: es queden ocults
    }
  }, []);

  const toggleMoney = () => {
    setShowMoney((prev) => {
      try {
        localStorage.setItem(MONEY_KEY, prev ? "0" : "1");
      } catch {
        // ignorem
      }
      return !prev;
    });
  };

  const range = useMemo(() => getRange(mode, anchor), [mode, anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments?startDate=${range.start}&endDate=${range.end}`);
      const data = await res.json();
      setAppointments(data.success ? data.data : []);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const stats: ProStats[] = useMemo(() => {
    const map = new Map<number, ProStats>();
    for (const p of professionals) {
      map.set(p.id, { id: p.id, name: p.name, color: p.color, count: 0, pending: 0, cancelled: 0, minutes: 0, revenue: 0, services: [] });
    }
    const svcCounts = new Map<number, Map<string, number>>();
    for (const a of appointments) {
      let s = map.get(a.professionalId);
      if (!s) {
        s = { id: a.professionalId, name: a.professionalName || "Sense professional", color: a.professionalColor || "#a8a29e", count: 0, pending: 0, cancelled: 0, minutes: 0, revenue: 0, services: [] };
        map.set(a.professionalId, s);
      }
      if (a.status === "cancel·lada") { s.cancelled++; continue; }
      if (a.status === "pendent") { s.pending++; continue; }
      s.count++;
      s.minutes += a.durationMinutes;
      s.revenue += parseFloat(a.price) || 0;
      const sc = svcCounts.get(s.id) ?? new Map<string, number>();
      const name = a.serviceName || "Servei";
      sc.set(name, (sc.get(name) ?? 0) + 1);
      svcCounts.set(s.id, sc);
    }
    for (const s of map.values()) {
      s.services = [...(svcCounts.get(s.id) ?? new Map()).entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [appointments, professionals]);

  const totals = stats.reduce(
    (t, s) => ({ count: t.count + s.count, minutes: t.minutes + s.minutes, revenue: t.revenue + s.revenue, pending: t.pending + s.pending }),
    { count: 0, minutes: 0, revenue: 0, pending: 0 }
  );
  const maxCount = Math.max(1, ...stats.map((s) => s.count));

  // Desglossament: per dies (setmana) o per setmanes (mes)
  const breakdown = useMemo(() => {
    if (mode === "day") return [];
    const buckets: { key: string; label: string; start: string; end: string }[] = [];
    if (mode === "week") {
      for (let i = 0; i < 7; i++) {
        const d = addDays(range.start, i);
        buckets.push({ key: d, label: `${DAYS[dayOfWeek(d)]} ${Number(d.slice(8))}`, start: d, end: d });
      }
    } else {
      let cur = range.start;
      while (cur <= range.end) {
        const dow = dayOfWeek(cur);
        const sunday = addDays(cur, dow === 0 ? 0 : 7 - dow);
        const end = sunday > range.end ? range.end : sunday;
        buckets.push({ key: cur, label: `${Number(cur.slice(8))}–${Number(end.slice(8))}`, start: cur, end });
        cur = addDays(end, 1);
      }
    }
    return buckets.map((b) => {
      const inBucket = appointments.filter(
        (a) => a.date >= b.start && a.date <= b.end && a.status !== "cancel·lada" && a.status !== "pendent"
      );
      const perPro = new Map<number, { count: number; revenue: number }>();
      for (const a of inBucket) {
        const v = perPro.get(a.professionalId) ?? { count: 0, revenue: 0 };
        v.count++;
        v.revenue += parseFloat(a.price) || 0;
        perPro.set(a.professionalId, v);
      }
      return { ...b, perPro, total: inBucket.length, revenue: inBucket.reduce((s, a) => s + (parseFloat(a.price) || 0), 0) };
    });
  }, [mode, range.start, range.end, appointments]);

  const visiblePros = stats.filter((s) => s.count > 0 || professionals.some((p) => p.id === s.id));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-terra-600" />
          <h2 className="text-base font-bold text-stone-900">Resum per professional</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-stone-100 rounded-xl p-1 border border-stone-200 text-xs font-bold">
            {(["day", "week", "month"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg ${mode === m ? "bg-white text-terra-700 shadow-xs" : "text-stone-600 hover:text-stone-900"}`}
              >
                {m === "day" ? "Dia" : m === "week" ? "Setmana" : "Mes"}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-stone-50 rounded-xl border border-stone-200 p-1">
            <button onClick={() => setAnchor(shiftAnchor(mode, anchor, -1))} className="p-1.5 rounded-lg hover:bg-white text-stone-700" title="Anterior">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-sm font-bold text-stone-900 whitespace-nowrap min-w-[150px] text-center">{range.label}</span>
            <button onClick={() => setAnchor(shiftAnchor(mode, anchor, 1))} className="p-1.5 rounded-lg hover:bg-white text-stone-700" title="Següent">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setAnchor(todayStr())}
            className="px-3 py-1.5 text-xs font-bold text-terra-700 bg-terra-50 hover:bg-terra-100 rounded-lg border border-terra-200"
          >
            Avui
          </button>

          {canSeeMoney && <button
            onClick={toggleMoney}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border ${
              showMoney ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
            }`}
            title={showMoney ? "Amagar imports" : "Mostrar imports"}
          >
            {showMoney ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showMoney ? "Amagar imports" : "Mostrar imports"}
          </button>}
        </div>
      </div>

      {/* Totals */}
      <p className="text-xs text-stone-500 px-1">
        <span className="font-semibold text-stone-800">{totals.count}</span> cites fetes o confirmades · {hours(totals.minutes)} de feina
        {totals.pending > 0 && <> · {totals.pending} {totals.pending === 1 ? "pendent" : "pendents"}</>}
        {showMoney && <> · <span className="font-semibold text-stone-800">{money(totals.revenue)}</span></>}
      </p>

      {/* Targetes per professional */}
      {loading ? (
        <div className="py-12 text-center text-xs text-stone-500">Carregant…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiblePros.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                <h3 className="font-bold text-sm text-stone-900">{s.name}</h3>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-stone-900 leading-none">{s.count}</p>
                  <p className="text-[11px] text-stone-500 mt-1">{s.count === 1 ? "cita" : "cites"} · {hours(s.minutes)}</p>
                </div>
                {showMoney && (
                  <div className="text-right">
                    <p className="text-lg font-bold text-stone-900 leading-none">{money(s.revenue)}</p>
                    <p className="text-[11px] text-stone-500 mt-1">generat</p>
                  </div>
                )}
              </div>

              <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(s.count / maxCount) * 100}%`, backgroundColor: s.color }} />
              </div>

              {s.services.length > 0 && (
                <ul className="text-[11px] text-stone-600 space-y-0.5">
                  {s.services.slice(0, 3).map((sv) => (
                    <li key={sv.name} className="flex justify-between gap-2">
                      <span className="truncate">{sv.name}</span>
                      <span className="text-stone-400 shrink-0">{sv.count}</span>
                    </li>
                  ))}
                </ul>
              )}

              {(s.pending > 0 || s.cancelled > 0) && (
                <p className="text-[11px] text-stone-400">
                  {s.pending > 0 && `${s.pending} ${s.pending === 1 ? "pendent" : "pendents"}`}
                  {s.pending > 0 && s.cancelled > 0 && " · "}
                  {s.cancelled > 0 && `${s.cancelled} ${s.cancelled === 1 ? "cancel·lada" : "cancel·lades"}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Desglossament */}
      {!loading && breakdown.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-stone-500 border-b border-stone-100">
                <th className="text-left font-semibold px-4 py-2">{mode === "week" ? "Dia" : "Setmana"}</th>
                {visiblePros.map((s) => (
                  <th key={s.id} className="text-right font-semibold px-3 py-2 whitespace-nowrap">{s.name.split(" ")[0]}</th>
                ))}
                <th className="text-right font-semibold px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((b) => (
                <tr key={b.key} className="border-b border-stone-50 last:border-0">
                  <td className="px-4 py-2 font-medium text-stone-700 whitespace-nowrap">{b.label}</td>
                  {visiblePros.map((s) => {
                    const v = b.perPro.get(s.id);
                    return (
                      <td key={s.id} className="px-3 py-2 text-right tabular-nums text-stone-700">
                        {v ? v.count : <span className="text-stone-300">–</span>}
                        {showMoney && v && <div className="text-[10px] text-stone-400">{money(v.revenue)}</div>}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-stone-900">
                    {b.total || <span className="text-stone-300">–</span>}
                    {showMoney && b.total > 0 && <div className="text-[10px] font-normal text-stone-400">{money(b.revenue)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
