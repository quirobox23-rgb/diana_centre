"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Lock, X } from "lucide-react";

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
  const [visible, setVisible] = useState(false);

  const title = mode === "setup" ? "Crear la clau del candado" : mode === "change" ? "Canviar la clau del candado" : "Apartat protegit";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = (v: string) => v.normalize("NFC").trim();
    if (mode !== "unlock" && clean(pin) !== clean(pin2)) {
      setError("Les dues claus no coincideixen");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/owner-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, pin: clean(pin), current: clean(current) }),
      });
      const data = await res.json();
      if (data.success) onUnlocked();
      else setError(data.error || "No s'ha pogut obrir");
    } catch {
      setError("Error de connexió");
    }
    setBusy(false);
  };

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
              ? "Tria una clau que només sàpigues tu. Obrirà els imports del Resum i anul·lar xecs regal."
              : mode === "change"
                ? "Escriu la clau actual i la nova."
                : reason || "Escriu la clau de la dueña per continuar. Es tornarà a tancar sola al cap d'una hora."}
          </p>
        </div>

        {mode === "change" && (
          <PinField value={current} onChange={setCurrent} placeholder="Clau actual" visible={visible} autoFocus name="diana-candado-actual" />
        )}
        <PinField
          value={pin}
          onChange={setPin}
          placeholder={mode === "unlock" ? "Clau" : "Clau nova"}
          visible={visible}
          autoFocus={mode !== "change"}
          name="diana-candado"
        />
        {mode !== "unlock" && (
          <PinField value={pin2} onChange={setPin2} placeholder="Repeteix la clau" visible={visible} name="diana-candado-repetir" />
        )}
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-terra-700"
        >
          {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {visible ? "Amagar la clau" : "Veure el que escric"}
        </button>

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

/**
 * Camp per a la clau. No és un camp de contrasenya "de veritat" perquè el navegador
 * (sobretot Safari/Chrome al mòbil) no hi posi la contrasenya d'entrada ni n'hi
 * inventi una de forta sense que es vegi: llavors la clau desada no és la que creu la dueña.
 */
function PinField({
  value,
  onChange,
  placeholder,
  visible,
  autoFocus,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  visible: boolean;
  autoFocus?: boolean;
  name: string;
}) {
  return (
    <input
      type="text"
      name={name}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      data-1p-ignore
      data-lpignore="true"
      data-form-type="other"
      style={visible ? undefined : ({ WebkitTextSecurity: "disc" } as React.CSSProperties)}
      className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl outline-none focus:border-terra-400 tracking-widest"
    />
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
