"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { MultiRoomCalendar } from "@/components/MultiRoomCalendar";
import { PendingRequests } from "@/components/PendingRequests";
import { BotSimulatorView } from "@/components/BotSimulatorView";
import { ServicesManager } from "@/components/ServicesManager";
import { ScheduleManager } from "@/components/ScheduleManager";
import { ProfessionalsManager } from "@/components/ProfessionalsManager";
import { ClientsManager } from "@/components/ClientsManager";
import { AppointmentModal } from "@/components/AppointmentModal";
import { Room, Professional, Service, Schedule, Appointment, Client } from "@/types";
import { Sparkles, Calendar, Smartphone, RefreshCw, CheckCircle2 } from "lucide-react";

export default function EsteticaDianaApp() {
  const [activeTab, setActiveTab] = useState<"calendar" | "clients" | "bot" | "services" | "schedules" | "professionals" | "pending">("pending");
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [pendingCount, setPendingCount] = useState(0);

  // Comptem les sol·licituds pendents (per al badge de la pestanya) cada 20s
  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await fetch("/api/bot/pending");
      const data = await res.json();
      if (data.success) setPendingCount(data.pending.length);
    } catch {
      // silenciós
    }
  }, []);

  useEffect(() => {
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 20000);
    return () => clearInterval(interval);
  }, [fetchPendingCount]);

  // Dades principals
  const [rooms, setRooms] = useState<Room[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Carregant
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal de Cites
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null);
  const [initialRoomId, setInitialRoomId] = useState<number | undefined>(undefined);
  const [initialDateForModal, setInitialDateForModal] = useState<string | undefined>(undefined);
  const [initialTime, setInitialTime] = useState<string | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Carregar sales, professionals, serveis, horaris i clientes
  const fetchBaseData = async () => {
    try {
      const [resRooms, resProfs, resServices, resSchedules, resClients] = await Promise.all([
        fetch("/api/rooms"),
        fetch("/api/professionals"),
        fetch("/api/services"),
        fetch("/api/schedules"),
        fetch("/api/clients"),
      ]);

      const [dataRooms, dataProfs, dataServices, dataSchedules, dataClients] = await Promise.all([
        resRooms.json(),
        resProfs.json(),
        resServices.json(),
        resSchedules.json(),
        resClients.json(),
      ]);

      if (dataRooms.success) setRooms(dataRooms.data);
      if (dataProfs.success) setProfessionals(dataProfs.data);
      if (dataServices.success) setServices(dataServices.data);
      if (dataSchedules.success) setSchedules(dataSchedules.data);
      if (dataClients.success) setClients(dataClients.data);
    } catch (err) {
      console.error("Error fetching base data:", err);
    }
  };

  // Carregar cites per al calendari (ampliem rang per cobrir la setmana)
  const fetchAppointments = useCallback(async () => {
    setRefreshing(true);
    try {
      // Carreguem tant per data concreta com un rang de +/- 15 dies per a la vista de setmana
      const [y, m, d] = selectedDate.split("-").map(Number);
      const curr = new Date(y, m - 1, d);
      const startDateObj = new Date(curr);
      startDateObj.setDate(curr.getDate() - 14);
      const endDateObj = new Date(curr);
      endDateObj.setDate(curr.getDate() + 14);

      const startStr = startDateObj.toISOString().split("T")[0];
      const endStr = endDateObj.toISOString().split("T")[0];

      const res = await fetch(`/api/appointments?startDate=${startStr}&endDate=${endStr}`);
      const data = await res.json();
      if (data.success) {
        setAppointments(data.data);
      }
    } catch (err) {
      console.error("Error fetching appointments:", err);
    } finally {
      setRefreshing(false);
      setLoadingInitial(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Gestió del modal de cita
  const handleOpenNewAppointment = (roomId?: number, time?: string, date?: string) => {
    setAppointmentToEdit(null);
    setInitialRoomId(roomId);
    setInitialTime(time || "10:00");
    setInitialDateForModal(date || selectedDate);
    setIsModalOpen(true);
  };

  const handleOpenEditAppointment = (apt: Appointment) => {
    setAppointmentToEdit(apt);
    setInitialRoomId(apt.roomId);
    setInitialTime(apt.startTime);
    setInitialDateForModal(apt.date);
    setIsModalOpen(true);
  };

  const handleSaveAppointment = (saved: Appointment) => {
    fetchAppointments();
    fetchBaseData(); // Actualitza fitxer clientes si cal
    showToast(
      appointmentToEdit
        ? `Cita de ${saved.clientName} modificada correctament!`
        : `Nova cita de ${saved.clientName} afegida a l'agenda!`
    );
  };

  const handleDeleteAppointment = (id: number) => {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    showToast("Cita cancel·lada de l'agenda.");
  };

  // Quan es tria agendar directament des de la fitxa de la clienta
  const handleBookForClient = (client: Client) => {
    setAppointmentToEdit(null);
    setInitialRoomId(rooms[0]?.id || 1);
    setInitialTime("10:00");
    setInitialDateForModal(selectedDate);
    setIsModalOpen(true);
  };

  // Quan el bot reserva una cita des del mòbil
  const handleBotAppointmentBooked = (date: string) => {
    setSelectedDate(date);
    fetchAppointments();
    showToast("Cita agendada pel Bot Mòbil! Ja apareix al calendari de sales.");
  };

  return (
    <div className="min-h-screen bg-[#faf8f6] text-gray-900 flex flex-col font-sans">
      {/* Barra de navegació principal */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewAppointmentClick={() => handleOpenNewAppointment()}
        pendingCount={pendingCount}
      />

      {/* Toast Notificació */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2.5 text-xs font-semibold border border-slate-700 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Contingut Principal segons la pestanya */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loadingInitial ? (
          <div className="min-h-[400px] flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-10 h-10 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-gray-600">
              Carregant l&apos;agenda i les 3 sales d&apos;Estètica Diana...
            </p>
          </div>
        ) : (
          <>
            {/* PESTANYA 0: SOL·LICITUDS PENDENTS DE CONFIRMAR (WHATSAPP REAL) */}
            {activeTab === "pending" && (
              <PendingRequests
                onConfirmed={() => {
                  fetchPendingCount();
                  fetchAppointments();
                  fetchBaseData();
                  showToast("Cita confirmada i clienta avisada per WhatsApp!");
                }}
              />
            )}

            {/* PESTANYA 1: CALENDARI DE SALES (VISTA VISUAL DE DIA I SETMANA AMB LES 3 SALES A LA VEGADA) */}
            {activeTab === "calendar" && (
              <MultiRoomCalendar
                rooms={rooms}
                professionals={professionals}
                services={services}
                appointments={appointments}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onNewAppointment={handleOpenNewAppointment}
                onEditAppointment={handleOpenEditAppointment}
                onRefresh={fetchAppointments}
              />
            )}

            {/* PESTANYA 2: LLISTAT DE CLIENTES (AFEGIR, MODIFICAR, AL·LÈRGIES I PREFERÈNCIES) */}
            {activeTab === "clients" && (
              <ClientsManager
                onSelectClientForBooking={handleBookForClient}
              />
            )}

            {/* PESTANYA 3: SIMULADOR DE MÒBIL (WHATSAPP AMB 3 OPCIONS D'HORARI) */}
            {activeTab === "bot" && (
              <BotSimulatorView
                services={services}
                onAppointmentBooked={handleBotAppointmentBooked}
              />
            )}

            {/* PESTANYA 4: SERVEIS (CREAR, AFEGIR I MODIFICAR) */}
            {activeTab === "services" && (
              <ServicesManager
                services={services}
                rooms={rooms}
                onServicesUpdated={() => {
                  fetchBaseData();
                  showToast("Catàleg de serveis actualitzat!");
                }}
              />
            )}

            {/* PESTANYA 5: HORARIS (AFEGIR I MODIFICAR) */}
            {activeTab === "schedules" && (
              <ScheduleManager
                schedules={schedules}
                onSchedulesUpdated={() => {
                  fetchBaseData();
                  showToast("Horaris actualitzats!");
                }}
              />
            )}

            {/* PESTANYA 6: PROFESSIONALS */}
            {activeTab === "professionals" && (
              <ProfessionalsManager
                professionals={professionals}
                onProfessionalsUpdated={() => {
                  fetchBaseData();
                  showToast("Equip de professionals actualitzat!");
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Modal per Crear o Modificar Cita */}
      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAppointment}
        onDelete={handleDeleteAppointment}
        appointmentToEdit={appointmentToEdit}
        initialRoomId={initialRoomId}
        initialDate={initialDateForModal || selectedDate}
        initialTime={initialTime}
        rooms={rooms}
        professionals={professionals}
        services={services}
        clients={clients}
      />

      {/* Peu de Pàgina */}
      <footer className="bg-white border-t border-rose-100 py-6 mt-12 text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-gray-800">Estètica Diana</span>
            <span>·</span>
            <span>Centre de Bellesa i Salut Integral</span>
            <span>·</span>
            <span className="text-rose-600 font-medium">Tot en català</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>Tel: 689 34 52 10</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
