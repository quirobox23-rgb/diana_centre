"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { MultiRoomCalendar } from "@/components/MultiRoomCalendar";
import { PendingRequests } from "@/components/PendingRequests";
import { OfficeView } from "@/components/OfficeView";
import { ServicesManager } from "@/components/ServicesManager";
import { ScheduleManager } from "@/components/ScheduleManager";
import { ProfessionalsManager } from "@/components/ProfessionalsManager";
import { ClientsManager } from "@/components/ClientsManager";
import { ClientAlerts } from "@/components/ClientAlerts";
import { ProfessionalSummary } from "@/components/ProfessionalSummary";
import { GiftVouchersManager } from "@/components/GiftVouchersManager";
import { StockManager } from "@/components/StockManager";
import { OwnerLockModal, LockMode } from "@/components/OwnerLock";
import { AppointmentModal } from "@/components/AppointmentModal";
import { Room, Professional, Service, Schedule, Appointment, Client, AppointmentStatus } from "@/types";
import { CheckCircle2 } from "lucide-react";
import { addDays, todayStr } from "@/lib/dates";

export default function EsteticaDianaApp() {
  const [activeTab, setActiveTab] = useState<"calendar" | "clients" | "office" | "services" | "schedules" | "professionals" | "pending" | "summary" | "vouchers" | "stock">("pending");
  // Candado de la dueña: obre els imports del Resum i anul·lar xecs regal
  const [lock, setLock] = useState({ configured: true, unlocked: false });
  const [lockModal, setLockModal] = useState<{ mode: LockMode; then?: () => void } | null>(null);
  const isAdmin = lock.unlocked;

  const refreshLock = useCallback(async () => {
    try {
      const res = await fetch("/api/owner-lock", { cache: "no-store" });
      const d = await res.json();
      if (d.success) setLock({ configured: d.configured, unlocked: d.unlocked });
    } catch {
      // silenciós
    }
  }, []);

  useEffect(() => {
    refreshLock();
    // Es torna a tancar sol: ho comprovem cada minut
    const interval = setInterval(refreshLock, 60000);
    return () => clearInterval(interval);
  }, [refreshLock]);

  const requireOwner = async (then?: () => void) => {
    if (lock.unlocked) {
      then?.();
      return;
    }
    // Mirem l'estat real abans d'obrir la finestra (si ja hi ha clau o s'ha de crear)
    let configured = lock.configured;
    try {
      const res = await fetch("/api/owner-lock", { cache: "no-store" });
      const d = await res.json();
      if (d.success) {
        configured = d.configured;
        setLock({ configured: d.configured, unlocked: d.unlocked });
        if (d.unlocked) {
          then?.();
          return;
        }
      }
    } catch {
      // fem servir el que ja sabíem
    }
    setLockModal({ mode: configured ? "unlock" : "setup", then });
  };

  const closeLock = async () => {
    await fetch("/api/owner-lock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lock" }) });
    setLock((l) => ({ ...l, unlocked: false }));
  };
  const [selectedDate, setSelectedDate] = useState<string>(() => todayStr());
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
  const [clientForModal, setClientForModal] = useState<Client | null>(null);
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null);
  const [initialRoomId, setInitialRoomId] = useState<number | undefined>(undefined);
  const [initialDateForModal, setInitialDateForModal] = useState<string | undefined>(undefined);
  const [initialTime, setInitialTime] = useState<string | undefined>(undefined);
  const [rebookService, setRebookService] = useState<{ serviceId: number; professionalId: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastAction, setToastAction] = useState<{ label: string; run: () => void } | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, action?: { label: string; run: () => void }) => {
    setToastMessage(msg);
    setToastAction(action ?? null);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToastMessage(null);
      setToastAction(null);
    }, action ? 8000 : 3500);
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
      const startStr = addDays(selectedDate, -14);
      const endStr = addDays(selectedDate, 14);

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

  // En obrir o tancar el candado es tornen a carregar les cites (amb o sense imports)
  useEffect(() => {
    if (!loadingInitial) fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lock.unlocked]);

  useEffect(() => {
    fetchAppointments();
    // Si es confirma o canvia una cita des d'un altre mòbil, aquí també es veu sense haver de tocar res
    const refresh = () => {
      if (document.visibilityState === "visible") fetchAppointments();
    };
    const interval = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [fetchAppointments]);

  // Gestió del modal de cita
  const handleOpenNewAppointment = (roomId?: number, time?: string, date?: string) => {
    setRebookService(null);
    setAppointmentToEdit(null);
    setClientForModal(null);
    setInitialRoomId(roomId);
    setInitialTime(time || "10:00");
    setInitialDateForModal(date || selectedDate);
    setIsModalOpen(true);
  };

  const handleOpenEditAppointment = (apt: Appointment) => {
    setRebookService(null);
    setAppointmentToEdit(apt);
    setClientForModal(null);
    setInitialRoomId(apt.roomId);
    setInitialTime(apt.startTime);
    setInitialDateForModal(apt.date);
    setIsModalOpen(true);
  };

  const handleSaveAppointment = (saved: Appointment, createdClient?: boolean) => {
    fetchAppointments();
    if (createdClient) fetchBaseData(); // Només cal recarregar les fitxes si se n'ha creat una de nova

    // Cita acabada: proposem reservar ja la propera (d'aquí a 4 setmanes, a la mateixa hora)
    if (saved.status === "completada" && appointmentToEdit?.status !== "completada") {
      const client =
        clients.find((c) => c.id === saved.clientId) ||
        clients.find((c) => c.phone.replace(/\D/g, "").slice(-9) === saved.clientPhone.replace(/\D/g, "").slice(-9));
      const next = addDays(saved.date, 28);
      showToast(`Cita de ${saved.clientName} tancada.`, client ? {
        label: `Reservar la propera (${Number(next.slice(8))}/${Number(next.slice(5, 7))})`,
        run: () => {
          setAppointmentToEdit(null);
          setClientForModal(client);
          setRebookService({ serviceId: saved.serviceId, professionalId: saved.professionalId });
          setInitialRoomId(saved.roomId);
          setInitialTime(saved.startTime);
          setInitialDateForModal(next);
          setIsModalOpen(true);
        },
      } : undefined);
      return;
    }

    showToast(
      appointmentToEdit
        ? `Cita de ${saved.clientName} modificada correctament!`
        : createdClient
          ? `Nova cita de ${saved.clientName} afegida i guardada com a clienta nova!`
          : `Nova cita de ${saved.clientName} afegida a l'agenda!`
    );
  };

  // Cancel·lar no esborra: es pot desfer durant uns segons des del missatge
  const handleDeleteAppointment = (apt: Appointment, previousStatus: AppointmentStatus) => {
    setAppointments((prev) => prev.map((a) => (a.id === apt.id ? { ...a, status: "cancel·lada" } : a)));
    showToast(`Cita de ${apt.clientName} cancel·lada.`, {
      label: "Desfer",
      run: async () => {
        const res = await fetch("/api/appointments", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: apt.id, status: previousStatus === "cancel·lada" ? "confirmada" : previousStatus }),
        });
        const data = await res.json().catch(() => ({}));
        fetchAppointments();
        showToast(data.success ? "Cita recuperada." : data.error || "No s'ha pogut recuperar la cita.");
      },
    });
  };

  // Quan es tria agendar directament des de la fitxa de la clienta
  const handleBookForClient = (client: Client) => {
    setRebookService(null);
    setAppointmentToEdit(null);
    setClientForModal(client);
    setInitialRoomId(rooms[0]?.id || 1);
    setInitialTime("10:00");
    setInitialDateForModal(selectedDate);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-sorra text-stone-900 flex flex-col font-sans">
      {/* Barra de navegació principal */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewAppointmentClick={() => handleOpenNewAppointment()}
        pendingCount={pendingCount}
        ownerUnlocked={lock.unlocked}
        onLockClick={() => (lock.unlocked ? closeLock() : requireOwner())}
        onChangeKey={() => setLockModal({ mode: "change" })}
      />

      {lockModal && (
        <OwnerLockModal
          mode={lockModal.mode}
          onClose={() => setLockModal(null)}
          onUnlocked={() => {
            const then = lockModal.then;
            setLockModal(null);
            setLock({ configured: true, unlocked: true });
            then?.();
          }}
        />
      )}

      {/* Toast Notificació */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2.5 text-xs font-semibold border border-stone-700 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          {toastAction && (
            <button
              onClick={() => {
                const a = toastAction;
                setToastAction(null);
                a.run();
              }}
              className="ml-2 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-amber-200 font-bold"
            >
              {toastAction.label}
            </button>
          )}
        </div>
      )}

      {/* Contingut Principal segons la pestanya */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loadingInitial ? (
          <div className="min-h-[400px] flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-10 h-10 border-3 border-terra-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-stone-600">
              Carregant l&apos;agenda i les 3 sales d&apos;Estètica Diana...
            </p>
          </div>
        ) : (
          <>
            {/* PESTANYA 0: SOL·LICITUDS PENDENTS DE CONFIRMAR (WHATSAPP REAL) */}
            {activeTab === "pending" && (
              <PendingRequests
                services={services}
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
                canSeeMoney={isAdmin}
              />
            )}

            {/* PESTANYA 2: LLISTAT DE CLIENTES (AFEGIR, MODIFICAR, AL·LÈRGIES I PREFERÈNCIES) */}
            {activeTab === "clients" && <ClientAlerts />}
            {activeTab === "clients" && (
              <ClientsManager
                onSelectClientForBooking={handleBookForClient}
                services={services}
                professionals={professionals}
              />
            )}

            {/* RESUM PER PROFESSIONAL */}
            {activeTab === "summary" &&
              <ProfessionalSummary professionals={professionals} canSeeMoney={isAdmin} onRequestUnlock={requireOwner} />}

            {activeTab === "stock" && <StockManager />}

            {activeTab === "vouchers" && <GiftVouchersManager services={services} isAdmin={isAdmin} onRequestUnlock={requireOwner} />}

            {/* OFICINA: LES 3 CABINES I L'AURA A RECEPCIÓ */}
            {activeTab === "office" && (
              <OfficeView
                rooms={rooms}
                professionals={professionals}
                schedules={schedules}
                onOpenPending={() => setActiveTab("pending")}
                onEditAppointment={handleOpenEditAppointment}
              />
            )}

            {/* PESTANYA 4: SERVEIS (CREAR, AFEGIR I MODIFICAR) */}
            {activeTab === "services" && (
              <ServicesManager
                services={services}
                rooms={rooms}
                professionals={professionals}
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
                rooms={rooms}
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
        initialClient={clientForModal}
        schedules={schedules}
        canSeeMoney={isAdmin}
        initialServiceId={rebookService?.serviceId}
        initialProfessionalId={rebookService?.professionalId}
      />

      {/* Peu de Pàgina */}
      <footer className="bg-white border-t border-terra-100 py-6 mt-12 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-stone-800">Estètica Diana</span>
            <span>·</span>
            <span>Centre de Bellesa i Salut Integral</span>
            <span>·</span>
            <span className="text-terra-600 font-medium">Tot en català</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>Tel: 689 34 52 10</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
