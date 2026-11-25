"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ShoppingBag, Plus, Minus, X, Search } from "lucide-react";

// Vendre cremes i productes de l'Estoc a la clienta, des de la mateixa fitxa de la cita.
// Cada venda resta les unitats de l'Estoc i surt al Resum com a productes venuts.

interface Product { id: number; name: string; price: string; stock: number; line?: string; category?: string | null }
interface Sale { id: number; productId: number; productName: string; quantity: number; price: string }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

export function ProductSales({ appointmentId, clientName, servicePrice, canSeeMoney }: { appointmentId: number; clientName: string; servicePrice: number | null; canSeeMoney: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadSales = () =>
    fetch(`/api/stock?appointmentId=${appointmentId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.success && setSales(d.data))
      .catch(() => {});

  useEffect(() => {
    let alive = true;
    fetch("/api/stock", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && d.success && setProducts((d.data as Product[]).filter((p) => (p.line ?? "venda") === "venda")))
      .catch(() => {});
    fetch(`/api/stock?appointmentId=${appointmentId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && d.success && setSales(d.data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [appointmentId]);

  const matches = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return [];
    return products.filter((p) => norm(p.name).includes(q) || norm(p.category || "").includes(q)).slice(0, 8);
  }, [products, query]);

  const sell = async () => {
    if (!picked) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move", kind: "venda", id: picked.id, quantity: qty, appointmentId, note: `Venda a ${clientName}` }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || "No s'ha pogut apuntar");
      setPicked(null);
      setQuery("");
      setQty(1);
      await loadSales();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No s'ha pogut apuntar");
    } finally {
      setBusy(false);
    }
  };

  const undo = async (s: Sale) => {
    setBusy(true);
    await fetch("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "undo-sale", moveId: s.id }) }).catch(() => {});
    await loadSales();
    setBusy(false);
  };

  const productsTotal = sales.reduce((t, s) => t + s.quantity * Number(s.price || 0), 0);

  return (
    <div className="rounded-xl border border-terra-100 bg-terra-50/40 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-terra-800">
        <ShoppingBag className="w-4 h-4" /> Productes venuts a la clienta
      </div>

      {sales.length > 0 && (
        <ul className="divide-y divide-terra-100 bg-white rounded-lg border border-terra-100">
          {sales.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
              <span className="min-w-0 truncate">
                <b>{s.quantity}×</b> {s.productName}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-stone-500 text-xs">{eur(s.quantity * Number(s.price || 0))}</span>
                <button type="button" onClick={() => undo(s)} disabled={busy} title="Treure (s'ha apuntat per error)" className="p-1 rounded text-stone-400 hover:text-red-600 hover:bg-red-50">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {picked ? (
        <div className="flex flex-wrap items-center gap-2 bg-white rounded-lg border border-terra-200 px-3 py-2">
          <span className="text-sm font-semibold text-stone-800 min-w-0 flex-1 truncate">{picked.name}</span>
          <span className="text-xs text-stone-500">{eur(Number(picked.price || 0))}</span>
          <span className="inline-flex items-center rounded-lg border border-stone-200">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-1.5 text-stone-500"><Minus className="w-3.5 h-3.5" /></button>
            <span className="w-6 text-center text-sm font-bold">{qty}</span>
            <button type="button" onClick={() => setQty((q) => q + 1)} className="p-1.5 text-stone-500"><Plus className="w-3.5 h-3.5" /></button>
          </span>
          <button type="button" onClick={sell} disabled={busy} className="px-3 py-1.5 rounded-lg bg-terra-600 hover:bg-terra-700 text-white text-xs font-bold">
            {busy ? "Apuntant..." : "Apuntar venda"}
          </button>
          <button type="button" onClick={() => setPicked(null)} className="p-1 text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={products.length ? "Busca la crema o el producte que s'endú..." : "Encara no hi ha productes a l'Estoc"}
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg bg-white focus:ring-2 focus:ring-terra-500"
          />
          {matches.length > 0 && (
            <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(p);
                      setQty(1);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-terra-50"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs text-stone-500 shrink-0">{eur(Number(p.price || 0))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {msg && <p className="text-xs text-red-600">{msg}</p>}

      {sales.length > 0 && (
        <p className="text-xs text-stone-600">
          Productes: <b>{eur(productsTotal)}</b>
          {canSeeMoney && servicePrice != null && (
            <>
              {" "}· Total a cobrar amb el tractament: <b>{eur(productsTotal + servicePrice)}</b>
            </>
          )}
        </p>
      )}
    </div>
  );
}
