"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Plus,
  Edit2,
  Phone,
  Mail,
  Calendar,
  Heart,
  AlertTriangle,
  FileText,
  X,
  CheckCircle2,
  Trash2,
  Clock,
  Sparkles,
  History,
  Upload,
} from "lucide-react";
import { ImportClientsModal } from "@/components/ImportClientsModal";
import { groupBySection } from "@/lib/service-catalog";

const PAGE_SIZE = 60;
import { Client, ClientStats, ClientTreatment, Professional, Service } from "@/types";

interface ClientsManagerProps {
  onSelectClientForBooking?: (client: Client) => void;
  services?: Service[];
  professionals?: Professional[];
}

const MONTHS = ["gen", "febr", "març", "abr", "maig", "juny", "jul", "ag", "set", "oct", "nov", "des"];
function shortDate(d: string) {
  const [, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]}`;
}

/** Frase curta amb els costums de la clienta: dies, franja i hora habitual. */
function habitsText(stats: ClientStats): string | null {
  if (!stats || stats.totalVisits === 0) return null;
  const parts: string[] = [];
  const days = stats.weekdays.filter((d) => d.count >= 2).slice(0, 2).map((d) => d.dayName.toLowerCase());
  if (days.length) parts.push(`sol venir ${days.join(" i ")}`);
  const { morning, afternoon } = stats.timeOfDay;
  if (stats.totalVisits >= 2) {
    if (morning / stats.totalVisits >= 0.75) parts.push("al matí");
    else if (afternoon / stats.totalVisits >= 0.75) parts.push("a la tarda");
  }
  if (stats.usualTime) parts.push(`cap a les ${stats.usualTime}`);
  return parts.length ? parts.join(", ") : null;
}

export function ClientsManager({ onSelectClientForBooking, services = [], professionals = [] }: ClientsManagerProps) {
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [allergies, setAllergies] = useState("");
  const [preferences, setPreferences] = useState("");
  const [birthday, setBirthday] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [treatments, setTreatments] = useState<ClientTreatment[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  // Amb ~2000 fitxes només en pintem unes quantes; la resta amb «Mostrar-ne més»
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const fetchClients = async (searchQuery = "") => {
    setLoading(true);
    try {
      const url = searchQuery
        ? `/api/clients?summary=1&search=${encodeURIComponent(searchQuery)}`
        : `/api/clients?summary=1`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setClientsList(data.data);
      }
    } catch (err) {
      console.error("Error fetching clients:", err);
    } finally {
      setLoading(false);
    }
  };

  // Esperem que s'acabi d'escriure abans de cercar
  useEffect(() => {
    const t = setTimeout(() => {
      setVisibleCount(PAGE_SIZE);
      fetchClients(searchTerm);
    }, searchTerm ? 300 : 0);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const openCreateModal = () => {
    setEditingClient(null);
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setAllergies("");
    setPreferences("");
    setBirthday("");
    setTreatments([]);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cl: Client) => {
    setEditingClient(cl);
    setName(cl.name);
    setPhone(cl.phone);
    setEmail(cl.email || "");
    setNotes(cl.notes || "");
    setAllergies(cl.allergies || "");
    setPreferences(cl.preferences || "");
    setBirthday(cl.birthday || "");
    setTreatments(cl.summary?.treatments ?? []);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("El nom i el telèfon són camps obligatoris.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: editingClient ? editingClient.id : undefined,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        notes: notes.trim() || null,
        allergies: allergies.trim() || null,
        preferences: preferences.trim() || null,
        birthday: birthday.trim() || null,
      };

      const res = await fetch("/api/clients", {
        method: editingClient ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Error al desar la clienta");
        setSaving(false);
        return;
      }

      // Desem també els tractaments propis (durada i professional)
      const clientId = editingClient ? editingClient.id : data.data?.id;
      if (clientId) {
        const tRes = await fetch(`/api/clients/${clientId}/profile`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ treatments: treatments.filter((t) => t.serviceId) }),
        });
        const tData = await tRes.json();
        if (!tData.success) {
          setError(tData.error || "Error al desar els tractaments");
          setSaving(false);
          return;
        }
      }

      showToast(editingClient ? "Fitxa de la clienta modificada!" : "Nova clienta afegida amb èxit!");
      setIsModalOpen(false);
      fetchClients(searchTerm);
    } catch (err: unknown) {
      setError("Error de connexió: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Vols desactivar aquesta clienta?")) return;
    try {
      const res = await fetch(`/api/clients?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showToast("Clienta desactivada.");
        fetchClients(searchTerm);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Capçalera */}
      <div className="bg-white rounded-2xl shadow-xs border border-terra-100 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 flex items-center space-x-2">
            <Users className="w-5 h-5 text-terra-600" />
            <span>Fitxer de Clientes d&apos;Estètica Diana</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Afegeix, cerca i modifica clientes, al·lèrgies a productes cosmètics i preferències de tractament.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs font-bold text-terra-700 bg-terra-50 hover:bg-terra-100 border border-terra-200 rounded-xl transition-all shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>Importar llistat</span>
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-terra-600 to-arcilla-600 hover:from-terra-700 hover:to-arcilla-700 rounded-xl shadow-xs transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Afegir Nova Clienta</span>
          </button>
        </div>
      </div>

      {/* Barra de cerca */}
      <div className="bg-white rounded-2xl p-3 border border-stone-200 shadow-xs flex items-center space-x-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cercar clienta per nom, telèfon o correu electrònic..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-terra-500 focus:outline-hidden"
          />
        </div>
        <div className="text-xs font-medium text-stone-500 whitespace-nowrap px-2">
          {clientsList.length} clientes trobades
        </div>
      </div>

      {/* Llistat de Clientes */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-2 border-terra-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-stone-500">Carregant fitxes de clientes...</p>
        </div>
      ) : clientsList.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-stone-300">
          <Users className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <h3 className="font-bold text-stone-800 text-sm">Cap clienta trobada</h3>
          <p className="text-xs text-stone-500 mt-1">
            {searchTerm
              ? "No hi ha coincidències amb el text cercat."
              : "Comença afegint la primera clienta d'Estètica Diana."}
          </p>
          <button
            onClick={openCreateModal}
            className="mt-4 px-4 py-2 text-xs font-bold text-white bg-terra-600 rounded-xl hover:bg-terra-700 transition-colors"
          >
            + Afegir Nova Clienta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientsList.slice(0, visibleCount).map((client) => (
            <div
              key={client.id}
              className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs hover:border-terra-200 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-terra-100 to-arcilla-100 text-terra-700 flex items-center justify-center font-black text-sm">
                      {client.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-stone-900 leading-tight">
                        {client.name}
                      </h4>
                      <p className="text-xs text-stone-500 flex items-center space-x-1 mt-0.5">
                        <Phone className="w-3 h-3 text-terra-500" />
                        <span className="font-medium text-stone-700">{client.phone}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => openEditModal(client)}
                    className="p-1.5 text-stone-400 hover:text-terra-600 hover:bg-terra-50 rounded-lg transition-colors"
                    title="Modificar dades"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                {client.email && (
                  <p className="text-xs text-stone-500 flex items-center space-x-1 mt-2.5">
                    <Mail className="w-3 h-3 text-stone-400" />
                    <span>{client.email}</span>
                  </p>
                )}

                {/* Al·lèrgies i Preferències */}
                {(client.allergies || client.preferences) && (
                  <div className="mt-3 space-y-1 text-xs">
                    {client.allergies && (
                      <div className="flex items-start space-x-1.5 bg-red-50 text-red-800 p-2 rounded-lg border border-red-100">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                        <span className="text-[11px] font-medium leading-tight">
                          <strong>Al·lèrgies:</strong> {client.allergies}
                        </span>
                      </div>
                    )}
                    {client.preferences && (
                      <div className="flex items-start space-x-1.5 bg-terra-50 text-terra-800 p-2 rounded-lg border border-terra-100">
                        <Heart className="w-3.5 h-3.5 text-terra-600 shrink-0 mt-0.5" />
                        <span className="text-[11px] font-medium leading-tight">
                          <strong>Preferències:</strong> {client.preferences}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {client.notes && (
                  <div className="mt-2.5 text-xs text-stone-600 italic bg-stone-50 p-2 rounded-lg border border-stone-100">
                    &ldquo;{client.notes}&rdquo;
                  </div>
                )}

                <ClientHabits client={client} />
              </div>

              {/* Botó per agendar directament */}
              <div className="border-t border-stone-100 pt-3 flex items-center justify-between text-xs">
                {onSelectClientForBooking ? (
                  <button
                    onClick={() => onSelectClientForBooking(client)}
                    className="w-full py-1.5 text-xs font-bold text-terra-700 bg-terra-50 hover:bg-terra-100 rounded-lg transition-colors flex items-center justify-center space-x-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Agendar Cita per a {client.name.split(" ")[0]}</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-stone-400">Clienta habitual</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && clientsList.length > visibleCount && (
        <div className="text-center">
          <button
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE * 2)}
            className="px-4 py-2 text-xs font-bold text-terra-700 bg-white border border-terra-200 hover:bg-terra-50 rounded-xl"
          >
            Mostrar-ne més ({clientsList.length - visibleCount} restants)
          </button>
        </div>
      )}

      {importOpen && (
        <ImportClientsModal
          onClose={() => setImportOpen(false)}
          onImported={(created) => {
            setImportOpen(false);
            fetchClients(searchTerm);
            showToast(`${created} clientes importades!`);
          }}
        />
      )}

      {/* Modal Crear o Modificar Clienta */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-terra-100 overflow-hidden my-8">
            <div className="bg-gradient-to-r from-terra-600 to-arcilla-600 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {editingClient ? "Modificar Clienta" : "Nova Fitxa de Clienta"}
                </h3>
                <p className="text-xs text-terra-100">
                  Estètica Diana · Base de dades de clientes
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="m-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Nom i Cognoms *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Núria Soler i Vidal"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Telèfon Mòbil *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ex: 654 11 22 33"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Correu Electrònic</label>
                  <input
                    type="email"
                    placeholder="nuria@exemple.cat"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Data d&apos;Aniversari</label>
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-red-700 mb-1 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Al·lèrgies i Advertències Cosmètiques</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Al·lèrgica a l'oli d'ametlles o al làtex, pell reactiva..."
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-red-200 bg-red-50/30 rounded-lg focus:ring-2 focus:ring-red-400"
                />
              </div>

              <div>
                <label className="block font-medium text-terra-800 mb-1 flex items-center space-x-1">
                  <Heart className="w-3.5 h-3.5" />
                  <span>Preferències de Tractament</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Prefereix cabina amb música suau, colors neutres en ungles..."
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-terra-200 bg-terra-50/30 rounded-lg focus:ring-2 focus:ring-terra-400"
                />
              </div>

              <TreatmentsEditor
                treatments={treatments}
                onChange={setTreatments}
                services={services}
                professionals={professionals}
                stats={editingClient?.summary?.stats}
              />

              <div>
                <label className="block font-medium text-stone-700 mb-1">Notes Generals</label>
                <textarea
                  rows={2}
                  placeholder="Comentaris interns o recomanacions per a les esteticistes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500"
                />
              </div>

              <div className="border-t border-stone-100 pt-3 flex items-center justify-between">
                {editingClient ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingClient.id)}
                    className="text-red-600 hover:text-red-700 font-semibold"
                  >
                    Desactivar Clienta
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg"
                  >
                    Cancel·lar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 text-white bg-terra-600 hover:bg-terra-700 rounded-lg font-bold shadow-xs"
                  >
                    {saving ? "Desant..." : editingClient ? "Desar Canvis" : "Crear Clienta"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/** Tractaments habituals i costums a la targeta de la clienta. */
function ClientHabits({ client }: { client: Client }) {
  const summary = client.summary;
  if (!summary) return null;
  const { stats, treatments } = summary;

  // Primer els tractaments de la fitxa (amb la seva durada), després els més repetits de l'historial
  const chips: { key: string; label: string; detail: string }[] = treatments.map((t) => ({
    key: `t${t.serviceId}`,
    label: t.serviceName || "Servei",
    detail: [t.durationMinutes ? `${t.durationMinutes} min` : null, t.professionalName].filter(Boolean).join(" · "),
  }));
  for (const s of stats.topServices.slice(0, 3)) {
    if (treatments.some((t) => t.serviceId === s.serviceId)) continue;
    chips.push({ key: `s${s.serviceId}`, label: s.serviceName, detail: `${s.count}× · ${s.avgDuration} min` });
  }
  const habits = habitsText(stats);
  if (chips.length === 0 && !habits && stats.totalVisits === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {chips.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-1">Tractaments habituals</p>
          <div className="flex flex-wrap gap-1.5">
            {chips.slice(0, 4).map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-arcilla-50 border border-arcilla-200 text-[11px] text-arcilla-900">
                <Sparkles className="w-3 h-3 text-arcilla-600" />
                <span className="font-semibold">{c.label}</span>
                {c.detail && <span className="text-arcilla-700">· {c.detail}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
      {(habits || stats.totalVisits > 0) && (
        <p className="text-[11px] text-stone-600 flex items-start gap-1.5">
          <History className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-px" />
          <span>
            {stats.totalVisits} {stats.totalVisits === 1 ? "visita" : "visites"}
            {stats.lastVisit && <> · última el {shortDate(stats.lastVisit)}</>}
            {habits && <> · {habits}</>}
          </span>
        </p>
      )}
    </div>
  );
}

/** Editor de tractaments propis de la clienta dins del formulari. */
function TreatmentsEditor({
  treatments,
  onChange,
  services,
  professionals,
  stats,
}: {
  treatments: ClientTreatment[];
  onChange: (t: ClientTreatment[]) => void;
  services: Service[];
  professionals: Professional[];
  stats?: ClientStats;
}) {
  const update = (idx: number, patch: Partial<ClientTreatment>) =>
    onChange(treatments.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  const remove = (idx: number) => onChange(treatments.filter((_, i) => i !== idx));
  const add = () => {
    const used = new Set(treatments.map((t) => t.serviceId));
    const next = services.find((s) => !used.has(s.id));
    onChange([...treatments, { serviceId: next?.id ?? 0, durationMinutes: null, professionalId: null, notes: null }]);
  };
  const fillFromHistory = () => {
    if (!stats) return;
    const used = new Set(treatments.map((t) => t.serviceId));
    const extra = stats.topServices
      .filter((s) => !used.has(s.serviceId))
      .map((s) => ({ serviceId: s.serviceId, durationMinutes: s.avgDuration, professionalId: null, notes: null }));
    onChange([...treatments, ...extra]);
  };
  const habits = stats ? habitsText(stats) : null;

  return (
    <div className="rounded-xl border border-arcilla-200 bg-arcilla-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <label className="font-medium text-arcilla-900 flex items-center space-x-1">
          <Clock className="w-3.5 h-3.5" />
          <span>Tractaments i durades d&apos;aquesta clienta</span>
        </label>
        {stats && stats.topServices.length > 0 && (
          <button type="button" onClick={fillFromHistory} className="text-[11px] font-semibold text-terra-700 hover:underline">
            Omplir des de l&apos;historial
          </button>
        )}
      </div>
      <p className="text-[11px] text-stone-500">
        Si a aquesta clienta un tractament li porta més o menys temps, posa-ho aquí. S&apos;aplicarà en crear-li cites i a les hores que li proposi el bot.
      </p>

      {stats && stats.totalVisits > 0 && (
        <div className="text-[11px] text-stone-600 bg-white rounded-lg border border-stone-200 p-2 space-y-0.5">
          <p>
            <strong>{stats.totalVisits}</strong> {stats.totalVisits === 1 ? "visita" : "visites"}
            {stats.lastVisit && <> · última el {shortDate(stats.lastVisit)}</>}
            {stats.topProfessional && <> · sobretot amb {stats.topProfessional.professionalName}</>}
          </p>
          {stats.topServices.length > 0 && (
            <p>Més freqüents: {stats.topServices.slice(0, 3).map((s) => `${s.serviceName} (${s.count}×)`).join(", ")}</p>
          )}
          {habits && <p>Costums: {habits}</p>}
        </div>
      )}

      {treatments.map((t, idx) => {
        const svc = services.find((s) => s.id === t.serviceId);
        return (
          <div key={idx} className="grid grid-cols-12 gap-1.5 items-center bg-white rounded-lg border border-stone-200 p-2">
            <select
              value={t.serviceId || ""}
              onChange={(e) => update(idx, { serviceId: Number(e.target.value) })}
              className="col-span-12 sm:col-span-5 px-2 py-1.5 border border-stone-300 rounded-lg bg-white"
            >
              <option value="">Tria el tractament…</option>
              {groupBySection(services.filter((s) => s.isActive || s.id === t.serviceId)).map(({ section, items }) => (
                <optgroup key={section.id} label={section.label}>
                  {items.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="col-span-4 sm:col-span-2 flex items-center gap-1">
              <input
                type="number"
                min={5}
                max={600}
                step={5}
                placeholder={svc ? String(svc.durationMinutes) : "min"}
                value={t.durationMinutes ?? ""}
                onChange={(e) => update(idx, { durationMinutes: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-2 py-1.5 border border-stone-300 rounded-lg"
                title="Durada en minuts"
              />
              <span className="text-stone-400">min</span>
            </div>
            <select
              value={t.professionalId ?? ""}
              onChange={(e) => update(idx, { professionalId: e.target.value ? Number(e.target.value) : null })}
              className="col-span-7 sm:col-span-4 px-2 py-1.5 border border-stone-300 rounded-lg bg-white"
            >
              <option value="">Qualsevol professional</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="col-span-1 p-1 text-stone-400 hover:text-red-600 justify-self-end"
              title="Treure"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <input
              type="text"
              placeholder="Nota (opcional): ex. zona petita, només aixelles…"
              value={t.notes ?? ""}
              onChange={(e) => update(idx, { notes: e.target.value })}
              className="col-span-12 px-2 py-1.5 border border-stone-200 rounded-lg text-[11px]"
            />
          </div>
        );
      })}

      <button
        type="button"
        onClick={add}
        className="w-full py-1.5 text-[11px] font-bold text-terra-700 bg-white border border-dashed border-terra-300 rounded-lg hover:bg-terra-50"
      >
        + Afegir tractament
      </button>
    </div>
  );
}
