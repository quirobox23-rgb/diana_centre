"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Room, Professional, Appointment, Schedule } from "@/types";
import { colorForService, textColorOn } from "@/lib/treatment-colors";
import { todayStr, nowTimeStr, dayOfWeek } from "@/lib/dates";
import { MessageCircle, Clock, RotateCcw, DoorOpen, Sparkles } from "lucide-react";

// Oficina: el centre vist des de dalt, en una sola planta.
// Les 3 cabines una al costat de l'altra, el passadís, i la recepció on seu l'Aura
// (l'agent de WhatsApp). Mostra qui hi ha a cada cabina a l'hora triada (per defecte, ara).

interface PendingRequest {
  id: number;
  clientName: string;
  serviceName?: string | null;
  createdAt?: string;
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
const toTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

const firstName = (s?: string | null) => (s || "").trim().split(/\s+/)[0] || "";
const norm = (s?: string | null) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ---------- Personatges (dibuixats amb SVG) ----------

type Look = "diana" | "montsant" | "client" | "aura" | "other";

function lookOf(name?: string | null): Look {
  const n = norm(name);
  if (/^diana\b/.test(n)) return "diana";
  if (/^montsan/.test(n)) return "montsant";
  return "other";
}

function Person({ look, size = 44, shirt }: { look: Look; size?: number; shirt?: string }) {
  // Cabell: Diana clar/blanc, Montsant castany amb ulleres, Aura lila amb auriculars
  const hair =
    look === "diana" ? "#EDE6DA" : look === "montsant" ? "#6B4A35" : look === "aura" ? "#8E6CC8" : look === "client" ? "#A0785A" : "#4D3B35";
  const top =
    shirt || (look === "aura" ? "#2BB673" : look === "client" ? "#D6BD99" : look === "diana" ? "#FFFFFF" : look === "montsant" ? "#FFFFFF" : "#C06A44");
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      {/* cos */}
      <path d="M8 46c0-9 7-15 16-15s16 6 16 15z" fill={top} stroke="#4D3B35" strokeOpacity=".25" />
      {(look === "diana" || look === "montsant") && <path d="M24 31v15" stroke="#C06A44" strokeOpacity=".5" strokeWidth="1.5" />}
      {/* cabell darrere */}
      <path d="M11 22c0-9 6-15 13-15s13 6 13 15v6c-2 1-4 1-5 0V20H16v8c-1 1-3 1-5 0z" fill={hair} />
      {/* cara */}
      <circle cx="24" cy="21" r="9" fill="#F3D2B8" />
      {/* serrell */}
      <path d="M15 19c1-6 5-9 9-9 5 0 9 3 9 8-4-1-8-3-10-6-2 3-5 6-8 7z" fill={hair} />
      {/* ulls */}
      <circle cx="20.5" cy="22" r="1" fill="#3a2a22" />
      <circle cx="27.5" cy="22" r="1" fill="#3a2a22" />
      <path d="M21.5 26c1.5 1.2 3.5 1.2 5 0" stroke="#B5523A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {look === "montsant" && (
        <g stroke="#3a2a22" strokeWidth="1" fill="none">
          <circle cx="20.5" cy="22" r="2.6" />
          <circle cx="27.5" cy="22" r="2.6" />
          <path d="M23.1 22h1.8" />
        </g>
      )}
      {look === "aura" && (
        <g>
          <path d="M14 21a10 10 0 0 1 20 0" stroke="#2D2A32" strokeWidth="1.8" fill="none" />
          <rect x="12" y="19" width="4" height="6" rx="2" fill="#2D2A32" />
          <rect x="32" y="19" width="4" height="6" rx="2" fill="#2D2A32" />
          <path d="M14 25c0 4 3 5 7 5" stroke="#2D2A32" strokeWidth="1.2" fill="none" />
          <circle cx="21.5" cy="30" r="1.3" fill="#2D2A32" />
        </g>
      )}
    </svg>
  );
}

// Llitera de cabina vista des de dalt
function Bed({ color }: { color?: string }) {
  return (
    <div className="relative w-full h-14 rounded-xl bg-white border border-stone-300 shadow-inner">
      <div className="absolute left-1.5 top-1.5 bottom-1.5 w-8 rounded-lg bg-stone-100 border border-stone-200" />
      {color && <div className="absolute left-11 right-2 top-2 bottom-2 rounded-lg opacity-25" style={{ background: color }} />}
    </div>
  );
}

// ---------- Vista ----------

export function OfficeView({ rooms, professionals, schedules, onOpenPending, onEditAppointment }: OfficeViewProps) {
  const today = todayStr();
  const [apts, setApts] = useState<Appointment[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [nowMin, setNowMin] = useState(() => toMin(nowTimeStr()));
  const [pickedMin, setPickedMin] = useState<number | null>(null); // null = en directe
  const viewMin = pickedMin ?? nowMin;

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

  // Horari d'avui (per a la barra del temps)
  const sched = schedules.find((s) => s.dayOfWeek === dayOfWeek(today));
  const open = sched?.isOpen ?? false;
  const dayStart = toMin(sched?.morningStart || "09:00");
  const dayEnd = toMin(sched?.afternoonEnd || sched?.morningEnd || "20:00");

  const sortedRooms = useMemo(
    () => [...rooms].filter((r) => r.isActive).sort((a, b) => a.name.localeCompare(b.name, "ca", { numeric: true })),
    [rooms]
  );
  const activeApts = useMemo(() => apts.filter((a) => a.date === today && a.status !== "cancel·lada"), [apts, today]);

  const inRoom = (roomId: number) =>
    activeApts.find((a) => a.roomId === roomId && toMin(a.startTime) <= viewMin && viewMin < toMin(a.endTime)) || null;
  const nextInRoom = (roomId: number) =>
    activeApts
      .filter((a) => a.roomId === roomId && toMin(a.startTime) > viewMin)
      .sort((a, b) => toMin(a.startTime) - toMin(b.startTime))[0] || null;

  const busyProIds = new Set(sortedRooms.map((r) => inRoom(r.id)?.professionalId).filter(Boolean) as number[]);
  const freePros = professionals.filter((p) => p.isActive && !busyProIds.has(p.id));
  // Sala d'espera: clientes que arriben en els propers 20 minuts
  const waiting = activeApts
    .filter((a) => toMin(a.startTime) > viewMin && toMin(a.startTime) - viewMin <= 20)
    .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));

  const nextForPro = (proId: number) =>
    activeApts
      .filter((a) => a.professionalId === proId && toMin(a.startTime) > viewMin)
      .sort((a, b) => toMin(a.startTime) - toMin(b.startTime))[0] || null;

  const live = pickedMin === null;

  return (
    <div className="space-y-4">
      {/* Capçalera */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900">Oficina</h2>
          <p className="text-xs text-stone-500">El centre en una sola planta: qui hi ha a cada cabina i què té l&apos;Aura a recepció.</p>
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

      {!open && (
        <p className="text-xs font-semibold text-stone-500 bg-white border border-stone-200 rounded-xl px-3 py-2">Avui el centre és tancat.</p>
      )}

      {/* Planta */}
      <div
        className="rounded-3xl border-[6px] border-stone-700/80 p-3 sm:p-4 shadow-lg"
        style={{
          background:
            "repeating-linear-gradient(90deg, #EADBC4 0 46px, #E3D1B6 46px 48px), #EADBC4",
        }}
      >
        {/* Cabines consecutives */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x-[5px] divide-stone-700/70 border-[5px] border-stone-700/70 rounded-2xl overflow-hidden bg-[#F7F1E8]">
          {sortedRooms.map((room, idx) => {
            const apt = inRoom(room.id);
            const next = nextInRoom(room.id);
            const color = apt ? apt.serviceColor || colorForService(apt.serviceName || "", apt.serviceCategory) : undefined;
            const progress = apt ? (viewMin - toMin(apt.startTime)) / Math.max(1, toMin(apt.endTime) - toMin(apt.startTime)) : 0;
            const [title, subtitle] = room.name.split("·").map((s) => s.trim());
            return (
              <div key={room.id} className={`relative p-3 sm:p-4 min-h-[250px] flex flex-col ${idx > 0 ? "border-t-[5px] md:border-t-0 border-stone-700/70" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-extrabold text-stone-900">{title}</div>
                    {subtitle && <div className="text-[11px] font-semibold text-stone-500">{subtitle}</div>}
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      apt ? (apt.status === "pendent" ? "bg-amber-100 text-amber-800" : "bg-terra-100 text-terra-800") : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {apt ? (apt.status === "pendent" ? "Pendent" : "Ocupada") : "Lliure"}
                  </span>
                </div>

                <div className="flex-1 flex flex-col justify-center gap-2 mt-3">
                  {apt ? (
                    <button onClick={() => onEditAppointment(apt)} className="text-left group" title="Obrir la cita">
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-1 mb-1">
                            <Person look="client" size={30} />
                            <span className="text-xs font-bold text-stone-800 truncate group-hover:underline">{apt.clientName}</span>
                          </div>
                          <Bed color={color} />
                        </div>
                        <div className="flex flex-col items-center">
                          <Person look={lookOf(apt.professionalName)} size={46} />
                          <span className="text-[10px] font-bold text-stone-700">{firstName(apt.professionalName)}</span>
                        </div>
                      </div>
                      <div
                        className="mt-2 text-[11px] font-bold px-2 py-1 rounded-lg truncate"
                        style={{ background: color, color: textColorOn(color) }}
                      >
                        {apt.serviceName}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-stone-500 font-semibold tabular-nums">
                        <span>{apt.startTime}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                          <div className="h-full rounded-full bg-terra-500" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
                        </div>
                        <span>{apt.endTime}</span>
                      </div>
                    </button>
                  ) : (
                    <div className="opacity-70">
                      <Bed />
                      <p className="text-[11px] text-stone-500 font-semibold mt-2 text-center">Cabina buida</p>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-dashed border-stone-300 text-[11px] text-stone-600">
                  {next ? (
                    <span>
                      <span className="font-bold text-stone-800">Següent {next.startTime}</span> · {firstName(next.clientName)} · {next.serviceName}
                    </span>
                  ) : (
                    <span className="text-stone-400">Res més avui</span>
                  )}
                </div>
                {/* porta cap al passadís */}
                <div className="hidden md:block absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-16 h-[5px] bg-[#F7F1E8]" />
              </div>
            );
          })}
          {sortedRooms.length === 0 && <div className="p-6 text-sm text-stone-500 col-span-3">Encara no hi ha cabines configurades.</div>}
        </div>

        {/* Passadís amb les professionals lliures */}
        <div className="my-3 rounded-2xl bg-white/50 border border-dashed border-stone-400/60 px-3 py-2 flex flex-wrap items-center gap-x-5 gap-y-2 min-h-[64px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Passadís</span>
          {freePros.length === 0 && <span className="text-[11px] text-stone-500">Totes les professionals estan amb una clienta.</span>}
          {freePros.map((p) => {
            const nx = nextForPro(p.id);
            return (
              <div key={p.id} className="flex items-center gap-1.5">
                <Person look={lookOf(p.name)} size={38} />
                <div className="leading-tight">
                  <div className="text-xs font-bold text-stone-800">{firstName(p.name)}</div>
                  <div className="text-[10px] text-stone-500">{nx ? `Lliure fins a les ${nx.startTime}` : "Lliure"}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recepció + sala d'espera */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 rounded-2xl border-[5px] border-stone-700/70 bg-[#F7F1E8] p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-extrabold text-stone-900">Recepció</div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">En proves fins al gener</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {/* Aura al taulell */}
              <div className="flex flex-col items-center shrink-0">
                <div className="relative">
                  <Person look="aura" size={72} />
                  <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow">
                    <MessageCircle className="w-3.5 h-3.5" />
                  </span>
                  {pending.length > 0 && (
                    <span className="absolute -top-2 -left-2 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                      {pending.length}
                    </span>
                  )}
                </div>
                <div className="w-28 h-4 rounded-md bg-moka-600/80 -mt-1 shadow" />
                <div className="mt-1 text-xs font-extrabold text-stone-900 flex items-center gap-1">
                  Aura <Sparkles className="w-3 h-3 text-violet-500" />
                </div>
                <div className="text-[10px] text-stone-500">Agent de WhatsApp</div>
              </div>

              {/* Bafarada */}
              <div className="flex-1 w-full">
                <div className="relative bg-white rounded-2xl rounded-tl-sm border border-stone-200 shadow-sm p-3 text-xs text-stone-700">
                  {pending.length === 0 ? (
                    <p>Tot al dia ✨ No tinc cap sol·licitud de WhatsApp per confirmar.</p>
                  ) : (
                    <>
                      <p className="font-semibold text-stone-800 mb-2">
                        Tinc {pending.length} {pending.length === 1 ? "sol·licitud" : "sol·licituds"} de WhatsApp esperant que la confirmeu:
                      </p>
                      <ul className="space-y-1">
                        {pending.slice(0, 3).map((p) => (
                          <li key={p.id} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]" />
                            <span className="font-bold">{p.clientName}</span>
                            {p.serviceName && <span className="text-stone-500 truncate">· {p.serviceName}</span>}
                          </li>
                        ))}
                        {pending.length > 3 && <li className="text-stone-400">i {pending.length - 3} més…</li>}
                      </ul>
                    </>
                  )}
                  <button
                    onClick={onOpenPending}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-terra-600 hover:bg-terra-700 text-white text-[11px] font-bold"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> Veure &quot;Per confirmar&quot;
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border-[5px] border-stone-700/70 bg-[#F7F1E8] p-3 sm:p-4 flex flex-col">
            <div className="text-sm font-extrabold text-stone-900 mb-2">Sala d&apos;espera</div>
            <div className="flex-1 space-y-2">
              {waiting.length === 0 ? (
                <p className="text-[11px] text-stone-500">Ningú no arriba en els propers 20 minuts.</p>
              ) : (
                waiting.map((a) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <Person look="client" size={32} />
                    <div className="leading-tight min-w-0">
                      <div className="text-xs font-bold text-stone-800 truncate">{a.clientName}</div>
                      <div className="text-[10px] text-stone-500 truncate">
                        {a.startTime} · {a.serviceName}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex items-center justify-center gap-1 text-[10px] font-bold text-stone-500">
              <DoorOpen className="w-3.5 h-3.5" /> Entrada
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
