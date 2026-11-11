"use client";

import React, { useState } from "react";
import { Lock, X } from "lucide-react";

export type LockMode = "unlock" | "setup" | "change";

interface Props {
  mode: LockMode;
  reason?: string;
  onClose: () => void;
  onUnlocked: () => void;
}

/** Finestra per obrir el candado de la dueña, crear-ne la clau o canviar-la. */
export function OwnerLockModal({ mode, reason, onClose, onUnlocked }: Props) {
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [current, setCurrent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const title = mode === "setup" ? "Crear la clau del candado" : mode === "change" ? "Canviar la clau del candado" : "Apartat protegit";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode !== "unlock" && pin !== pin2) {
      setError("Les dues claus no coincideixen");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/owner-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, pin, current }),
      });
      const data = await res.json();
      if (data.success) onUnlocked();
      else setError(data.error || "No s'ha pogut obrir");
    } catch {
      setError("Error de connexió");
    }
    setBusy(false);
  };

  const input = "w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl outline-none focus:border-terra-400 tracking-widest";

  return (
    <div className="fixed inset-0 z-[60] bg-stone-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-6 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-2xl bg-terra-50 border border-terra-100 flex items-center justify-center">
            <Lock className="w-5 h-5 text-terra-600" />
          </div>
          <button type="button" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>
          <h3 className="font-bold text-stone-900">{title}</h3>
          <p className="text-xs text-stone-500 mt-1">
            {mode === "setup"
              ? "Tria una clau que només sàpigues tu. Obrirà el Resum, els imports i anul·lar xecs regal."
              : mode === "change"
                ? "Escriu la clau actual i la nova."
                : reason || "Escriu la clau de la dueña per continuar. Es tornarà a tancar sola al cap d'una hora."}
          </p>
        </div>

        {mode === "change" && (
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="Clau actual" className={input} autoFocus />
        )}
        <input
          type="password"
          value={pin}
          onChange={e => setPin(e.target.value)}
          placeholder={mode === "unlock" ? "Clau" : "Clau nova"}
          className={input}
          autoFocus={mode !== "change"}
          autoComplete="off"
        />
        {mode !== "unlock" && (
          <input type="password" value={pin2} onChange={e => setPin2(e.target.value)} placeholder="Repeteix la clau" className={input} autoComplete="off" />
        )}

        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy || !pin}
          className="w-full py-2.5 text-sm font-bold text-white bg-gradient-to-r from-terra-600 to-arcilla-600 rounded-xl disabled:opacity-50"
        >
          {busy ? "..." : mode === "unlock" ? "Obrir" : "Desar la clau"}
        </button>
      </form>
    </div>
  );
}

/** Pantalla que es mostra en un apartat protegit mentre el candado està tancat. */
export function LockedSection({ title, onUnlock }: { title: string; onUnlock: () => void }) {
  return (
    <div className="bg-white border border-terra-100 rounded-3xl p-12 text-center max-w-md mx-auto mt-6 space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-terra-50 border border-terra-100 flex items-center justify-center mx-auto">
        <Lock className="w-6 h-6 text-terra-600" />
      </div>
      <h2 className="font-bold text-stone-900">{title}</h2>
      <p className="text-xs text-stone-500">Aquest apartat només el pot veure la dueña.</p>
      <button onClick={onUnlock} className="px-5 py-2 text-xs font-bold text-white bg-terra-600 hover:bg-terra-700 rounded-xl">
        Obrir amb la clau
      </button>
    </div>
  );
}
