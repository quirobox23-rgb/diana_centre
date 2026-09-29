"use client";

import React, { useState, useEffect, useCallback } from "react";
import { MessageCircle, Clock, Calendar, User, Phone, CheckCircle2, X, RefreshCw, AlertCircle } from "lucide-react";
import { ProposedSlot } from "@/types";

interface PendingRequest {
  id: number;
  clientName: string;
  clientPhone: string;
  incomingMessage: string;
  proposedSlots: string | null;
  selectedSlotIndex: number | null;
  createdAt: string;
}

interface PendingRequestsProps {
  onConfirmed: () => void;
}

export function PendingRequests({ onConfirmed }: PendingRequestsProps) {
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bot/pending");
      const data = await res.json();
      if (data.success) setPending(data.pending);
    } catch {
      // silenciós — es reintentarà al proper refresc
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000); // refresc cada 20s
    return () => clearInterval(interval);
  }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleConfirm = async (req: PendingRequest) => {
    if (req.selectedSlotIndex === null || req.selectedSlotIndex === undefined) return;
    setConfirmingId(req.id);
    try {
      const res = await fetch("/api/bot/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulationId: req.id, slotIndex: req.selectedSlotIndex }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.whatsappSent ? "Cita confirmada i WhatsApp enviat ✅" : "Cita confirmada (no s'ha pogut enviar el WhatsApp)");
        setPending(prev => prev.filter(p => p.id !== req.id));
        onConfirmed();
      } else {
        showToast(data.error || "Error al confirmar");
      }
    } catch {
      showToast("Error de connexió al confirmar");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleDismiss = async (id: number) => {
    if (!confirm("Descartar aquesta sol·licitud? La clienta NO rebrà cap confirmació.")) return;
    try {
      await fetch(`/api/bot/pending?id=${id}`, { method: "DELETE" });
      setPending(prev => prev.filter(p => p.id !== id));
    } catch {
      showToast("Error al descartar");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Carregant sol·licituds...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <div className="flex items-center gap-2 mb-1">
        <MessageCircle className="w-6 h-6 text-rose-600" />
        <h2 className="text-xl font-bold text-gray-900">Sol·licituds pendents de confirmar</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Clientes que han escrit per WhatsApp i ja han triat un horari. Revisa i confirma per assignar la cita definitivament.
      </p>

      {pending.length === 0 && (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <CheckCircle2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400">No hi ha cap sol·licitud pendent ara mateix 🎉</p>
        </div>
      )}

      <div className="space-y-4">
        {pending.map(req => {
          const slots: ProposedSlot[] = req.proposedSlots ? JSON.parse(req.proposedSlots) : [];
          const slot = req.selectedSlotIndex !== null ? slots[req.selectedSlotIndex] : null;

          return (
            <div key={req.id} className="bg-white border-2 border-rose-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />
              <div className="pl-2">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-gray-900">
                      <User className="w-4 h-4 text-rose-500" /> {req.clientName}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                      <Phone className="w-3 h-3" /> {req.clientPhone}
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 px-2 py-1 rounded-full">
                    <AlertCircle className="w-3 h-3" /> Pendent
                  </span>
                </div>

                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 mb-3 italic">"{req.incomingMessage}"</p>

                {slot ? (
                  <div className="flex items-center gap-4 bg-rose-50 rounded-lg p-3 mb-3 text-sm">
                    <div className="flex items-center gap-1.5 text-gray-800 font-medium">
                      <Calendar className="w-4 h-4 text-rose-500" /> {slot.displayDate}
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-800 font-medium">
                      <Clock className="w-4 h-4 text-rose-500" /> {slot.time}h - {slot.endTime}h
                    </div>
                    <div className="text-gray-500">{slot.roomName} · {slot.professionalName}</div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic mb-3">Encara no ha triat cap horari.</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirm(req)}
                    disabled={!slot || confirmingId === req.id}
                    className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {confirmingId === req.id ? "Confirmant..." : "Confirmar i avisar per WhatsApp"}
                  </button>
                  <button
                    onClick={() => handleDismiss(req.id)}
                    className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" /> Descartar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
