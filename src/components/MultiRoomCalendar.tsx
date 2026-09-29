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
    const [y, m, d] = baseDateStr.split("-").map(Number);
    const curr = new Date(y, m - 1, d);
    const day = curr.getDay(); // 0 is Sunday
    const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diffToMonday));

    const daysList: { dateStr: string; label: string; dayName: string; dayNumber: number }[] = [];
    const dayNames = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte"];

    for (let i = 0; i < 6; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      const dateStr = dayDate.toISOString().split("T")[0];
      daysList.push({
        dateStr,
        label: `${dayNames[i]} ${dayDate.getDate()}`,
        dayName: dayNames[i],
        dayNumber: dayDate.getDate(),
      });
    }
    return daysList;
  };

  const weekDays = getWeekDays(selectedDate);

  const handlePrev = () => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (calendarMode === "week") {
      dateObj.setDate(dateObj.getDate() - 7);
    } else {
      dateObj.setDate(dateObj.getDate() - 1);
    }
    onDateChange(dateObj.toISOString().split("T")[0]);
  };

  const handleNext = () => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (calendarMode === "week") {
      dateObj.setDate(dateObj.getDate() + 7);
    } else {
      dateObj.setDate(dateObj.getDate() + 1);
    }
    onDateChange(dateObj.toISOString().split("T")[0]);
  };

  const handleToday = () => {
    onDateChange(new Date().toISOString().split("T")[0]);
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
        badge: "bg-pink-100 text-pink-800 border-pink-200",
        pill: "bg-rose-50 border-rose-300 text-rose-950",
        border: "border-pink-500",
        header: "from-rose-500 to-pink-600",
      };
    }
    if (idx === 1) {
      return {
        badge: "bg-purple-100 text-purple-800 border-purple-200",
        pill: "bg-purple-50 border-purple-300 text-purple-950",
        border: "border-purple-500",
        header: "from-purple-600 to-violet-700",
      };
    }
    return {
      badge: "bg-sky-100 text-sky-800 border-sky-200",
      pill: "bg-sky-50 border-sky-300 text-sky-950",
      border: "border-sky-500",
      header: "from-sky-600 to-cyan-600",
    };
  };

  // Pixel height per hora per a la graella horària de calendari (60px per hora = 1px per minut)
  const PIXELS_PER_MINUTE = 1.35; // 1 hora (60 minuts) = 81px
  const SLOT_HEIGHT = 30 * PIXELS_PER_MINUTE; // ~40.5px per 30 min

  return (
    <div className="space-y-4">
      {/* Barra Superior de Data i Controls */}
      <div className="bg-white rounded-2xl shadow-xs border border-rose-100 p-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Navegació de dates */}
          <div className="flex items-center space-x-2 w-full lg:w-auto">
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors"
            >
              Avui
            </button>
            <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 p-1">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-lg hover:bg-white hover:shadow-xs text-gray-700 transition-colors"
                title={calendarMode === "week" ? "Setmana anterior" : "Dia anterior"}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="px-3 flex items-center space-x-2 min-w-[200px] justify-center">
                <CalendarIcon className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="text-sm font-bold text-gray-900 capitalize text-center">
                  {calendarMode === "week"
                    ? `Setmana del ${formatShortDay(weekDays[0].dateStr)} al ${formatShortDay(weekDays[5].dateStr)}`
                    : formatCatalanDate(selectedDate)}
                </span>
              </div>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-lg hover:bg-white hover:shadow-xs text-gray-700 transition-colors"
                title={calendarMode === "week" ? "Setmana següent" : "Dia següent"}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Selector de Mode de Calendari (DIA / SETMANA) */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200">
            <button
              onClick={() => setCalendarMode("day")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${
                calendarMode === "day"
                  ? "bg-white text-rose-700 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <CalendarDays className="w-4 h-4 text-rose-600" />
              <span>Graella Calendari Dia (3 Sales)</span>
            </button>
            <button
              onClick={() => setCalendarMode("week")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${
                calendarMode === "week"
                  ? "bg-white text-rose-700 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <CalendarRange className="w-4 h-4 text-purple-600" />
              <span>Graella Calendari Setmana</span>
            </button>
          </div>

          {/* Desplegables de Filtratge */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            {/* Desplegable de Sales */}
            <div className="flex items-center space-x-1.5 bg-gray-50 px-2.5 py-1 rounded-xl border border-gray-200 text-xs">
              <Layers className="w-3.5 h-3.5 text-rose-600" />
              <label className="text-gray-500 font-medium hidden sm:inline">Sala:</label>
              <select
                value={selectedRoomFilter}
                onChange={(e) => setSelectedRoomFilter(e.target.value)}
                className="bg-transparent font-medium text-gray-800 focus:outline-hidden"
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
            <div className="flex items-center space-x-1.5 bg-gray-50 px-2.5 py-1 rounded-xl border border-gray-200 text-xs">
              <User className="w-3.5 h-3.5 text-purple-600" />
              <label className="text-gray-500 font-medium hidden sm:inline">Professional:</label>
              <select
                value={selectedProfFilter}
                onChange={(e) => setSelectedProfFilter(e.target.value)}
                className="bg-transparent font-medium text-gray-800 focus:outline-hidden"
              >
                <option value="all">Totes les professionals</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Botó Nova Cita */}
            <button
              onClick={() => onNewAppointment()}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 rounded-xl shadow-xs transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Cita</span>
            </button>
          </div>
        </div>

        {/* Resum ràpid de la jornada */}
        <div className="mt-3 pt-3 border-t border-rose-50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-rose-50/50 rounded-xl p-2 border border-rose-100 flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold text-xs">
              {todayAppointments.length}
            </div>
            <div>
              <p className="text-gray-500 text-[11px]">Cites avui</p>
              <p className="font-semibold text-gray-900 text-xs">{confirmedCount} confirmades</p>
            </div>
          </div>

          <div className="bg-emerald-50/50 rounded-xl p-2 border border-emerald-100 flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-gray-500 text-[11px]">Previst avui</p>
              <p className="font-semibold text-emerald-800 text-xs">{todayRevenue.toFixed(2)} €</p>
            </div>
          </div>

          <div className="bg-purple-50/50 rounded-xl p-2 border border-purple-100 flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-purple-500 text-white flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-gray-500 text-[11px]">Sales actives</p>
              <p className="font-semibold text-purple-900 text-xs">3 Cabines</p>
            </div>
          </div>

          <div className="bg-sky-50/50 rounded-xl p-2 border border-sky-100 flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-sky-500 text-white flex items-center justify-center">
              <Smartphone className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-gray-500 text-[11px]">Bot Mòbil</p>
              <p className="font-semibold text-sky-900 text-xs">
                {appointments.filter((a) => a.source === "whatsapp_bot" || a.source === "bot_simulador").length} reserves
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 1. GRAELLA VISUAL DE CALENDARI DE DIA (EIX HORARI 09:00 - 20:30 AMB LES 3 SALES EN COLUMNES) */}
      {calendarMode === "day" && (
        <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
        <div style={{ minWidth: displayedRooms.length > 1 ? `${80 + displayedRooms.length * 150}px` : undefined }}>
          {/* Capçalera de les Sales de la graella */}
          <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[90px_1fr] border-b border-gray-200 bg-stone-50 sticky top-0 z-20">
            {/* Cantonada de l'hora */}
            <div className="p-3 text-center text-xs font-bold text-gray-500 border-r border-gray-200 flex items-center justify-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
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
              } divide-x divide-gray-200`}
            >
              {displayedRooms.map((room, idx) => {
                const styles = getRoomColorClasses(idx);
                const roomApts = todayAppointments.filter((a) => a.roomId === room.id);

                return (
                  <div key={room.id} className="p-3 bg-white flex items-center justify-between">
                    <div className="flex items-center space-x-2 overflow-hidden">
                      <span className={`w-3 h-3 rounded-full shrink-0 ${styles.border.replace("border-", "bg-")}`} />
                      <div className="truncate">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[10px] uppercase font-bold text-gray-500">
                            Sala {idx + 1}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${styles.badge}`}>
                            {roomApts.length} {roomApts.length === 1 ? "cita" : "cites"}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs sm:text-sm text-gray-900 truncate">
                          {room.name}
                        </h4>
                      </div>
                    </div>

                    <button
                      onClick={() => onNewAppointment(room.id, "10:00", selectedDate)}
                      className="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 ml-1"
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
              <div className="border-r border-gray-200 bg-stone-50/70 select-none relative">
                {TIME_SLOTS.map((time) => {
                  const mins = timeToMinutes(time) - START_MINUTES;
                  const topPos = mins * PIXELS_PER_MINUTE;
                  const isHour = time.endsWith(":00");

                  return (
                    <div
                      key={time}
                      className="absolute w-full px-2 text-right flex items-center justify-end -translate-y-1/2"
                      style={{ top: `${topPos}px` }}
                    >
                      <span
                        className={`font-mono text-xs ${
                          isHour ? "font-bold text-gray-800 text-[11px]" : "text-gray-400 text-[10px]"
                        }`}
                      >
                        {time}
                      </span>
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
                } divide-x divide-gray-200 bg-white`}
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
                          isHour ? "border-gray-200" : "border-dashed border-gray-100"
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

                        const accentColor = apt.serviceColor || "#ec4899";

                        return (
                          <div
                            key={apt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditAppointment(apt);
                            }}
                            className={`absolute left-1.5 right-1.5 rounded-xl p-2.5 shadow-sm border border-gray-200 bg-white transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer z-10 flex flex-col justify-between overflow-hidden ${
                              isCancelled ? "opacity-50 line-through bg-gray-100 border-gray-300" : ""
                            }`}
                            style={{
                              top: `${topOffset}px`,
                              height: `${blockHeight - 3}px`,
                              borderLeft: `4px solid ${isCancelled ? "#9ca3af" : accentColor}`,
                            }}
                          >
                            <div className="overflow-hidden">
                              <div className="flex items-center justify-between text-[11px] font-bold">
                                <span className="flex items-center space-x-1 text-gray-700">
                                  <Clock className="w-3 h-3 text-gray-400" />
                                  <span>
                                    {apt.startTime} - {apt.endTime}
                                  </span>
                                </span>
                                <span className="font-extrabold text-gray-900">
                                  {apt.price}€
                                </span>
                              </div>

                              <div className="font-bold text-xs text-gray-900 truncate mt-1">
                                {apt.clientName}
                              </div>

                              <div className="text-[11px] text-gray-600 font-medium truncate mt-0.5">
                                {apt.serviceName}
                              </div>
                            </div>

                            {/* Peu de la targeta de calendari */}
                            <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1 pt-1 border-t border-gray-100">
                              <span className="truncate">
                                {apt.professionalName?.split(" ")[0]}
                              </span>
                              <span
                                className={`font-bold px-1.5 py-0.2 rounded-full uppercase text-[9px] ${
                                  apt.status === "confirmada"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : isPending
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {apt.status}
                              </span>
                            </div>
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
        <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Capçalera amb els 6 dies */}
              <div className="grid grid-cols-[70px_repeat(6,1fr)] border-b border-gray-200 sticky top-0 bg-white z-20">
                <div className="p-2 border-r border-gray-200" />
                {weekDays.map((d) => {
                  const isDayToday = d.dateStr === new Date().toISOString().split("T")[0];
                  const dayApts = getFilteredAppointments(d.dateStr);
                  return (
                    <button
                      key={d.dateStr}
                      onClick={() => onDateChange(d.dateStr)}
                      className={`p-2 text-center border-r border-gray-100 last:border-r-0 hover:bg-gray-50 transition-colors ${
                        d.dateStr === selectedDate ? "bg-rose-50" : ""
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                        {d.dayName}
                      </div>
                      <div
                        className={`text-sm font-extrabold ${
                          isDayToday
                            ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-600 text-white"
                            : "text-gray-900"
                        }`}
                      >
                        {d.dayNumber}
                      </div>
                      <div className="text-[9px] text-gray-400 mt-0.5">
                        {dayApts.length > 0 ? `${dayApts.length} cites` : ""}
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
                <div className="border-r border-gray-200 bg-stone-50/70 relative">
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
                          <span className="font-mono text-[10px] font-bold text-gray-700">{time}</span>
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
                      className="relative border-r border-gray-100 last:border-r-0 hover:bg-stone-50/30 transition-colors"
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
                              isHour ? "border-gray-200" : "border-dashed border-gray-100"
                            }`}
                            style={{ top: `${mins * PIXELS_PER_MINUTE}px` }}
                          />
                        );
                      })}

                      {/* Cites del dia, separades en columnes quan coincideixen en horari */}
                      {laidOut.map(({ apt, top, height, col, colCount }) => {
                        const accentColor = apt.serviceColor || "#ec4899";
                        const isCancelled = apt.status === "cancel·lada";
                        const widthPct = 100 / colCount;

                        return (
                          <div
                            key={apt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditAppointment(apt);
                            }}
                            className={`absolute rounded-lg px-1.5 py-1 border border-gray-200 bg-white shadow-sm cursor-pointer hover:shadow-md hover:z-30 transition-all overflow-hidden ${
                              isCancelled ? "opacity-50 line-through bg-gray-100" : ""
                            }`}
                            style={{
                              top: `${top}px`,
                              height: `${height - 2}px`,
                              left: `calc(${col * widthPct}% + 1px)`,
                              width: `calc(${widthPct}% - 2px)`,
                              borderLeft: `3px solid ${isCancelled ? "#9ca3af" : accentColor}`,
                              zIndex: 10 + col,
                            }}
                            title={`${apt.startTime}-${apt.endTime} · ${apt.clientName} · ${apt.serviceName}`}
                          >
                            <div className="text-[9px] font-bold text-gray-700 truncate leading-tight">
                              {apt.startTime}
                            </div>
                            <div className="text-[10px] font-bold text-gray-900 truncate leading-tight">
                              {apt.clientName}
                            </div>
                            {height > 34 && (
                              <div className="text-[9px] text-gray-500 truncate leading-tight">
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
