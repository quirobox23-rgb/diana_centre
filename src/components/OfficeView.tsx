"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Room, Professional, Appointment, Schedule } from "@/types";
import { colorForService } from "@/lib/treatment-colors";
import { todayStr, nowTimeStr, dayOfWeek } from "@/lib/dates";
import { MessageCircle, Clock, RotateCcw, Sparkles } from "lucide-react";
import { Office3D, OfficeSceneData, SceneCabin, Look } from "@/components/Office3D";

// Oficina: el centre en 3D (una sola planta) i al costat el resum del que passa.
// Les 3 cabines seguides, el passadís, la recepció on seu l'Aura (l'agent de WhatsApp) i el jardí de relax.

interface PendingRequest {
  id: number;
  clientName: string;
  serviceName?: string | null;
}

interface OfficeViewProps {
  rooms: Room[];
  professionals: Professional[];
  schedules: Schedule[];
  onOpenPending: () => void;
  onEditAppointment: (apt: Appointment) => void;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const firstName = (s?: string | null) => (s || "").trim().split(/\s+/)[0] || "";
const norm = (s?: string | null) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function lookOf(name?: string | null): Look {
  const n = norm(name);
  if (/^diana\b/.test(n)) return "diana";
  if (/^montsan/.test(n)) return "montsant";
  return "other";
}

export function OfficeView({ rooms, professionals, schedules, onOpenPending, onEditAppointment }: OfficeViewProps) {
  const today = todayStr();
  const [apts, setApts] = useState<Appointment[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [nowMin, setNowMin] = useState(() => toMin(nowTimeStr()));
  const [pickedMin, setPickedMin] = useState<number | null>(null); // null = en directe
  const viewMin = pickedMin ?? nowMin;
  const live = pickedMin === null;

  const load = useCallback(async () => {
    try {
      const [ra, rp] = await Promise.all([
        fetch(`/api/appointments?startDate=${today}&endDate=${today}`, { cache: "no-store" }),
        fetch("/api/bot/pending", { cache: "no-store" }),
      ]);
      const [da, dp] = await Promise.all([ra.json(), rp.json()]);
      if (da.success) setApts(da.data);
      if (dp.success) setPending(dp.pending);
    } catch {
      // silenciós: es torna a provar al cap d'un minut
    }
  }, [today]);

  useEffect(() => {
    load();
    const i = setInterval(() => {
      setNowMin(toMin(nowTimeStr()));
      load();
    }, 60000);
    return () => clearInterval(i);
  }, [load]);

  const sched = schedules.find((s) => s.dayOfWeek === dayOfWeek(today));
  const open = sched?.isOpen ?? false;
  const dayStart = toMin(sched?.morningStart || "09:00");
  const dayEnd = toMin(sched?.afternoonEnd || sched?.morningEnd || "20:00");

  const sortedRooms = useMemo(
    () => [...rooms].filter((r) => r.isActive).sort((a, b) => a.name.localeCompare(b.name, "ca", { numeric: true })),
    [rooms]
  );
  const activeApts = useMemo(() => apts.filter((a) => a.date === today && a.status !== "cancel·lada"), [apts, today]);
  const byStart = (a: Appointment, b: Appointment) => toMin(a.startTime) - toMin(b.startTime);

  const inRoom = (roomId: number) =>
    activeApts.find((a) => a.roomId === roomId && toMin(a.startTime) <= viewMin && viewMin < toMin(a.endTime)) || null;
  const nextInRoom = (roomId: number) => activeApts.filter((a) => a.roomId === roomId && toMin(a.startTime) > viewMin).sort(byStart)[0] || null;
  const nextForPro = (proId: number) => activeApts.filter((a) => a.professionalId === proId && toMin(a.startTime) > viewMin).sort(byStart)[0] || null;

  const cabins = sortedRooms.map((room) => {
    const apt = inRoom(room.id);
    const [title, subtitle] = room.name.split("·").map((s) => s.trim());
    return {
      room,
      apt,
      next: nextInRoom(room.id),
      title,
      subtitle,
      color: apt ? apt.serviceColor || colorForService(apt.serviceName || "", apt.serviceCategory) : undefined,
    };
  });
  const busyProIds = new Set(cabins.map((c) => c.apt?.professionalId).filter(Boolean) as number[]);
  const freePros = professionals.filter((p) => p.isActive && !busyProIds.has(p.id));
  const waiting = activeApts.filter((a) => toMin(a.startTime) > viewMin && toMin(a.startTime) - viewMin <= 20).sort(byStart);

  const sceneData: OfficeSceneData = {
    cabins: cabins.map<SceneCabin>((c) => ({
      roomId: c.room.id,
      title: c.title,
      subtitle: c.subtitle,
      occupied: !!c.apt,
      pending: c.apt?.status === "pendent",
      clientName: firstName(c.apt?.clientName),
      treatment: c.apt?.serviceName || undefined,
      color: c.color,
      proName: firstName(c.apt?.professionalName),
      proLook: lookOf(c.apt?.professionalName),
      aptId: c.apt?.id,
    })),
    freePros: freePros.map((p) => {
      const nx = nextForPro(p.id);
      return { key: String(p.id), name: firstName(p.name), detail: nx ? `lliure fins a les ${nx.startTime}` : "lliure", look: lookOf(p.name) };
    }),
    waiting: waiting.map((a) => ({ key: String(a.id), name: firstName(a.clientName), detail: a.startTime, look: "client" as Look })),
    pendingCount: pending.length,
  };

  const openCabin = (cab: SceneCabin) => {
    const apt = activeApts.find((a) => a.id === cab.aptId);
    if (apt) onEditAppointment(apt);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900">Oficina</h2>
          <p className="text-xs text-stone-500">El centre en una sola planta: les 3 cabines, la recepció de l&apos;Aura i el jardí on descansen quan no treballen.</p>
        </div>
        <div className="flex items-center gap-3 bg-white border border-terra-100 rounded-2xl px-3 py-2 shadow-xs">
          <Clock className="w-4 h-4 text-terra-600 shrink-0" />
          <span className="text-sm font-bold tabular-nums text-stone-900 w-11">{toTime(viewMin)}</span>
          <input
            type="range"
            min={Math.min(dayStart, nowMin)}
            max={Math.max(dayEnd, nowMin)}
            step={5}
            value={viewMin}
            onChange={(e) => setPickedMin(Number(e.target.value))}
            className="w-32 sm:w-48 accent-terra-600"
            aria-label="Hora a mostrar"
          />
          {live ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> ARA
            </span>
          ) : (
            <button onClick={() => setPickedMin(null)} className="inline-flex items-center gap-1 text-[11px] font-bold text-terra-700 hover:underline">
              <RotateCcw className="w-3 h-3" /> Ara
            </button>
          )}
        </div>
      </div>

      {!open && <p className="text-xs font-semibold text-stone-500 bg-white border border-stone-200 rounded-xl px-3 py-2">Avui el centre és tancat.</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <Office3D data={sceneData} onCabinClick={openCabin} onAuraClick={onOpenPending} />

        <aside className="space-y-3">
          {/* Aura */}
          <div className="bg-white border border-terra-100 rounded-2xl p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-extrabold text-stone-900">Aura</div>
                  <div className="text-[10px] text-stone-500">Recepció · agent de WhatsApp</div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">En proves fins al gener</span>
            </div>
            <div className="mt-2.5 text-xs text-stone-700">
              {pending.length === 0 ? (
                <p>Tot al dia ✨ Cap sol·licitud de WhatsApp per confirmar.</p>
              ) : (
                <>
                  <p className="font-semibold text-stone-800 mb-1.5">
                    {pending.length} {pending.length === 1 ? "sol·licitud" : "sol·licituds"} per confirmar:
                  </p>
                  <ul className="space-y-1">
                    {pending.slice(0, 3).map((p) => (
                      <li key={p.id} className="flex items-center gap-2 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] shrink-0" />
                        <span className="font-bold shrink-0">{p.clientName}</span>
                        {p.serviceName && <span className="text-stone-500 truncate">· {p.serviceName}</span>}
                      </li>
                    ))}
                    {pending.length > 3 && <li className="text-stone-400">i {pending.length - 3} més…</li>}
                  </ul>
                </>
              )}
              <button
                onClick={onOpenPending}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-terra-600 hover:bg-terra-700 text-white text-[11px] font-bold"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Veure &quot;Per confirmar&quot;
              </button>
            </div>
          </div>

          {/* Cabines */}
          {cabins.map((c) => (
            <button
              key={c.room.id}
              disabled={!c.apt}
              onClick={() => c.apt && onEditAppointment(c.apt)}
              className="w-full text-left bg-white border border-terra-100 rounded-2xl p-3 shadow-xs enabled:hover:border-terra-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="leading-tight">
                  <div className="text-sm font-extrabold text-stone-900">{c.title}</div>
                  {c.subtitle && <div className="text-[10px] font-semibold text-stone-500">{c.subtitle}</div>}
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    c.apt ? (c.apt.status === "pendent" ? "bg-amber-100 text-amber-800" : "bg-terra-100 text-terra-800") : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {c.apt ? (c.apt.status === "pendent" ? "Pendent" : "Ocupada") : "Lliure"}
                </span>
              </div>
              {c.apt && (
                <div className="mt-2 flex items-center gap-2 text-xs min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="font-bold text-stone-800 shrink-0">{firstName(c.apt.clientName)}</span>
                  <span className="text-stone-500 truncate">· {c.apt.serviceName}</span>
                </div>
              )}
              {c.apt && (
                <div className="mt-1 text-[11px] text-stone-500">
                  Amb {firstName(c.apt.professionalName)} · {c.apt.startTime}–{c.apt.endTime}
                </div>
              )}
              <div className="mt-1.5 text-[11px] text-stone-500">
                {c.next ? (
                  <>
                    <span className="font-bold text-stone-700">Següent {c.next.startTime}</span> · {firstName(c.next.clientName)} · {c.next.serviceName}
                  </>
                ) : (
                  <span className="text-stone-400">Res més avui</span>
                )}
              </div>
            </button>
          ))}

          {/* Sala d'espera */}
          <div className="bg-white border border-terra-100 rounded-2xl p-3 shadow-xs">
            <div className="text-sm font-extrabold text-stone-900 mb-1.5">Sala d&apos;espera</div>
            {waiting.length === 0 ? (
              <p className="text-[11px] text-stone-500">Ningú no arriba en els propers 20 minuts.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {waiting.map((a) => (
                  <li key={a.id} className="truncate">
                    <span className="font-bold text-stone-800">{a.startTime}</span> · {a.clientName} · <span className="text-stone-500">{a.serviceName}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
