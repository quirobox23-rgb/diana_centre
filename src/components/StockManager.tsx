"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Plus, Minus, Search, Pencil, Trash2, X, AlertTriangle, History, Lock } from "lucide-react";

interface Product {
  id: number;
  name: string;
  category: string | null;
  line: "venda" | "professional";
  code: string | null;
  price: string;
  cost: string;
  stock: number;
  minStock: number;
  soldThisMonth: number;
  usedThisMonth: number;
}

interface Movement {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  kind: "venda" | "us" | "entrada" | "ajust";
  date: string;
  note: string | null;
}

type MoveKind = "venda" | "us" | "entrada" | "ajust";
type Line = "venda" | "professional";

const money = (v: string | number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(v) || 0);

const emptyForm = { name: "", category: "", code: "", line: "venda" as Line, price: "", cost: "", stock: "", minStock: "2" };

/** Pestanya d'estoc: què hi ha, què s'ha venut i què queda. */
interface StockManagerProps {
  /** Candado de la dueña obert: es veu l'import del mes (com al Resum) */
  canSeeMoney?: boolean;
  onRequestUnlock?: (then?: () => void) => void;
}

export function StockManager({ canSeeMoney = true, onRequestUnlock }: StockManagerProps = {}) {
  const [items, setItems] = useState<Product[]>([]);
  const [recent, setRecent] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm & { id?: number } | null>(null);
  const [move, setMove] = useState<{ product: Product; kind: MoveKind; quantity: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // Dues línies: productes per vendre a les clientes i productes que gasta el centre
  const [line, setLine] = useState<Line>("venda");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stock", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setItems(data.data);
        setRecent(data.recent);
      }
    } catch {
      // es tornarà a provar
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        flash(data.error || "No s'ha pogut desar");
        return null;
      }
      await load();
      return data;
    } catch {
      flash("Error de connexió");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const saveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const ok = await post(form.id ? { action: "update", ...form } : { action: "create", ...form });
    if (ok) {
      flash(form.id ? "Producte actualitzat" : "Producte afegit a l'estoc");
      setForm(null);
    }
  };

  const saveMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!move) return;
    const ok = await post({ action: "move", productId: move.product.id, kind: move.kind, quantity: Number(move.quantity) });
    if (ok) {
      const left = ok.data.stock as number;
      flash(
        move.kind === "venda" || move.kind === "us"
          ? `${move.kind === "venda" ? "Venda" : "Ús"} apuntat. Queden ${left} de ${move.product.name}`
          : move.kind === "entrada"
            ? `Entrada apuntada. Ara n'hi ha ${left}`
            : `Recompte corregit: ${left}`
      );
      setMove(null);
    }
  };

  const importCatalog = async () => {
    if (!confirm("Afegir els productes Aromsnatur (facial i corporal) amb el preu de la web? Entren amb 0 unitats i sense codi.")) return;
    const ok = await post({ action: "import-catalog" });
    if (ok) flash(ok.added > 0 ? `Afegits ${ok.added} productes. Ara posa les unitats amb "Recompte".` : "Ja hi eren tots");
  };

  const remove = async (p: Product) => {
    if (!confirm(`Treure "${p.name}" de l'estoc?`)) return;
    if (await post({ action: "delete", id: p.id })) flash("Producte tret de l'estoc");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inLine = items.filter((p) => (p.line ?? "venda") === line);
    return q ? inLine.filter((p) => `${p.name} ${p.category ?? ""} ${p.code ?? ""}`.toLowerCase().includes(q)) : inLine;
  }, [items, query, line]);

  const lineItems = items.filter((p) => (p.line ?? "venda") === line);
  // Avís de reposar només si s'ha posat un mínim (els del catàleg comencen sense)
  const low = lineItems.filter((p) => p.minStock > 0 && p.stock <= p.minStock);
  const totalUnits = lineItems.reduce((t, p) => t + p.stock, 0);
  const outMonth = lineItems.reduce((t, p) => t + (line === "venda" ? p.soldThisMonth : p.usedThisMonth), 0);
  // Venda: el que s'ha ingressat · Professional: el que ha costat (només despesa)
  const outMonthMoney = lineItems.reduce(
    (t, p) => t + (line === "venda" ? p.soldThisMonth * Number(p.price) : p.usedThisMonth * Number(p.cost)),
    0
  );
  const recentInLine = recent.filter((m) => lineItems.some((p) => p.id === m.productId));

  const input = "w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-terra-500 outline-hidden";

  return (
    <div className="space-y-4">
      {/* Capçalera */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-terra-600" />
          <h2 className="text-base font-bold text-stone-900">Estoc de productes</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busca un producte" className="pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-xl outline-hidden focus:border-terra-400" />
          </div>
          <button onClick={() => setShowHistory((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50">
            <History className="w-4 h-4" /> {showHistory ? "Amagar moviments" : "Últims moviments"}
          </button>
          {line === "venda" && !items.some((p) => p.category === "Facial" || p.category === "Corporal") && (
            <button onClick={importCatalog} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-terra-200 text-terra-700 bg-terra-50 hover:bg-terra-100 disabled:opacity-50">
              <Package className="w-4 h-4" /> Carregar productes Aromsnatur
            </button>
          )}
          <button onClick={() => setForm({ ...emptyForm, line })} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-terra-600 hover:bg-terra-700 rounded-xl">
            <Plus className="w-4 h-4" /> Nou producte
          </button>
        </div>
      </div>

      {/* Les dues línies */}
      <div className="flex bg-stone-100 rounded-xl p-1 border border-stone-200 text-xs font-bold w-fit">
        {([
          ["venda", "Venda al públic"],
          ["professional", "Ús professional"],
        ] as [Line, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setLine(id)}
            className={`px-4 py-2 rounded-lg ${line === id ? "bg-white text-terra-700 shadow-xs" : "text-stone-600 hover:text-stone-900"}`}
          >
            {label} ({items.filter((p) => (p.line ?? "venda") === id).length})
          </button>
        ))}
      </div>
      <p className="text-xs text-stone-500 -mt-2 px-1">
        {line === "venda"
          ? "Productes que es venen a les clientes. Cada venda resta unitats i compta com a ingrés."
          : "Material que gasta el centre (paper de llitera, cremes de cabina...). Restar el que es gasta no compta com a venda: només com a despesa."}
      </p>

      {/* Resum ràpid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Productes", value: String(lineItems.length) },
          { label: "Unitats en estoc", value: String(totalUnits) },
          { label: line === "venda" ? "Venuts aquest mes" : "Gastats aquest mes", value: String(outMonth) },
          { label: line === "venda" ? "Vendes del mes" : "Despesa del mes", value: money(outMonthMoney), locked: !canSeeMoney },
        ].map((b) => (
          <div key={b.label} className="bg-white rounded-2xl border border-stone-200 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">{b.label}</p>
            {b.locked ? (
              <button
                type="button"
                onClick={() => onRequestUnlock?.()}
                title="Els imports només els pot veure la dueña"
                className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
              >
                <Lock className="w-3.5 h-3.5" />
                Veure import
              </button>
            ) : (
              <p className="text-xl font-bold text-stone-900">{b.value}</p>
            )}
          </div>
        ))}
      </div>

      {low.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            <span className="font-bold">Cal reposar:</span>{" "}
            {low.map((p) => `${p.name} (${p.stock === 0 ? "esgotat" : `queden ${p.stock}`})`).join(" · ")}
          </p>
        </div>
      )}

      {showHistory && (
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <h3 className="text-sm font-bold text-stone-900 mb-2">Últims moviments</h3>
          {recentInLine.length === 0 ? (
            <p className="text-xs text-stone-500">Encara no hi ha cap moviment.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {recentInLine.map((m) => (
                <li key={m.id} className="py-1.5 flex justify-between gap-3">
                  <span className="truncate">
                    <span className="text-stone-400 text-xs mr-2">{m.date.split("-").reverse().join("/")}</span>
                    {m.productName}
                    {m.note && <span className="text-stone-400 text-xs"> · {m.note}</span>}
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${m.quantity < 0 ? "text-red-600" : "text-salvia-700"}`}>
                    {m.kind === "venda" ? "Venda" : m.kind === "us" ? "Ús" : m.kind === "entrada" ? "Entrada" : "Recompte"} {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Llista de productes */}
      {loading ? (
        <div className="py-12 text-center text-xs text-stone-500">Carregant…</div>
      ) : lineItems.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center space-y-2">
          <Package className="w-8 h-8 text-terra-400 mx-auto" />
          <p className="text-sm font-semibold text-stone-800">Encara no hi ha productes</p>
          <p className="text-xs text-stone-500">Afegeix cada producte amb les unitats que tens ara. {line === "venda" ? "Després, cada venda es resta sola." : "Després, apunta el que es gasta i es resta sol."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const state = p.minStock === 0 ? "ok" : p.stock === 0 ? "out" : p.stock <= p.minStock ? "low" : "ok";
            return (
              <div key={p.id} className={`bg-white rounded-2xl border p-4 space-y-3 ${state === "out" ? "border-red-200" : state === "low" ? "border-amber-200" : "border-stone-200"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-stone-900 truncate">{p.name}</h3>
                    <p className="text-[11px] text-stone-500">
                      {p.code ? `${p.code} · ` : ""}
                      {p.category ? `${p.category} · ` : ""}
                      {line === "venda"
                        ? Number(p.price) > 0 ? money(p.price) : "sense preu"
                        : Number(p.cost) > 0 ? `cost ${money(p.cost)}` : "sense cost"}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button title="Editar" onClick={() => setForm({ id: p.id, name: p.name, category: p.category ?? "", code: p.code ?? "", line: p.line ?? "venda", price: p.price, cost: p.cost, stock: String(p.stock), minStock: String(p.minStock) })} className="p-1.5 text-stone-400 hover:text-terra-700">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button title="Treure" onClick={() => remove(p)} className="p-1.5 text-stone-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className={`text-3xl font-bold leading-none ${state === "out" ? "text-red-600" : state === "low" ? "text-amber-600" : "text-stone-900"}`}>{p.stock}</p>
                    <p className="text-[11px] text-stone-500 mt-1">
                      {state === "out" ? "Esgotat" : state === "low" ? "Queda poc" : "en estoc"} ·{" "}
                      {line === "venda" ? `${p.soldThisMonth} venuts aquest mes` : `${p.usedThisMonth} gastats aquest mes`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setMove({ product: p, kind: line === "venda" ? "venda" : "us", quantity: "1" })}
                    disabled={p.stock === 0}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-terra-600 hover:bg-terra-700 disabled:opacity-40 rounded-lg"
                  >
                    <Minus className="w-3.5 h-3.5" /> {line === "venda" ? "Venda" : "Gastat"}
                  </button>
                  <button onClick={() => setMove({ product: p, kind: "entrada", quantity: "1" })} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-salvia-700 bg-salvia-50 hover:bg-salvia-100 border border-salvia-200 rounded-lg">
                    <Plus className="w-3.5 h-3.5" /> Entrada
                  </button>
                  <button onClick={() => setMove({ product: p, kind: "ajust", quantity: String(p.stock) })} className="px-3 py-1.5 text-xs font-bold text-stone-600 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg">
                    Recompte
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Finestra: venda / entrada / recompte */}
      {move && (
        <div className="fixed inset-0 z-[60] bg-stone-900/50 flex items-start justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain" onClick={() => setMove(null)}>
          <form onSubmit={saveMove} onClick={(e) => e.stopPropagation()} className="my-auto bg-white rounded-3xl shadow-2xl w-full max-w-xs p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-stone-900">
                  {move.kind === "venda" ? "Apuntar venda" : move.kind === "us" ? "Apuntar el que s'ha gastat" : move.kind === "entrada" ? "Entrada de producte" : "Corregir recompte"}
                </h3>
                <p className="text-xs text-stone-500 mt-1">{move.product.name} · ara n&apos;hi ha {move.product.stock}</p>
              </div>
              <button type="button" onClick={() => setMove(null)} className="p-1 text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="block text-xs font-medium text-stone-700">
              {move.kind === "ajust" ? "Unitats que hi ha de veritat" : "Quantitat"}
              <input type="number" min={move.kind === "ajust" ? 0 : 1} step={1} inputMode="numeric" value={move.quantity} onChange={(e) => setMove({ ...move, quantity: e.target.value })} className={`${input} mt-1`} autoFocus />
            </label>
            {move.kind !== "ajust" && Number(move.quantity) > 0 && (
              <p className="text-xs text-stone-500">
                En quedaran {move.kind === "venda" || move.kind === "us" ? move.product.stock - Number(move.quantity) : move.product.stock + Number(move.quantity)}
              </p>
            )}
            <button type="submit" disabled={busy || move.quantity === ""} className="w-full py-2.5 text-sm font-bold text-white bg-gradient-to-r from-terra-600 to-arcilla-600 rounded-xl disabled:opacity-50">
              {busy ? "..." : "Desar"}
            </button>
          </form>
        </div>
      )}

      {/* Finestra: producte nou o editar */}
      {form && (
        <div className="fixed inset-0 z-[60] bg-stone-900/50 flex items-start justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain" onClick={() => setForm(null)}>
          <form onSubmit={saveForm} onClick={(e) => e.stopPropagation()} className="my-auto bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-3">
            <div className="flex items-start justify-between">
              <h3 className="font-bold text-stone-900">{form.id ? "Editar producte" : "Nou producte"}</h3>
              <button type="button" onClick={() => setForm(null)} className="p-1 text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="block text-xs font-medium text-stone-700">
              Nom *
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Crema hidratant facial" className={`${input} mt-1`} autoFocus required />
            </label>
            <div className="flex bg-stone-100 rounded-lg p-1 border border-stone-200 text-xs font-bold">
              {([
                ["venda", "Venda al públic"],
                ["professional", "Ús professional"],
              ] as [Line, string][]).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setForm({ ...form, line: id })}
                  className={`flex-1 py-1.5 rounded-md ${form.line === id ? "bg-white text-terra-700 shadow-xs" : "text-stone-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="block text-xs font-medium text-stone-700">
              Codi del TPV (opcional)
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="El mateix codi que surt al TPV quan cobreu" className={`${input} mt-1`} />
            </label>
            <label className="block text-xs font-medium text-stone-700">
              Tipus (opcional)
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex: Facial, Corporal, Olis…" className={`${input} mt-1`} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              {form.line === "venda" && (
                <label className="block text-xs font-medium text-stone-700">
                  Preu de venda (€)
                  <input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0,00" className={`${input} mt-1`} />
                </label>
              )}
              <label className="block text-xs font-medium text-stone-700">
                Preu de compra (€)
                <input inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="0,00" className={`${input} mt-1`} />
              </label>
              {!form.id && (
                <label className="block text-xs font-medium text-stone-700">
                  Unitats que hi ha
                  <input type="number" min={0} step={1} inputMode="numeric" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" className={`${input} mt-1`} />
                </label>
              )}
              <label className="block text-xs font-medium text-stone-700">
                Avisar quan en quedin
                <input type="number" min={0} step={1} inputMode="numeric" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} className={`${input} mt-1`} />
              </label>
            </div>
            <button type="submit" disabled={busy || !form.name.trim()} className="w-full py-2.5 text-sm font-bold text-white bg-gradient-to-r from-terra-600 to-arcilla-600 rounded-xl disabled:opacity-50">
              {busy ? "..." : "Desar"}
            </button>
          </form>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-stone-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
