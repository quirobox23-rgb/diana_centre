"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  Sparkles,
  Phone,
  Layers,
  DollarSign,
  Smartphone,
  CalendarDays,
  CalendarRange,
} from "lucide-react";
import { Room, Professional, Service, Appointment } from "@/types";
import { addDays, dayOfWeek, todayStr } from "@/lib/dates";

interface MultiRoomCalendarProps {
  rooms: Room[];
  professionals: Professional[];
  services: Service[];
  appointments: Appointment[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  onNewAppointment: (roomId?: number, time?: string, date?: string) => void;
  onEditAppointment: (appointment: Appointment) => void;
  onRefresh: () => void;
}

// Horaris de la graella de temps (de 09:00 a 20:30 cada 30 minuts)
const TIME_SLOTS: string[] = [];
for (let h = 9; h <= 20; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 20) {
    TIME_SLOTS.push(`${String(h).padStart(2, "0")}:30`);
  }
}

const START_MINUTES = 9 * 60; // 09:00 = 540
const END_MINUTES = 20 * 60 + 30; // 20:30 = 1230
const TOTAL_MINUTES = END_MINUTES - START_MINUTES; // 690 minuts

// Convertir HH:MM a minuts des de 00:00
// Calcula la posició i amplada de cada cita dins d'un dia, separant-les en columnes
// quan coincideixen en horari (com Google Calendar), en lloc d'amuntegar-les.
function layoutDayAppointments(
  apts: Appointment[],
  startMinutes: number,
  pxPerMinute: number
) {
  const items = apts
    .map((apt) => {
      const start = timeToMinutes(apt.startTime);
      const end = timeToMinutes(apt.endTime) || start + apt.durationMinutes;
      return { apt, start, end: Math.max(end, start + 15) };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const n = items.length;
  const columnsEnd: number[] = [];
  const withCol = items.map((it) => {
    let col = columnsEnd.findIndex((endT) => endT <= it.start);
    if (col === -1) {
      col = columnsEnd.length;
      columnsEnd.push(it.end);
    } else {
      columnsEnd[col] = it.end;
    }
    return { ...it, col };
  });

  // Agrupem per "clústers" de cites que se solapen entre elles per saber quantes columnes necessita cada grup
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (withCol[i].start < withCol[j].end && withCol[j].start < withCol[i].end) union(i, j);
    }
  }
  const clusterMaxCol: Record<number, number> = {};
  withCol.forEach((it, idx) => {
    const root = find(idx);
    clusterMaxCol[root] = Math.max(clusterMaxCol[root] ?? 0, it.col);
  });

  return withCol.map((it, idx) => ({
    apt: it.apt,
    top: (it.start - startMinutes) * pxPerMinute,
    height: Math.max(18, (it.end - it.start) * pxPerMinute),
    col: it.col,
    colCount: (clusterMaxCol[find(idx)] ?? 0) + 1,
  }));
}

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function MultiRoomCalendar({
  rooms,
  professionals,
  services,
  appointments,
  selectedDate,
  onDateChange,
  onNewAppointment,
  onEditAppointment,
  onRefresh,
}: MultiRoomCalendarProps) {
  // Mode de visualització: "day" (graella horària de 3 sales) o "week" (graella 6 dies amb les 3 sales sub-columnes)
  const [calendarMode, setCalendarMode] = useState<"day" | "week">("day");
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>("all");
  const mobileDefaultApplied = React.useRef(false);

  // En mòbil, mostrar per defecte només 1 sala (les 3 alhora queden massa petites per llegir bé).
  // Només s'aplica un cop, quan arriben les sales (venen d'una crida asíncrona del component pare).
  useEffect(() => {
    if (mobileDefaultApplied.current) return;
    if (typeof window !== "undefined" && window.innerWidth < 768 && rooms[0]) {
      setSelectedRoomFilter(String(rooms[0].id));
      mobileDefaultApplied.current = true;
    }
  }, [rooms]);
  const [selectedProfFilter, setSelectedProfFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [selectedWeekDayTab, setSelectedWeekDayTab] = useState<number>(0);

  // Format de data en català
  const formatCatalanDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      const days = ["Diumenge", "Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte"];
      const months = [
        "gener", "febrer", "març", "abril", "maig", "juny",
        "juliol", "agost", "setembre", "octubre", "novembre", "desembre"
      ];
      return `${days[dateObj.getDay()]}, ${d} de ${months[m - 1]} de ${y}`;
    } catch {
      return dateStr;
    }
  };

  // "2 – 7 de novembre" o "30 de novembre – 5 de desembre"
  const formatWeekRange = (startStr: string, endStr: string) => {
    const months = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"];
    const [, m1, d1] = startStr.split("-").map(Number);
    const [, m2, d2] = endStr.split("-").map(Number);
    const de = (m: number) => (["abril", "agost", "octubre"].includes(months[m - 1]) ? "d'" : "de ");
    return m1 === m2
      ? `${d1} – ${d2} ${de(m2)}${months[m2 - 1]}`
      : `${d1} ${de(m1)}${months[m1 - 1]} – ${d2} ${de(m2)}${months[m2 - 1]}`;
  };

  const formatShortDay = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      const days = ["Dg", "Dl", "Dm", "Dc", "Dj", "Dv", "Ds"];
      return `${days[dateObj.getDay()]} ${d}`;
    } catch {
      return dateStr;
    }
  };

  // Càlcul de la setmana (Dilluns a Dissabte)
  const getWeekDays = (baseDateStr: string) => {
    const day = dayOfWeek(baseDateStr); // 0 és diumenge
    const mondayStr = addDays(baseDateStr, day === 0 ? -6 : 1 - day);

    const daysList: { dateStr: string; label: string; dayName: string; dayNumber: number }[] = [];
    const dayNames = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte"];

    for (let i = 0; i < 6; i++) {
      const dateStr = addDays(mondayStr, i);
      const dayNumber = Number(dateStr.slice(8, 10));
      daysList.push({
        dateStr,
        label: `${dayNames[i]} ${dayNumber}`,
        dayName: dayNames[i],
        dayNumber,
      });
    }
    return daysList;
  };

  const weekDays = getWeekDays(selectedDate);

  const handlePrev = () => {
    onDateChange(addDays(selectedDate, calendarMode === "week" ? -7 : -1));
  };

  const handleNext = () => {
    onDateChange(addDays(selectedDate, calendarMode === "week" ? 7 : 1));
  };

  const handleToday = () => {
    onDateChange(todayStr());
  };

  // Filtratge de cites
  const getFilteredAppointments = (dateStr: string) => {
    return appointments.filter((apt) => {
      if (apt.date !== dateStr) return false;
      if (selectedRoomFilter !== "all" && apt.roomId !== Number(selectedRoomFilter)) return false;
      if (selectedProfFilter !== "all" && apt.professionalId !== Number(selectedProfFilter)) return false;
      if (selectedStatusFilter !== "all" && apt.status !== selectedStatusFilter) return false;
      return true;
    });
  };

  const todayAppointments = getFilteredAppointments(selectedDate);

  const displayedRooms = selectedRoomFilter === "all"
    ? rooms
    : rooms.filter((r) => r.id === Number(selectedRoomFilter));

  const todayRevenue = todayAppointments
    .filter((a) => a.status !== "cancel·lada")
    .reduce((sum, a) => sum + (parseFloat(a.price) || 0), 0);

  const confirmedCount = todayAppointments.filter((a) => a.status === "confirmada" || a.status === "completada").length;

  // Colors segons la sala
  const getRoomColorClasses = (idx: number) => {
    if (idx === 0) {
      return {
        badge: "bg-arcilla-100 text-arcilla-800 border-arcilla-200",
        pill: "bg-terra-50 border-terra-300 text-terra-950",
        border: "border-arcilla-500",
        header: "from-terra-500 to-arcilla-600",
      };
    }
    if (idx === 1) {
      return {
        badge: "bg-moka-100 text-moka-800 border-moka-200",
        pill: "bg-moka-50 border-moka-300 text-moka-950",
        border: "border-moka-500",
        header: "from-moka-600 to-moka-700",
      };
    }
    return {
      badge: "bg-salvia-100 text-salvia-800 border-salvia-200",
      pill: "bg-salvia-50 border-salvia-300 text-salvia-950",
      border: "border-salvia-500",
      header: "from-salvia-600 to-salvia-600",
    };
  };

  // Pixel height per hora per a la graella horària de calendari (60px per hora = 1px per minut)
  const PIXELS_PER_MINUTE = 1.35; // 1 hora (60 minuts) = 81px
  const SLOT_HEIGHT = 30 * PIXELS_PER_MINUTE; // ~40.5px per 30 min

  return (
    <div className="space-y-4">
      {/* Barra Superior de Data i Controls */}
      <div className="bg-white rounded-2xl shadow-xs border border-terra-100 p-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Navegació de dates */}
          <div className="flex items-center space-x-2 w-full lg:w-auto">
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-terra-700 bg-terra-50 hover:bg-terra-100 rounded-lg border border-terra-200 transition-colors"
            >
              Avui
            </button>
            <div className="flex items-center bg-stone-50 rounded-xl border border-stone-200 p-1">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-lg hover:bg-white hover:shadow-xs text-stone-700 transition-colors"
                title={calendarMode === "week" ? "Setmana anterior" : "Dia anterior"}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="px-3 flex items-center space-x-2 min-w-[200px] justify-center">
                <CalendarIcon className="w-4 h-4 text-terra-600 shrink-0" />
                <span className="text-sm font-bold text-stone-900 text-center whitespace-nowrap first-letter:uppercase">
                  {calendarMode === "week"
                    ? formatWeekRange(weekDays[0].dateStr, weekDays[5].dateStr)
                    : formatCatalanDate(selectedDate)}
                </span>
              </div>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-lg hover:bg-white hover:shadow-xs text-stone-700 transition-colors"
                title={calendarMode === "week" ? "Setmana següent" : "Dia següent"}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg text-stone-700 focus:ring-2 focus:ring-terra-500"
            />
          </div>

          {/* Selector de Mode de Calendari (DIA / SETMANA) */}
          <div className="flex items-center bg-stone-100 rounded-xl p-1 border border-stone-200">
            <button
              onClick={() => setCalendarMode("day")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${
                calendarMode === "day"
                  ? "bg-white text-terra-700 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <CalendarDays className="w-4 h-4 text-terra-600" />
              <span>Dia</span>
            </button>
            <button
              onClick={() => setCalendarMode("week")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${
                calendarMode === "week"
                  ? "bg-white text-terra-700 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <CalendarRange className="w-4 h-4 text-moka-600" />
              <span>Setmana</span>
            </button>
          </div>

          {/* Desplegables de Filtratge */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            {/* Desplegable de Sales */}
            <div className="flex items-center space-x-1.5 bg-stone-50 px-2.5 py-1 rounded-xl border border-stone-200 text-xs">
              <Layers className="w-3.5 h-3.5 text-terra-600" />
              <label className="text-stone-500 font-medium hidden sm:inline">Sala:</label>
              <select
                value={selectedRoomFilter}
                onChange={(e) => setSelectedRoomFilter(e.target.value)}
                className="bg-transparent font-medium text-stone-800 focus:outline-hidden"
              >
                <option value="all">🏢 Les 3 Sales alhora</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Desplegable de Professional */}
            <div className="flex items-center space-x-1.5 bg-stone-50 px-2.5 py-1 rounded-xl border border-stone-200 text-xs">
              <User className="w-3.5 h-3.5 text-moka-600" />
              <label className="text-stone-500 font-medium hidden sm:inline">Professional:</label>
              <select
                value={selectedProfFilter}
                onChange={(e) => setSelectedProfFilter(e.target.value)}
                className="bg-transparent font-medium text-stone-800 focus:outline-hidden"
              >
                <option value="all">Totes les professionals</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* Resum discret de la jornada */}
        <p className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500">
          <span className="font-semibold text-stone-800">{todayAppointments.filter((a) => a.status !== "cancel·lada").length}</span> cites
          {" · "}
          {confirmedCount} confirmades
          {" · "}
          <span className="font-semibold text-stone-800">{todayRevenue.toFixed(0)} €</span> previstos
        </p>
      </div>

      {/* 1. GRAELLA VISUAL DE CALENDARI DE DIA (EIX HORARI 09:00 - 20:30 AMB LES 3 SALES EN COLUMNES) */}
      {calendarMode === "day" && (
        <div className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
        <div style={{ minWidth: displayedRooms.length > 1 ? `${80 + displayedRooms.length * 150}px` : undefined }}>
          {/* Capçalera de les Sales de la graella */}
          <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[90px_1fr] border-b border-stone-200 bg-stone-50 sticky top-0 z-20">
            {/* Cantonada de l'hora */}
            <div className="p-3 text-center text-xs font-bold text-stone-500 border-r border-stone-200 flex items-center justify-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              <span>Hora</span>
            </div>

            {/* Columnes de les 3 Sales */}
            <div
              className={`grid ${
                displayedRooms.length === 1
                  ? "grid-cols-1"
                  : displayedRooms.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-3"
              } divide-x divide-stone-200`}
            >
              {displayedRooms.map((room, idx) => {
                const styles = getRoomColorClasses(idx);
                const roomApts = todayAppointments.filter((a) => a.roomId === room.id);

                return (
                  <div key={room.id} className="p-3 bg-white flex items-center justify-between">
                    <div className="flex items-center space-x-2 overflow-hidden">
                      <span className={`w-3 h-3 rounded-full shrink-0 ${styles.border.replace("border-", "bg-")}`} />
                      <div className="truncate">
                        <h4 className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                          {room.name}
                        </h4>
                        <p className="text-[11px] text-stone-400">
                          {roomApts.length === 0 ? "Sense cites" : `${roomApts.length} ${roomApts.length === 1 ? "cita" : "cites"}`}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => onNewAppointment(room.id, "10:00", selectedDate)}
                      className="p-1 rounded-lg text-stone-400 hover:text-terra-600 hover:bg-terra-50 transition-colors shrink-0 ml-1"
                      title={`Afegir cita a ${room.name}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cos de la Graella Horària de Calendari */}
          <div className="relative max-h-[65vh] sm:max-h-[720px] overflow-y-auto">
            <div
              className="grid grid-cols-[80px_1fr] sm:grid-cols-[90px_1fr] relative"
              style={{ height: `${TOTAL_MINUTES * PIXELS_PER_MINUTE}px` }}
            >
              {/* Eix d'Hores a l'esquerra */}
              <div className="border-r border-stone-200 bg-stone-50/70 select-none relative">
                {TIME_SLOTS.map((time) => {
                  const mins = timeToMinutes(time) - START_MINUTES;
                  const topPos = mins * PIXELS_PER_MINUTE;
                  if (!time.endsWith(":00")) return null;

                  return (
                    <div
                      key={time}
                      className="absolute w-full px-2 text-right flex items-center justify-end -translate-y-1/2"
                      style={{ top: `${topPos}px` }}
                    >
                      <span className="text-[11px] font-medium text-stone-500 tabular-nums">{time}</span>
                    </div>
                  );
                })}
              </div>

              {/* Àrea de les 3 Sales amb línies horàries i blocs de cites posicionats exactament per hora */}
              <div
                className={`relative grid ${
                  displayedRooms.length === 1
                    ? "grid-cols-1"
                    : displayedRooms.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-3"
                } divide-x divide-stone-200 bg-white`}
              >
                {/* Línies horitzontals de fons per a cada franja */}
                <div className="absolute inset-0 pointer-events-none">
                  {TIME_SLOTS.map((time) => {
                    const mins = timeToMinutes(time) - START_MINUTES;
                    const topPos = mins * PIXELS_PER_MINUTE;
                    const isHour = time.endsWith(":00");

                    return (
                      <div
                        key={time}
                        className={`absolute w-full border-b ${
                          isHour ? "border-stone-100" : "border-dashed border-stone-50"
                        }`}
                        style={{ top: `${topPos}px` }}
                      />
                    );
                  })}
                </div>

                {/* Columna de cada sala per allotjar les cites */}
                {displayedRooms.map((room, roomIdx) => {
                  const roomApts = todayAppointments.filter((a) => a.roomId === room.id);
                  const styles = getRoomColorClasses(roomIdx);

                  return (
                    <div
                      key={room.id}
                      className="relative h-full transition-colors hover:bg-stone-50/30"
                      onClick={(e) => {
                        // Clic per reservar a l'hora exacta on es fa clic
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickY = e.clientY - rect.top;
                        const clickedMins = START_MINUTES + Math.floor(clickY / (30 * PIXELS_PER_MINUTE)) * 30;
                        const h = Math.floor(clickedMins / 60);
                        const m = clickedMins % 60;
                        const clickedTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                        onNewAppointment(room.id, clickedTime, selectedDate);
                      }}
                    >
                      {/* Banderoles de Cites tipus Calendari Google/Outlook */}
                      {roomApts.map((apt) => {
                        const startMin = timeToMinutes(apt.startTime);
                        const endMin = timeToMinutes(apt.endTime) || startMin + apt.durationMinutes;
                        const clampedStart = Math.max(START_MINUTES, startMin);
                        const clampedEnd = Math.min(END_MINUTES, endMin);
                        const durationMins = Math.max(25, clampedEnd - clampedStart);

                        const topOffset = (clampedStart - START_MINUTES) * PIXELS_PER_MINUTE;
                        const blockHeight = durationMins * PIXELS_PER_MINUTE;

                        const isCancelled = apt.status === "cancel·lada";
                        const isPending = apt.status === "pendent";

                        const accentColor = apt.serviceColor || "#c06a44";

                        return (
                          <div
                            key={apt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditAppointment(apt);
                            }}
                            className={`absolute left-1 right-1 rounded-lg px-2 py-1.5 cursor-pointer z-10 overflow-hidden transition-colors hover:brightness-95 ${
                              isCancelled ? "opacity-50 line-through" : ""
                            }`}
                            style={{
                              top: `${topOffset}px`,
                              height: `${blockHeight - 2}px`,
                              backgroundColor: isCancelled ? "#f5f5f4" : `${accentColor}1f`,
                              borderLeft: `3px solid ${isCancelled ? "#a8a29e" : accentColor}`,
                            }}
                            title={`${apt.startTime}-${apt.endTime} · ${apt.clientName} · ${apt.serviceName} · ${apt.professionalName ?? ""} · ${apt.price}€`}
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-semibold text-xs text-stone-900 truncate">{apt.clientName}</span>
                              {blockHeight < 75 && apt.professionalName && (
                                <ProfessionalTag name={apt.professionalName} color={apt.professionalColor} />
                              )}
                              {apt.status !== "confirmada" && (
                                <span
                                  className={`shrink-0 text-[9px] font-semibold px-1.5 rounded-full ${
                                    isPending ? "bg-amber-100 text-amber-800" : "bg-stone-200 text-stone-600"
                                  }`}
                                >
                                  {apt.status}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-600 truncate">
                              {apt.startTime}–{apt.endTime} · {apt.serviceName}
                            </div>
                            {blockHeight >= 75 && apt.professionalName && (
                              <div className="mt-0.5">
                                <ProfessionalTag name={apt.professionalName} color={apt.professionalColor} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        </div>
        </div>
      )}

      {/* 2. CALENDARI SETMANAL REAL: eix horari a l'esquerra, els 6 dies com a columnes */}
      {calendarMode === "week" && (
        <div className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Capçalera amb els 6 dies */}
              <div className="grid grid-cols-[70px_repeat(6,1fr)] border-b border-stone-200 sticky top-0 bg-white z-20">
                <div className="p-2 border-r border-stone-200" />
                {weekDays.map((d) => {
                  const isDayToday = d.dateStr === todayStr();
                  const dayApts = getFilteredAppointments(d.dateStr);
                  return (
                    <button
                      key={d.dateStr}
                      onClick={() => onDateChange(d.dateStr)}
                      className={`p-2 text-center border-r border-stone-100 last:border-r-0 hover:bg-stone-50 transition-colors ${
                        d.dateStr === selectedDate ? "bg-terra-50" : ""
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                        {d.dayName}
                      </div>
                      <div
                        className={`text-sm font-extrabold ${
                          isDayToday
                            ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-terra-600 text-white"
                            : "text-stone-900"
                        }`}
                      >
                        {d.dayNumber}
                      </div>
                      <div className="text-[9px] text-stone-400 mt-0.5">
                        {dayApts.length > 0 ? `${dayApts.length} ${dayApts.length === 1 ? "cita" : "cites"}` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Graella horària amb les cites de cada dia */}
              <div
                className="grid grid-cols-[70px_repeat(6,1fr)] relative"
                style={{ height: `${TOTAL_MINUTES * PIXELS_PER_MINUTE}px` }}
              >
                {/* Eix d'hores */}
                <div className="border-r border-stone-200 bg-stone-50/70 relative">
                  {TIME_SLOTS.map((time) => {
                    const mins = timeToMinutes(time) - START_MINUTES;
                    const isHour = time.endsWith(":00");
                    return (
                      <div
                        key={time}
                        className="absolute w-full px-1.5 text-right -translate-y-1/2"
                        style={{ top: `${mins * PIXELS_PER_MINUTE}px` }}
                      >
                        {isHour && (
                          <span className="text-[11px] font-medium text-stone-500 tabular-nums">{time}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Columnes dels 6 dies */}
                {weekDays.map((d) => {
                  const dayApts = getFilteredAppointments(d.dateStr);
                  const laidOut = layoutDayAppointments(dayApts, START_MINUTES, PIXELS_PER_MINUTE);

                  return (
                    <div
                      key={d.dateStr}
                      className="relative border-r border-stone-100 last:border-r-0 hover:bg-stone-50/30 transition-colors"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickY = e.clientY - rect.top;
                        const clickedMins = START_MINUTES + Math.floor(clickY / (30 * PIXELS_PER_MINUTE)) * 30;
                        const h = Math.floor(clickedMins / 60);
                        const m = clickedMins % 60;
                        onNewAppointment(rooms[0]?.id, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, d.dateStr);
                      }}
                    >
                      {/* Línies horàries de fons */}
                      {TIME_SLOTS.map((time) => {
                        const mins = timeToMinutes(time) - START_MINUTES;
                        const isHour = time.endsWith(":00");
                        return (
                          <div
                            key={time}
                            className={`absolute w-full border-b pointer-events-none ${
                              isHour ? "border-stone-100" : "border-dashed border-stone-50"
                            }`}
                            style={{ top: `${mins * PIXELS_PER_MINUTE}px` }}
                          />
                        );
                      })}

                      {/* Cites del dia, separades en columnes quan coincideixen en horari */}
                      {laidOut.map(({ apt, top, height, col, colCount }) => {
                        const accentColor = apt.serviceColor || "#c06a44";
                        const isCancelled = apt.status === "cancel·lada";
                        const widthPct = 100 / colCount;

                        return (
                          <div
                            key={apt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditAppointment(apt);
                            }}
                            className={`absolute rounded-md px-1.5 py-1 cursor-pointer hover:brightness-95 hover:z-30 transition-colors overflow-hidden ${
                              isCancelled ? "opacity-50 line-through" : ""
                            }`}
                            style={{
                              top: `${top}px`,
                              height: `${height - 2}px`,
                              left: `calc(${col * widthPct}% + 1px)`,
                              width: `calc(${widthPct}% - 2px)`,
                              backgroundColor: isCancelled ? "#f5f5f4" : `${accentColor}1f`,
                              borderLeft: `3px solid ${isCancelled ? "#a8a29e" : accentColor}`,
                              zIndex: 10 + col,
                            }}
                            title={`${apt.startTime}-${apt.endTime} · ${apt.clientName} · ${apt.serviceName} · ${apt.professionalName ?? ""}`}
                          >
                            <div className="text-[9px] font-bold text-stone-700 truncate leading-tight">
                              {apt.startTime}
                              {apt.professionalName && (
                                <span className="font-semibold text-stone-500"> · {apt.professionalName.split(" ")[0]}</span>
                              )}
                            </div>
                            <div className="text-[10px] font-bold text-stone-900 truncate leading-tight">
                              {apt.clientName}
                            </div>
                            {height > 34 && (
                              <div className="text-[9px] text-stone-500 truncate leading-tight">
                                {apt.serviceName}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Etiqueta petita amb el color i el nom de la professional. */
function ProfessionalTag({ name, color }: { name: string; color?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 shrink-0 text-[10px] font-medium text-stone-600">
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color || "#866353" }} />
      {name.split(" ")[0]}
    </span>
  );
}
