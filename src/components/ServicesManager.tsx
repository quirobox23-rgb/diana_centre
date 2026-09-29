"use client";

import React, { useState } from "react";
import { Plus, Edit2, Trash2, Scissors, Clock, DollarSign, Layers, CheckCircle2, AlertCircle, X, Sparkles } from "lucide-react";
import { Service, Room } from "@/types";

interface ServicesManagerProps {
  services: Service[];
  rooms: Room[];
  onServicesUpdated: () => void;
}

export function ServicesManager({ services, rooms, onServicesUpdated }: ServicesManagerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("Tots");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Facial");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [price, setPrice] = useState("45.00");
  const [description, setDescription] = useState("");
  const [defaultRoomId, setDefaultRoomId] = useState<number | null>(rooms[0]?.id || 1);
  const [color, setColor] = useState("#ec4899");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const categories = ["Tots", "Facial", "Corporal", "Depilació", "Mans i Peus", "Benestar", "Mirada"];

  const openCreateModal = () => {
    setEditingService(null);
    setName("");
    setCategory("Facial");
    setDurationMinutes(60);
    setPrice("50.00");
    setDescription("");
    setDefaultRoomId(rooms[0]?.id || 1);
    setColor("#ec4899");
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (svc: Service) => {
    setEditingService(svc);
    setName(svc.name);
    setCategory(svc.category);
    setDurationMinutes(svc.durationMinutes);
    setPrice(svc.price);
    setDescription(svc.description || "");
    setDefaultRoomId(svc.defaultRoomId);
    setColor(svc.color || "#ec4899");
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("El nom del servei és obligatori.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        id: editingService ? editingService.id : undefined,
        name: name.trim(),
        category,
        durationMinutes: Number(durationMinutes),
        price,
        description: description.trim() || null,
        defaultRoomId: defaultRoomId ? Number(defaultRoomId) : null,
        color,
      };

      const res = await fetch("/api/services", {
        method: editingService ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Error al desar el servei");
        setLoading(false);
        return;
      }

      setSuccessMsg(editingService ? "Servei modificat amb èxit!" : "Nou servei afegit correctament!");
      setTimeout(() => setSuccessMsg(null), 3000);
      setIsModalOpen(false);
      onServicesUpdated();
    } catch (err: unknown) {
      setError("Error de connexió: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Vols eliminar o desactivar aquest servei del catàleg?")) return;

    try {
      const res = await fetch(`/api/services?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        onServicesUpdated();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredServices = services.filter((s) => {
    if (selectedCategory === "Tots") return true;
    return s.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  return (
    <div className="space-y-6">
      {/* Barra de controls i acció de crear */}
      <div className="bg-white rounded-2xl shadow-xs border border-rose-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-rose-600" />
            <span>Catàleg de Tractaments i Serveis d&apos;Estètica</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Crea, afegeix i modifica tractaments, preus, durades i cabines assignades.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 rounded-xl shadow-xs transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Afegir Nou Servei</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filtre per categories */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              selectedCategory === cat
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Graella de Serveis */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServices.map((svc) => (
          <div
            key={svc.id}
            className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs hover:border-rose-200 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-100">
                  {svc.category}
                </span>
                <span className="text-base font-extrabold text-gray-900 bg-stone-100 px-2.5 py-1 rounded-lg">
                  {svc.price} €
                </span>
              </div>

              <h3 className="font-bold text-base text-gray-900 leading-snug">{svc.name}</h3>

              {svc.description && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-3 leading-relaxed">
                  {svc.description}
                </p>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2 text-xs text-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-gray-500">
                  <Clock className="w-3.5 h-3.5 text-rose-500" />
                  <span>Durada: {svc.durationMinutes} minuts</span>
                </div>
                <div className="flex items-center space-x-1.5 text-purple-700 font-medium">
                  <Layers className="w-3.5 h-3.5" />
                  <span>{svc.roomName || "Cabina per defecte"}</span>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  onClick={() => openEditModal(svc)}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center space-x-1"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Modificar</span>
                </button>
                <button
                  onClick={() => handleDelete(svc.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Crear o Modificar Servei */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-rose-100 overflow-hidden my-8">
            <div className="bg-gradient-to-r from-rose-600 to-pink-600 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {editingService ? "Modificar Servei" : "Crear Nou Servei"}
                </h3>
                <p className="text-xs text-rose-100">
                  Catàleg de tractaments d&apos;Estètica Diana
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="m-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Nom del Tractament *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Peeling Químic Rejuvenidor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white"
                  >
                    <option value="Facial">Facial</option>
                    <option value="Corporal">Corporal</option>
                    <option value="Depilació">Depilació Làser</option>
                    <option value="Mans i Peus">Mans i Peus</option>
                    <option value="Benestar">Benestar & Massatges</option>
                    <option value="Mirada">Mirada & Pestanyes</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Preu (€) *</label>
                  <input
                    type="number"
                    step="0.50"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Durada (Minuts)</label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white"
                  >
                    <option value={15}>15 minuts</option>
                    <option value={30}>30 minuts</option>
                    <option value={45}>45 minuts</option>
                    <option value={60}>60 minuts (1 hora)</option>
                    <option value={75}>75 minuts</option>
                    <option value={90}>90 minuts</option>
                    <option value={120}>120 minuts (2 hores)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Sala / Cabina habitual</label>
                  <select
                    value={defaultRoomId || ""}
                    onChange={(e) => setDefaultRoomId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Descripció del Servei</label>
                <textarea
                  rows={3}
                  placeholder="Detalls del tractament, beneficis per a la pell o aparatologia emprada..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1.5">Color del Tractament</label>
                <p className="text-[11px] text-gray-400 mb-2">Aquest color identifica el servei al calendari, sigui quina sigui la sala.</p>
                <div className="flex items-center flex-wrap gap-2">
                  {["#ec4899", "#f43f5e", "#a855f7", "#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#84cc16", "#f59e0b", "#f97316"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition-all ${
                        color === c ? "ring-2 ring-offset-2 ring-gray-800 scale-110" : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  <div className="relative w-7 h-7">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-7 h-7 rounded-full cursor-pointer border border-gray-200 p-0"
                      title="Color personalitzat"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel·lar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-white bg-rose-600 hover:bg-rose-700 rounded-lg font-bold shadow-xs transition-colors"
                >
                  {loading ? "Desant..." : editingService ? "Desar Canvis" : "Afegir Servei"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
