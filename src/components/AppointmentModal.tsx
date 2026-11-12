"use client";

import React, { useState, useEffect } from "react";
import { groupBySection } from "@/lib/service-catalog";
import { X, Calendar, Clock, User, Scissors, Phone, Mail, FileText, CheckCircle2, AlertCircle, Trash2, Search } from "lucide-react";
import { Room, Professional, Service, Appointment, Client } from "@/types";
import { todayStr } from "@/lib/dates";

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (savedAppointment: Appointment) => void;
  onDelete?: (id: number) => void;
  appointmentToEdit?: Appointment | null;
  initialRoomId?: number;
  initialDate?: string;
  initialTime?: string;
  rooms: Room[];
  professionals: Professional[];
  services: Service[];
  clients?: Client[];
  initialClient?: Client | null;
}

interface ClientTreatmentInfo {
  serviceId: number;
  durationMinutes: number | null;
  professionalId: number | null;
  professionalName: string | null;
  notes: string | null;
}

export function AppointmentModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  appointmentToEdit,
  initialRoomId,
  initialDate,
  initialTime,
  rooms,
  professionals,
  services,
  clients = [],
  initialClient = null,
}: AppointmentModalProps) {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [roomId, setRoomId] = useState<number>(initialRoomId || (rooms[0]?.id ?? 1));
  const [serviceId, setServiceId] = useState<number>(services[0]?.id ?? 1);
  const [professionalId, setProfessionalId] = useState<number>(professionals[0]?.id ?? 1);
  const [date, setDate] = useState<string>(initialDate || todayStr());
  const [startTime, setStartTime] = useState<string>(initialTime || "10:00");
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [price, setPrice] = useState<string>("45.00");
  const [paidCash, setPaidCash] = useState(false);
  const [status, setStatus] = useState<"confirmada" | "pendent" | "completada" | "cancel·lada">("confirmada");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientTreatments, setClientTreatments] = useState<ClientTreatmentInfo[]>([]);
  const [treatmentHint, setTreatmentHint] = useState<string | null>(null);

  // Aplica la durada i la professional pròpies de la clienta per al servei triat
  const applyClientTreatment = (svcId: number, list: ClientTreatmentInfo[]) => {
    const t = list.find((x) => x.serviceId === svcId);
    if (!t) {
      setTreatmentHint(null);
      return;
    }
    if (t.durationMinutes) setDurationMinutes(t.durationMinutes);
    if (t.professionalId) setProfessionalId(t.professionalId);
    const parts = [
      t.durationMinutes ? `${t.durationMinutes} min` : null,
      t.professionalName ? `amb ${t.professionalName}` : null,
      t.notes,
    ].filter(Boolean);
    setTreatmentHint(parts.length ? `Segons la seva fitxa: ${parts.join(" · ")}` : null);
  };

  const loadClientTreatments = async (clientId: number, svcId: number, pickUsualService = false) => {
    try {
      const res = await fetch(`/api/clients/${clientId}/profile`);
      const data = await res.json();
      const list: ClientTreatmentInfo[] = data.success ? data.data.treatments : [];
      setClientTreatments(list);
      // En obrir la cita des de la fitxa, proposem el seu tractament habitual
      const usualId: number | undefined = pickUsualService
        ? (list[0]?.serviceId ?? data.data?.stats?.topServices?.[0]?.serviceId)
        : undefined;
      const usual = usualId ? services.find((s) => s.id === usualId) : undefined;
      if (usual) {
        setServiceId(usual.id);
        setDurationMinutes(usual.durationMinutes);
        setPrice(usual.price);
        if (usual.defaultRoomId) setRoomId(usual.defaultRoomId);
        applyClientTreatment(usual.id, list);
        return;
      }
      applyClientTreatment(svcId, list);
    } catch {
      setClientTreatments([]);
    }
  };

  // Quan canvia l'edició o les dades inicials
  useEffect(() => {
    if (appointmentToEdit) {
      setClientName(appointmentToEdit.clientName);
      setClientPhone(appointmentToEdit.clientPhone);
      setClientEmail(appointmentToEdit.clientEmail || "");
      setSelectedClientId(appointmentToEdit.clientId || null);
      setRoomId(appointmentToEdit.roomId);
      setServiceId(appointmentToEdit.serviceId);
      setProfessionalId(appointmentToEdit.professionalId);
      setDate(appointmentToEdit.date);
      setStartTime(appointmentToEdit.startTime);
      setDurationMinutes(appointmentToEdit.durationMinutes);
      setPrice(appointmentToEdit.price);
      setPaidCash(Boolean(appointmentToEdit.paidCash));
      setStatus(appointmentToEdit.status);
      setNotes(appointmentToEdit.notes || "");
    } else {
      setPaidCash(false);
      setClientName("");
      setClientPhone("");
      setClientEmail("");
      setSelectedClientId(null);
      setRoomId(initialRoomId || (rooms[0]?.id ?? 1));
      const firstService = services[0];
      if (firstService) {
        setServiceId(firstService.id);
        setDurationMinutes(firstService.durationMinutes);
        setPrice(firstService.price);
        if (firstService.defaultRoomId && !initialRoomId) {
          setRoomId(firstService.defaultRoomId);
        }
      }
      setProfessionalId(professionals[0]?.id ?? 1);
      setDate(initialDate || todayStr());
      setStartTime(initialTime || "10:00");
      setStatus("confirmada");
      setNotes("");
      setClientTreatments([]);
      setTreatmentHint(null);
      if (initialClient && isOpen) {
        setSelectedClientId(initialClient.id);
        setClientName(initialClient.name);
        setClientPhone(initialClient.phone);
        setClientEmail(initialClient.email || "");
        loadClientTreatments(initialClient.id, services[0]?.id ?? 0, true);
      }
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentToEdit, initialRoomId, initialDate, initialTime, rooms, professionals, services, isOpen, initialClient]);

  // Si l'usuari tria una clienta habitual del desplegable
  const handleSelectClient = (clientIdStr: string) => {
    if (!clientIdStr) {
      setSelectedClientId(null);
      setClientTreatments([]);
      setTreatmentHint(null);
      return;
    }
    const cId = Number(clientIdStr);
    const found = clients.find((c) => c.id === cId);
    if (found) {
      setSelectedClientId(found.id);
      setClientName(found.name);
      setClientPhone(found.phone);
      setClientEmail(found.email || "");
      if (!appointmentToEdit) loadClientTreatments(found.id, serviceId);
      if (found.allergies || found.preferences) {
        const extra = [found.allergies ? `Al·lèrgies: ${found.allergies}` : null, found.preferences ? `Preferències: ${found.preferences}` : null]
          .filter(Boolean)
          .join(" | ");
        setNotes((prev) => (prev ? `${prev} - ${extra}` : extra));
      }
    }
  };

  const handleServiceChange = (newServiceId: number) => {
    setServiceId(newServiceId);
    const svc = services.find((s) => s.id === newServiceId);
    if (svc) {
      setDurationMinutes(svc.durationMinutes);
      setPrice(svc.price);
      if (svc.defaultRoomId && !appointmentToEdit) {
        setRoomId(svc.defaultRoomId);
      }
    }
    if (!appointmentToEdit) applyClientTreatment(newServiceId, clientTreatments);
  };

  if (!isOpen) return null;

  // Hores desplegables
  const timeOptions: string[] = [];
  for (let h = 9; h <= 20; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 20 && m > 30) continue;
      timeOptions.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  // Cada 5 minuts (fins a 3 hores), més la durada actual si és diferent
  const durationOptions = Array.from({ length: 36 }, (_, i) => (i + 1) * 5);
  if (!durationOptions.includes(durationMinutes)) durationOptions.push(durationMinutes);
  durationOptions.sort((a, b) => a - b);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!clientName.trim() || !clientPhone.trim()) {
      setError("Cal indicar el nom de la clienta i un telèfon de contacte.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        id: appointmentToEdit ? appointmentToEdit.id : undefined,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim() || null,
        clientId: selectedClientId,
        roomId: Number(roomId),
        serviceId: Number(serviceId),
        professionalId: Number(professionalId),
        date,
        startTime,
        durationMinutes: Number(durationMinutes),
        price,
        paidCash,
        status,
        notes: notes.trim() || null,
        source: appointmentToEdit?.source || "manual",
      };

      const res = await fetch("/api/appointments", {
        method: appointmentToEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Error al desar la cita");
        setLoading(false);
        return;
      }

      onSave(data.data);
      onClose();
    } catch (err: unknown) {
      setError("Error de xarxa: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!appointmentToEdit || !onDelete) return;
    if (!confirm("Segur que vols eliminar aquesta cita de l'agenda?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/appointments?id=${appointmentToEdit.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Error al cancel·lar la cita");
        setLoading(false);
        return;
      }
      onDelete(appointmentToEdit.id);
      onClose();
    } catch (err: unknown) {
      setError("Error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-terra-100 overflow-hidden my-8">
        {/* Capçalera */}
        <div className="bg-gradient-to-r from-terra-600 via-arcilla-600 to-terra-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold">
                {appointmentToEdit ? "Modificar Cita d'Estètica" : "Nova Cita a l'Agenda"}
              </h3>
              <p className="text-xs text-terra-100">
                Estètica Diana · Gestió de sales i professionals
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-full hover:bg-white/20 text-white/90 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="m-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Secció Clienta habitual o nova */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-terra-800 flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Dades de la Clienta</span>
              </h4>

              {clients.length > 0 && !appointmentToEdit && (
                <div className="flex items-center space-x-1.5 text-xs text-stone-500">
                  <Search className="w-3.5 h-3.5 text-terra-600" />
                  <span>Triar del fitxer:</span>
                  <select
                    value={selectedClientId ?? ""}
                    onChange={(e) => handleSelectClient(e.target.value)}
                    className="border border-stone-300 rounded-lg px-2 py-0.5 text-xs text-stone-800 bg-white"
                  >
                    <option value="">-- Clienta Registrada --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Nom de la Clienta *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Núria Soler"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500 outline-hidden"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Telèfon Mòbil *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    required
                    placeholder="Ex: 654 11 22 33"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500 outline-hidden"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Correu Electrònic (opcional)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    placeholder="nuria@exemple.cat"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500 outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-stone-100 pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-terra-800 mb-2 flex items-center space-x-1.5">
              <Scissors className="w-3.5 h-3.5" />
              <span>Desplegables de Servei, Sala i Professional</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Desplegable de Serveis */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Servei d&apos;Estètica *
                </label>
                <select
                  value={serviceId}
                  onChange={(e) => handleServiceChange(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500 bg-white"
                >
                  {groupBySection(services.filter((svc) => svc.isActive || svc.id === serviceId)).map(({ section, items }) => (
                    <optgroup key={section.id} label={section.label}>
                      {items.map((svc) => (
                        <option key={svc.id} value={svc.id}>
                          {svc.name} · {svc.durationMinutes} min{Number(svc.price) > 0 ? ` · ${Number(svc.price)} €` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Desplegable de Sales */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Sala / Cabina de Tractament *
                </label>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500 bg-white font-medium"
                >
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Desplegable de Professional que atén */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Professional que Atén *
                </label>
                <select
                  value={professionalId}
                  onChange={(e) => setProfessionalId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500 bg-white font-medium"
                >
                  {professionals.map((prof) => (
                    <option key={prof.id} value={prof.id}>
                      {prof.name} {prof.specialty ? `(${prof.specialty})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Secció Data i Desplegable d'Hores */}
          <div className="border-t border-stone-100 pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-terra-800 mb-2 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Horari i Preu</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Data de la Cita *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500"
                />
              </div>

              {/* Desplegable d'Hores */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Hora d&apos;Inici (Desplegable) *
                </label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500 bg-white font-semibold text-terra-900"
                >
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t} h
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Durada (Minuts)
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500 bg-white"
                >
                  {durationOptions.map((d) => (
                    <option key={d} value={d}>
                      {d} minuts
                    </option>
                  ))}
                </select>
                {treatmentHint && (
                  <p className="mt-1 text-[11px] font-semibold text-terra-700">{treatmentHint}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Preu (€)
                </label>
                <input
                  type="number"
                  step="0.50"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500 font-semibold text-stone-800"
                />
                {/* Per defecte és targeta; només cal marcar quan paga en efectiu */}
                <div className="mt-1.5 flex bg-stone-100 rounded-lg p-0.5 text-[11px] font-bold">
                  {[
                    { cash: false, label: "Targeta" },
                    { cash: true, label: "Efectiu" },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      onClick={() => setPaidCash(o.cash)}
                      className={`flex-1 py-1 rounded-md ${
                        paidCash === o.cash
                          ? o.cash ? "bg-salvia-600 text-white" : "bg-white text-stone-800 shadow-xs"
                          : "text-stone-500"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Estat i Notes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Estat de la Cita
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "confirmada" | "pendent" | "completada" | "cancel·lada")}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500 bg-white"
              >
                <option value="confirmada">✅ Confirmada</option>
                <option value="pendent">⏳ Pendent</option>
                <option value="completada">✨ Completada</option>
                <option value="cancel·lada">❌ Cancel·lada</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Notes / Observacions de la Clienta
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Ex: Al·lèrgica a certs olis, primera vegada, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500"
                />
              </div>
            </div>
          </div>

          {/* Botons Accions */}
          <div className="border-t border-stone-100 pt-4 flex items-center justify-between">
            {appointmentToEdit && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar Cita</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Cancel·lar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center space-x-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-terra-600 to-arcilla-600 hover:from-terra-700 hover:to-arcilla-700 rounded-lg shadow-md hover:shadow-lg transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? "Desant..." : appointmentToEdit ? "Desar Canvis" : "Confirmar Cita"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
