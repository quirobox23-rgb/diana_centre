"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Receipt, Plus, Minus, X, Search, ShoppingBag, Sparkles, Ticket } from "lucide-react";
import { Service } from "@/types";

// El compte de la cita: el tractament i tot el que s'hi afegeix abans de cobrar
// (cremes de l'Estoc, un altre tractament, un bo...). Els productes resten estoc i
// tot plegat surt al Resum. Cada línia es pot cobrar amb targeta o en efectiu.

interface Product { id: number; name: string; price: string; stock: number; line?: string; category?: string | null }
interface Sale { id: number; productId: number; productName: string; quantity: number; price: string; paidCash?: boolean }
interface Extra { id: number; kind: string; description: string; quantity: number; unitPrice: string; paidCash?: boolean }
type Adding = null | "producte" | "servei" | "bo";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

interface Props {
  appointmentId: number;
  clientName: string;
  serviceName: string;
  servicePrice: number | null;
  /** Canvia com es cobra el tractament (es desa amb "Desar canvis") */
  onTreatmentCash: (cash: boolean) => void;
  services: Service[];
  paidCash: boolean;
}

export function AppointmentAccount({ appointmentId, clientName, serviceName, servicePrice, onTreatmentCash, services, paidCash }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [adding, setAdding] = useState<Adding>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [svcId, setSvcId] = useState("");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = async () => {
    const [s, e] = await Promise.all([
      fetch(`/api/stock?appointmentId=${appointmentId}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch(`/api/appointments/extras?appointmentId=${appointmentId}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    if (s?.success) setSales(s.data);
    if (e?.success) setExtras(e.data);
  };

  useEffect(() => {
    let alive = true;
    fetch("/api/stock", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && d.success && setProducts((d.data as Product[]).filter((p) => (p.line ?? "venda") === "venda")))
      .catch(() => {});
    Promise.all([
      fetch(`/api/stock?appointmentId=${appointmentId}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch(`/api/appointments/extras?appointmentId=${appointmentId}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]).then(([s, e]) => {
      if (!alive) return;
      if (s?.success) setSales(s.data);
      if (e?.success) setExtras(e.data);
    });
    return () => {
      alive = false;
    };
  }, [appointmentId]);

  const matches = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return [];
    return products.filter((p) => norm(p.name).includes(q) || norm(p.category || "").includes(q)).slice(0, 8);
  }, [products, query]);

  const reset = () => {
    setAdding(null);
    setQuery("");
    setPicked(null);
    setQty(1);
    setSvcId("");
    setDesc("");
    setAmount("");
    setMsg(null);
  };

  const run = async (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await fn();
      if (!d.success) throw new Error(d.error || "No s'ha pogut afegir");
      reset();
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No s'ha pogut afegir");
    } finally {
      setBusy(false);
    }
  };

  const addProduct = () =>
    picked && run(() => post("/api/stock", { action: "move", kind: "venda", id: picked.id, quantity: qty, appointmentId, note: `Venda a ${clientName}` }));
  const addService = () => {
    const svc = services.find((s) => String(s.id) === svcId);
    if (!svc) return setMsg("Tria el tractament");
    run(() => post("/api/appointments/extras", { appointmentId, kind: "servei", serviceId: svc.id, quantity: 1, unitPrice: amount || undefined }));
  };
  const addOther = () => run(() => post("/api/appointments/extras", { appointmentId, kind: "bo", description: desc, quantity: qty, unitPrice: amount }));

  const removeSale = async (s: Sale) => {
    setBusy(true);
    await post("/api/stock", { action: "undo-sale", moveId: s.id }).catch(() => {});
    await reload();
    setBusy(false);
  };
  const removeExtra = async (x: Extra) => {
    setBusy(true);
    await fetch(`/api/appointments/extras?id=${x.id}`, { method: "DELETE" }).catch(() => {});
    await reload();
    setBusy(false);
  };

  // Totals per forma de pagament (el tractament segons el selector de la cita)
  const lines = [
    ...(servicePrice != null ? [{ amount: servicePrice, cash: paidCash }] : []),
    ...extras.map((x) => ({ amount: x.quantity * Number(x.unitPrice || 0), cash: !!x.paidCash })),
    ...sales.map((s) => ({ amount: s.quantity * Number(s.price || 0), cash: !!s.paidCash })),
  ];
  const total = lines.reduce((t, l) => t + l.amount, 0);
  const cashTotal = lines.filter((l) => l.cash).reduce((t, l) => t + l.amount, 0);

  const setExtraCash = async (x: Extra, cash: boolean) => {
    setExtras((list) => list.map((e) => (e.id === x.id ? { ...e, paidCash: cash } : e)));
    await fetch("/api/appointments/extras", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: x.id, paidCash: cash }) }).catch(() => {});
  };
  const setSaleCash = async (s: Sale, cash: boolean) => {
    setSales((list) => list.map((e) => (e.id === s.id ? { ...e, paidCash: cash } : e)));
    await post("/api/stock", { action: "set-cash", moveId: s.id, paidCash: cash }).catch(() => {});
  };

  const payToggle = (cash: boolean, onChange: (cash: boolean) => void) => (
    <span className="inline-flex bg-stone-100 rounded-md p-0.5 text-[10px] font-bold">
      {[
        { c: false, label: "Targeta" },
        { c: true, label: "Efectiu" },
      ].map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.c)}
          className={`px-1.5 py-0.5 rounded ${cash === o.c ? (o.c ? "bg-salvia-600 text-white" : "bg-white text-stone-800 shadow-xs") : "text-stone-500"}`}
        >
          {o.label}
        </button>
      ))}
    </span>
  );

  const line = (
    key: string,
    { label, value, onRemove, strong, pay }: { label: React.ReactNode; value: string | null; onRemove?: () => void; strong?: boolean; pay?: React.ReactNode }
  ) => (
    <li key={key} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-1.5 text-sm">
      <span className={`min-w-0 flex-1 truncate ${strong ? "font-semibold text-stone-800" : ""}`}>{label}</span>
      <span className="flex items-center gap-1.5 shrink-0">
        {pay}
        {value && <span className="text-stone-700 text-xs font-semibold tabular-nums w-16 text-right">{value}</span>}
        {onRemove ? (
          <button type="button" onClick={onRemove} disabled={busy} title="Treure del compte" className="p-1 rounded text-stone-400 hover:text-red-600 hover:bg-red-50">
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span className="w-[22px]" />
        )}
      </span>
    </li>
  );

  const addBtn = (k: Exclude<Adding, null>, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => {
        reset();
        setAdding(k);
      }}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
        adding === k ? "bg-terra-600 border-terra-600 text-white" : "bg-white border-terra-200 text-terra-800 hover:bg-terra-50"
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="rounded-xl border border-terra-100 bg-terra-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-terra-800">
          <Receipt className="w-4 h-4" /> Compte de la cita
        </span>
        <span className="text-[11px] text-stone-500">Tria a cada línia si es paga amb targeta o en efectiu</span>
      </div>

      <ul className="divide-y divide-terra-100 bg-white rounded-lg border border-terra-100">
        {line("svc", { label: serviceName || "Tractament", value: servicePrice != null ? eur(servicePrice) : null, strong: true, pay: payToggle(paidCash, onTreatmentCash) })}
        {extras.map((x) => (
          line(`e${x.id}`, {
            label: (
              <>
                {x.quantity > 1 && <b>{x.quantity}× </b>}
                {x.description}
              </>
            ),
            value: eur(x.quantity * Number(x.unitPrice || 0)),
            onRemove: () => removeExtra(x),
            pay: payToggle(!!x.paidCash, (c) => setExtraCash(x, c)),
          })
        ))}
        {sales.map((s) => (
          line(`p${s.id}`, {
            label: (
              <>
                <b>{s.quantity}× </b>
                {s.productName}
              </>
            ),
            value: eur(s.quantity * Number(s.price || 0)),
            onRemove: () => removeSale(s),
            pay: payToggle(!!s.paidCash, (c) => setSaleCash(s, c)),
          })
        ))}
        <li className="px-3 py-2 bg-stone-50 rounded-b-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-stone-900">Total a cobrar</span>
            <span className="text-base font-bold text-stone-900 tabular-nums pr-[28px]">{eur(total)}</span>
          </div>
          {cashTotal > 0 && cashTotal < total && (
            <div className="flex justify-end gap-3 text-xs text-stone-600 pr-[28px] tabular-nums">
              <span>Targeta <b>{eur(total - cashTotal)}</b></span>
              <span>Efectiu <b>{eur(cashTotal)}</b></span>
            </div>
          )}
          {cashTotal > 0 && cashTotal === total && <div className="text-right text-xs text-stone-600 pr-[28px]">Tot en efectiu</div>}
        </li>
      </ul>

      <div className="flex flex-wrap gap-1.5">
        {addBtn("producte", <ShoppingBag className="w-3.5 h-3.5" />, "Crema o producte")}
        {addBtn("servei", <Sparkles className="w-3.5 h-3.5" />, "Un altre tractament")}
        {addBtn("bo", <Ticket className="w-3.5 h-3.5" />, "Bo o una altra cosa")}
      </div>

      {adding === "producte" &&
        (picked ? (
          <div className="flex flex-wrap items-center gap-2 bg-white rounded-lg border border-terra-200 px-3 py-2">
            <span className="text-sm font-semibold text-stone-800 min-w-0 flex-1 truncate">{picked.name}</span>
            <span className="text-xs text-stone-500">{eur(Number(picked.price || 0))}</span>
            <Qty qty={qty} setQty={setQty} />
            <button type="button" onClick={addProduct} disabled={busy} className="px-3 py-1.5 rounded-lg bg-terra-600 hover:bg-terra-700 text-white text-xs font-bold">
              {busy ? "Afegint..." : "Afegir al compte"}
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={products.length ? "Busca la crema o el producte..." : "Encara no hi ha productes a l'Estoc"}
              className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg bg-white focus:ring-2 focus:ring-terra-500"
            />
            {matches.length > 0 && (
              <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setPicked(p)}
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
        ))}

      {adding === "servei" && (
        <div className="flex flex-wrap items-center gap-2 bg-white rounded-lg border border-terra-200 px-3 py-2">
          <select
            value={svcId}
            onChange={(e) => {
              setSvcId(e.target.value);
              const s = services.find((x) => String(x.id) === e.target.value);
              setAmount(s ? Number(s.price).toFixed(2) : "");
            }}
            className="flex-1 min-w-[180px] px-2 py-1.5 text-sm border border-stone-300 rounded-lg bg-white"
          >
            <option value="">Tria el tractament...</option>
            {services
              .filter((s) => s.isActive !== false)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <PriceInput value={amount} onChange={setAmount} />
          <button type="button" onClick={addService} disabled={busy || !svcId} className="px-3 py-1.5 rounded-lg bg-terra-600 hover:bg-terra-700 disabled:opacity-50 text-white text-xs font-bold">
            Afegir al compte
          </button>
        </div>
      )}

      {adding === "bo" && (
        <div className="flex flex-wrap items-center gap-2 bg-white rounded-lg border border-terra-200 px-3 py-2">
          <input
            autoFocus
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Ex.: Bo de 5 massatges"
            className="flex-1 min-w-[180px] px-2 py-1.5 text-sm border border-stone-300 rounded-lg"
          />
          <Qty qty={qty} setQty={setQty} />
          <PriceInput value={amount} onChange={setAmount} />
          <button type="button" onClick={addOther} disabled={busy || !desc.trim() || !amount} className="px-3 py-1.5 rounded-lg bg-terra-600 hover:bg-terra-700 disabled:opacity-50 text-white text-xs font-bold">
            Afegir al compte
          </button>
        </div>
      )}

      {msg && <p className="text-xs text-red-600">{msg}</p>}
    </div>
  );
}

function Qty({ qty, setQty }: { qty: number; setQty: (f: (q: number) => number) => void }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-stone-200">
      <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-1.5 text-stone-500">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="w-6 text-center text-sm font-bold">{qty}</span>
      <button type="button" onClick={() => setQty((q) => q + 1)} className="p-1.5 text-stone-500">
        <Plus className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

function PriceInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Preu"
        className="w-20 px-2 py-1.5 text-sm border border-stone-300 rounded-lg text-right"
      />
      <span className="text-sm text-stone-500">€</span>
    </span>
  );
}
