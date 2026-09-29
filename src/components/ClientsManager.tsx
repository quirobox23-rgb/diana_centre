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
} from "lucide-react";
import { Client } from "@/types";

interface ClientsManagerProps {
  onSelectClientForBooking?: (client: Client) => void;
}

export function ClientsManager({ onSelectClientForBooking }: ClientsManagerProps) {
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

  const fetchClients = async (searchQuery = "") => {
    setLoading(true);
    try {
      const url = searchQuery
        ? `/api/clients?search=${encodeURIComponent(searchQuery)}`
        : `/api/clients`;
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

  useEffect(() => {
    fetchClients(searchTerm);
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
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Capçalera */}
      <div className="bg-white rounded-2xl shadow-xs border border-rose-100 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
            <Users className="w-5 h-5 text-rose-600" />
            <span>Fitxer de Clientes d&apos;Estètica Diana</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Afegeix, cerca i modifica clientes, al·lèrgies a productes cosmètics i preferències de tractament.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 rounded-xl shadow-xs transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Afegir Nova Clienta</span>
          </button>
        </div>
      </div>

      {/* Barra de cerca */}
      <div className="bg-white rounded-2xl p-3 border border-gray-200 shadow-xs flex items-center space-x-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cercar clienta per nom, telèfon o correu electrònic..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
          />
        </div>
        <div className="text-xs font-medium text-gray-500 whitespace-nowrap px-2">
          {clientsList.length} clientes trobades
        </div>
      </div>

      {/* Llistat de Clientes */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-2 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500">Carregant fitxes de clientes...</p>
        </div>
      ) : clientsList.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-300">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <h3 className="font-bold text-gray-800 text-sm">Cap clienta trobada</h3>
          <p className="text-xs text-gray-500 mt-1">
            {searchTerm
              ? "No hi ha coincidències amb el text cercat."
              : "Comença afegint la primera clienta d'Estètica Diana."}
          </p>
          <button
            onClick={openCreateModal}
            className="mt-4 px-4 py-2 text-xs font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors"
          >
            + Afegir Nova Clienta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientsList.map((client) => (
            <div
              key={client.id}
              className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs hover:border-rose-200 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-100 to-pink-100 text-rose-700 flex items-center justify-center font-black text-sm">
                      {client.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-900 leading-tight">
                        {client.name}
                      </h4>
                      <p className="text-xs text-gray-500 flex items-center space-x-1 mt-0.5">
                        <Phone className="w-3 h-3 text-rose-500" />
                        <span className="font-medium text-gray-700">{client.phone}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => openEditModal(client)}
                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Modificar dades"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                {client.email && (
                  <p className="text-xs text-gray-500 flex items-center space-x-1 mt-2.5">
                    <Mail className="w-3 h-3 text-gray-400" />
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
                      <div className="flex items-start space-x-1.5 bg-rose-50 text-rose-800 p-2 rounded-lg border border-rose-100">
                        <Heart className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <span className="text-[11px] font-medium leading-tight">
                          <strong>Preferències:</strong> {client.preferences}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {client.notes && (
                  <div className="mt-2.5 text-xs text-gray-600 italic bg-stone-50 p-2 rounded-lg border border-stone-100">
                    &ldquo;{client.notes}&rdquo;
                  </div>
                )}
              </div>

              {/* Botó per agendar directament */}
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between text-xs">
                {onSelectClientForBooking ? (
                  <button
                    onClick={() => onSelectClientForBooking(client)}
                    className="w-full py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center justify-center space-x-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Agendar Cita per a {client.name.split(" ")[0]}</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-gray-400">Clienta habitual</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear o Modificar Clienta */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-rose-100 overflow-hidden my-8">
            <div className="bg-gradient-to-r from-rose-600 to-pink-600 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {editingClient ? "Modificar Clienta" : "Nova Fitxa de Clienta"}
                </h3>
                <p className="text-xs text-rose-100">
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
                  <label className="block font-medium text-gray-700 mb-1">Nom i Cognoms *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Núria Soler i Vidal"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Telèfon Mòbil *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ex: 654 11 22 33"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Correu Electrònic</label>
                  <input
                    type="email"
                    placeholder="nuria@exemple.cat"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Data d&apos;Aniversari</label>
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
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
                <label className="block font-medium text-rose-800 mb-1 flex items-center space-x-1">
                  <Heart className="w-3.5 h-3.5" />
                  <span>Preferències de Tractament</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Prefereix cabina amb música suau, colors neutres en ungles..."
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-rose-200 bg-rose-50/30 rounded-lg focus:ring-2 focus:ring-rose-400"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Notes Generals</label>
                <textarea
                  rows={2}
                  placeholder="Comentaris interns o recomanacions per a les esteticistes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
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
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel·lar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 text-white bg-rose-600 hover:bg-rose-700 rounded-lg font-bold shadow-xs"
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
