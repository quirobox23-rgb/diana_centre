"use client";

import React, { useState } from "react";
import { User, Plus, Edit2, Phone, Mail, Award, CheckCircle2, AlertCircle, X, Sparkles } from "lucide-react";
import { Professional } from "@/types";

interface ProfessionalsManagerProps {
  professionals: Professional[];
  onProfessionalsUpdated: () => void;
}

export function ProfessionalsManager({ professionals, onProfessionalsUpdated }: ProfessionalsManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<Professional | null>(null);

  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingProf(null);
    setName("");
    setSpecialty("Esteticista & Benestar");
    setPhone("+34 600 00 00 00");
    setEmail("");
    setColor("#8b5cf6");
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (prof: Professional) => {
    setEditingProf(prof);
    setName(prof.name);
    setSpecialty(prof.specialty || "");
    setPhone(prof.phone || "");
    setEmail(prof.email || "");
    setColor(prof.color || "#8b5cf6");
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("El nom del/la professional és obligatori.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        id: editingProf ? editingProf.id : undefined,
        name: name.trim(),
        specialty: specialty.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        color,
      };

      const res = await fetch("/api/professionals", {
        method: editingProf ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Error al desar la informació");
        setLoading(false);
        return;
      }

      setSuccessMsg(editingProf ? "Dades de la professional modificades!" : "Nova professional incorporada a l'equip!");
      setTimeout(() => setSuccessMsg(null), 3000);
      setIsModalOpen(false);
      onProfessionalsUpdated();
    } catch (err: unknown) {
      setError("Error de xarxa: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Capçalera */}
      <div className="bg-white rounded-2xl shadow-xs border border-rose-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span>Equip de Professionals d&apos;Estètica Diana</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Gestiona les esteticistes i terapeutes disponibles als desplegables de l&apos;agenda i de les cites.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-xs transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Afegir Professional</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Graella de Professionals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {professionals.map((prof) => (
          <div
            key={prof.id}
            className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs hover:border-purple-200 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 text-white flex items-center justify-center font-extrabold text-base shadow-sm">
                  {prof.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-100">
                  Activa
                </span>
              </div>

              <h3 className="font-bold text-base text-gray-900">{prof.name}</h3>
              <p className="text-xs text-purple-700 font-semibold mt-0.5 flex items-center space-x-1">
                <Award className="w-3.5 h-3.5" />
                <span>{prof.specialty || "Estètica Integral"}</span>
              </p>

              <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-600">
                {prof.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span>{prof.phone}</span>
                  </div>
                )}
                {prof.email && (
                  <div className="flex items-center space-x-2">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">{prof.email}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-end">
              <button
                onClick={() => openEditModal(prof)}
                className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors flex items-center space-x-1"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Modificar Dades</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-purple-100 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {editingProf ? "Modificar Professional" : "Nova Professional"}
                </h3>
                <p className="text-xs text-purple-100">
                  Estètica Diana · Gestió de l&apos;equip
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
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Nom i Cognoms *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Diana Gómez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Especialitat</label>
                <input
                  type="text"
                  placeholder="Ex: Estètica Avançada i Làser"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Telèfon</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel·lar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-white bg-purple-600 hover:bg-purple-700 rounded-lg font-bold"
                >
                  {loading ? "Desant..." : "Desar Professional"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
