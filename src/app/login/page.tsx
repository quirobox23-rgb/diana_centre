"use client";

import React, { useState } from "react";
import { Sparkles, Lock } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = "/";
        return;
      }
      setError(data.error || "No s'ha pogut iniciar sessió");
    } catch {
      setError("Error de connexió");
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-3xl border border-terra-100 shadow-lg p-8 space-y-5"
      >
        <div className="flex flex-col items-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-terra-500 via-arcilla-500 to-moka-600 flex items-center justify-center text-white shadow-md">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black text-stone-900">Estètica Diana</h1>
          <p className="text-xs text-stone-500">Accés al panell de gestió</p>
        </div>

        <label className="block">
          <span className="text-xs font-bold text-stone-600">Contrasenya</span>
          <div className="mt-1 flex items-center border border-stone-200 rounded-xl px-3 focus-within:border-terra-400">
            <Lock className="w-4 h-4 text-stone-400" />
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-2 py-2.5 text-sm outline-none bg-transparent"
            />
          </div>
        </label>

        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-2.5 text-sm font-bold text-white bg-gradient-to-r from-terra-600 to-arcilla-600 hover:from-terra-700 hover:to-arcilla-700 rounded-xl shadow-md disabled:opacity-50"
        >
          {loading ? "Entrant..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
