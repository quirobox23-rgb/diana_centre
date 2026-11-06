"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Gift, Plus, Search, X, CheckCircle2, Ban, ChevronDown, ChevronUp } from "lucide-react";
import { GiftVoucher, Service } from "@/types";
import { addDays, todayStr } from "@/lib/dates";

const MONTHS = ["gen", "febr", "març", "abr", "maig", "juny", "jul", "ag", "set", "oct", "nov", "des"];
function niceDate(d: string | null) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
}
const eur = (v: string | number) =>
  Number(v).toLocaleString("ca-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

type Filter = "actius" | "usats" | "tots";

function displayStatus(v: GiftVoucher, today: string) {
  if (v.status === "anul·lat") return { label: "Anul·lat", cls: "bg-stone-100 text-stone-500" };
  if (v.status === "bescanviat") return { label: "Fet servir", cls: "bg-stone-100 text-stone-600" };
  if (v.expiryDate && v.expiryDate < today) return { label: "Caducat", cls: "bg-amber-50 text-amber-700" };
  return { label: "Actiu", cls: "bg-salvia-50 text-salvia-700" };
}

interface Props {
  services: Service[];
  isAdmin: boolean;
}

export function GiftVouchersManager({ services, isAdmin }: Props) {
  const [vouchers, setVouchers] = useState<GiftVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("actius");
  const [creating, setCreating] = useState(false);
  const [using, setUsing] = useState<GiftVoucher | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const today = todayStr();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    try {
      const res = await fetch("/api/vouchers");
      const data = await res.json();
      if (data.success) setVouchers(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const replace = (v: GiftVoucher) => setVouchers(prev => prev.map(x => (x.id === v.id ? { ...x, ...v } : x)));

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vouchers.filter(v => {
      if (filter === "actius" && v.status !== "actiu") return false;
      if (filter === "usats" && v.status === "actiu") return false;
      if (!q) return true;
      return [v.code, v.buyerName, v.recipientName, v.buyerPhone, v.recipientPhone]
        .some(f => f && f.toLowerCase().includes(q));
    });
  }, [vouchers, search, filter]);

  const active = vouchers.filter(v => v.status === "actiu" && !(v.expiryDate && v.expiryDate < today));
  const pendingMoney = active.reduce((s, v) => s + Number(v.remaining), 0);

  const cancelVoucher = async (v: GiftVoucher) => {
    if (!confirm(`Anul·lar el xec ${v.code}? No es podrà fer servir.`)) return;
    const res = await fetch("/api/vouchers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, status: "anul·lat" }),
    });
    const data = await res.json();
    if (data.success) {
      replace(data.data);
      showToast(`Xec ${v.code} anul·lat`);
    }
  };

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Gift className="w-5 h-5 text-terra-600" /> Xecs regal
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {active.length === 1 ? "1 xec actiu" : `${active.length} xecs actius`}
            {isAdmin && active.length > 0 && <> · {eur(pendingMoney)} pendents de gastar</>}
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-terra-600 to-arcilla-600 hover:from-terra-700 hover:to-arcilla-700 rounded-xl shadow-md"
        >
          <Plus className="w-4 h-4" /> Nou xec regal
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-center bg-white border border-stone-200 rounded-xl px-3 focus-within:border-terra-400">
          <Search className="w-4 h-4 text-stone-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per codi, nom o telèfon"
            className="w-full px-2 py-2 text-sm outline-none bg-transparent"
          />
        </div>
        <div className="flex bg-white border border-stone-200 rounded-xl p-0.5">
          {([["actius", "Actius"], ["usats", "Fets servir"], ["tots", "Tots"]] as [Filter, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg ${filter === id ? "bg-terra-50 text-terra-700" : "text-stone-500 hover:text-stone-800"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Carregant xecs...</p>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-200 rounded-2xl p-10 text-center text-sm text-stone-500">
          {vouchers.length === 0 ? "Encara no hi ha cap xec regal. Crea'n un amb «Nou xec regal»." : "Cap xec coincideix amb la cerca."}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map(v => {
            const st = displayStatus(v, today);
            const usable = v.status === "actiu" && !(v.expiryDate && v.expiryDate < today);
            const what = v.kind === "servei" ? v.serviceText || services.find(s => s.id === v.serviceId)?.name || "Servei" : null;
            return (
              <div key={v.id} className="bg-white border border-terra-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-sm font-black tracking-wider text-stone-900">{v.code}</div>
                    <div className="text-sm font-semibold text-stone-800 mt-1">Per a {v.recipientName}</div>
                    <div className="text-xs text-stone-500">
                      De {v.buyerName}
                      {v.recipientPhone && <> · {v.recipientPhone}</>}
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    {what ? (
                      <div className="text-sm font-bold text-terra-700">{what}</div>
                    ) : (
                      <div className="text-sm">
                        <span className="font-bold text-terra-700">{eur(v.remaining)}</span>
                        {Number(v.remaining) !== Number(v.amount) && (
                          <span className="text-xs text-stone-400"> de {eur(v.amount)}</span>
                        )}
                      </div>
                    )}
                    <div className="text-[11px] text-stone-400">
                      {niceDate(v.issueDate)}
                      {v.expiryDate && <> · caduca {niceDate(v.expiryDate)}</>}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {usable && (
                      <button
                        onClick={() => setUsing(v)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-terra-600 hover:bg-terra-700 rounded-lg"
                      >
                        Fer servir
                      </button>
                    )}
                    {isAdmin && v.status === "actiu" && (
                      <button
                        onClick={() => cancelVoucher(v)}
                        title="Anul·lar"
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {(v.uses?.length || v.notes) ? (
                  <div className="border-t border-stone-100 pt-2">
                    <button
                      onClick={() => setExpanded(expanded === v.id ? null : v.id)}
                      className="text-[11px] font-bold text-stone-500 hover:text-stone-800 inline-flex items-center gap-1"
                    >
                      {expanded === v.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {v.uses?.length ? `${v.uses.length} ${v.uses.length === 1 ? "ús" : "usos"}` : "Notes"}
                    </button>
                    {expanded === v.id && (
                      <ul className="mt-1.5 space-y-1 text-xs text-stone-600">
                        {v.uses?.map(u => (
                          <li key={u.id}>
                            {niceDate(u.date)}
                            {v.kind === "import" && <> · {eur(u.amount)}</>}
                            {u.note && <span className="text-stone-400"> · {u.note}</span>}
                          </li>
                        ))}
                        {v.notes && <li className="text-stone-400 italic">{v.notes}</li>}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <CreateVoucherModal
          services={services}
          onClose={() => setCreating(false)}
          onCreated={v => {
            setVouchers(prev => [v, ...prev]);
            setCreating(false);
            showToast(`Xec ${v.code} creat`);
          }}
        />
      )}

      {using && (
        <UseVoucherModal
          voucher={using}
          onClose={() => setUsing(null)}
          onUsed={v => {
            replace(v);
            setUsing(null);
            showToast(v.status === "bescanviat" ? `Xec ${v.code} gastat del tot` : `Queden ${eur(v.remaining)} al xec`);
          }}
        />
      )}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm border border-stone-200 rounded-xl outline-none focus:border-terra-400";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h3 className="font-bold text-stone-900">{title}</h3>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-stone-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CreateVoucherModal({ services, onClose, onCreated }: { services: Service[]; onClose: () => void; onCreated: (v: GiftVoucher) => void }) {
  const [kind, setKind] = useState<"import" | "servei">("import");
  const [amount, setAmount] = useState("50");
  const [serviceId, setServiceId] = useState<string>("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [issueDate, setIssueDate] = useState(todayStr());
  const [expiryDate, setExpiryDate] = useState(addDays(todayStr(), 365));
  const [paymentMethod, setPaymentMethod] = useState("targeta");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickService = (id: string) => {
    setServiceId(id);
    const s = services.find(x => String(x.id) === id);
    if (s) setAmount(String(Number(s.price)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const service = services.find(s => String(s.id) === serviceId);
    const res = await fetch("/api/vouchers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        amount,
        serviceId: kind === "servei" && service ? service.id : null,
        serviceText: kind === "servei" ? service?.name : null,
        buyerName,
        buyerPhone,
        recipientName: recipientName || buyerName,
        recipientPhone,
        issueDate,
        expiryDate,
        paymentMethod,
        notes,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) onCreated(data.data);
    else setError(data.error || "No s'ha pogut crear");
  };

  return (
    <Modal title="Nou xec regal" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        <div className="flex bg-stone-100 rounded-xl p-0.5">
          {([["import", "Import en €"], ["servei", "Un servei"]] as const).map(([id, label]) => (
            <button
              type="button"
              key={id}
              onClick={() => setKind(id)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${kind === id ? "bg-white text-terra-700 shadow-xs" : "text-stone-500"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {kind === "servei" && (
          <Field label="Servei regalat">
            <select value={serviceId} onChange={e => pickService(e.target.value)} className={inputCls} required>
              <option value="">Tria un servei</option>
              {services.filter(s => s.isActive).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label={kind === "servei" ? "Preu pagat (€)" : "Import (€)"}>
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={inputCls} required />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Qui el compra">
            <input value={buyerName} onChange={e => setBuyerName(e.target.value)} className={inputCls} required />
          </Field>
          <Field label="Telèfon">
            <input value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Per a qui és">
            <input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder={buyerName} className={inputCls} />
          </Field>
          <Field label="Telèfon">
            <input value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Data">
            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={inputCls} required />
          </Field>
          <Field label="Caduca">
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="Pagament">
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inputCls}>
            <option value="targeta">Targeta</option>
            <option value="efectiu">Efectiu</option>
            <option value="bizum">Bizum</option>
            <option value="transferència">Transferència</option>
          </select>
        </Field>

        <Field label="Notes">
          <input value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} placeholder="Opcional" />
        </Field>

        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 text-sm font-bold text-white bg-gradient-to-r from-terra-600 to-arcilla-600 rounded-xl disabled:opacity-50"
        >
          {saving ? "Creant..." : "Crear xec"}
        </button>
      </form>
    </Modal>
  );
}

function UseVoucherModal({ voucher, onClose, onUsed }: { voucher: GiftVoucher; onClose: () => void; onUsed: (v: GiftVoucher) => void }) {
  const isService = voucher.kind === "servei";
  const [amount, setAmount] = useState(String(Number(voucher.remaining)));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/vouchers/${voucher.id}/use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, note }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) onUsed(data.data);
    else setError(data.error || "No s'ha pogut fer servir");
  };

  return (
    <Modal title={`Fer servir ${voucher.code}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        <p className="text-sm text-stone-600">
          {isService
            ? <>Xec per a <b>{voucher.serviceText || "un servei"}</b>. Es marcarà com a fet servir.</>
            : <>Queden <b>{eur(voucher.remaining)}</b>. Indica quant es gasta avui.</>}
        </p>
        {!isService && (
          <Field label="Import que es gasta (€)">
            <input type="number" min="0.01" step="0.01" max={Number(voucher.remaining)} value={amount} onChange={e => setAmount(e.target.value)} className={inputCls} required />
          </Field>
        )}
        <Field label="Nota">
          <input value={note} onChange={e => setNote(e.target.value)} className={inputCls} placeholder="Ex.: neteja facial" />
        </Field>
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="w-full py-2.5 text-sm font-bold text-white bg-terra-600 hover:bg-terra-700 rounded-xl disabled:opacity-50">
          {saving ? "Guardant..." : "Confirmar"}
        </button>
      </form>
    </Modal>
  );
}
