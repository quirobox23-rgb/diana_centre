"use client";

import React, { useEffect, useState } from "react";
import { Cake, Gift, HeartHandshake, MessageCircle, ChevronDown } from "lucide-react";

// Avisos a la pestanya Clientes: qui fa temps que no ve, aniversaris i xecs que caduquen.
// Cada fila té un botó que obre el WhatsApp amb el missatge ja escrit (s'envia a mà).

interface Lapsed { clientId: number; name: string; phone: string; lastVisit: string; daysSince: number; usualGap: number | null; visits: number; usualService: string | null }
interface Birthday { id: number; name: string; phone: string; birthday: string; inDays: number }
interface Voucher { id: number; code: string; recipientName: string; recipientPhone: string | null; expiryDate: string; remaining: string; kind: string; serviceText: string | null }

const firstName = (s: string) => {
  const w = s.trim().split(/\s+/)[0] || "";
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
};
const fmtDate = (d: string) => new Intl.DateTimeFormat("ca-ES", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

function waLink(phone: string | null | undefined, text: string): string | null {
  let digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 9) digits = `34${digits}`;
  if (!/^34[67]\d{8}$/.test(digits)) return null; // només mòbils espanyols
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function WaButton({ href }: { href: string | null }) {
  if (!href) return <span className="text-[10px] text-stone-400">sense mòbil</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#25D366] hover:brightness-95 text-white text-[11px] font-bold shrink-0"
    >
      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
    </a>
  );
}

function Section({ icon, title, count, children, defaultOpen = false }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-terra-100 rounded-2xl shadow-xs overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-bold text-stone-900">
          {icon} {title}
          <span className={`min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] flex items-center justify-center ${count ? "bg-terra-100 text-terra-800" : "bg-stone-100 text-stone-400"}`}>{count}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-3 border-t border-stone-100 pt-2">{children}</div>}
    </div>
  );
}

export function ClientAlerts() {
  const [data, setData] = useState<{ lapsed: Lapsed[]; lapsedTotal: number; birthdays: Birthday[]; vouchers: Voucher[] } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/clients/avisos", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && d.success && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
      <Section icon={<HeartHandshake className="w-4 h-4 text-terra-600" />} title="Fa temps que no venen" count={data.lapsedTotal}>
        {data.lapsed.length === 0 ? (
          <p className="text-xs text-stone-500">
            Cap de moment. Aquesta llista surt de les cites guardades a l&apos;app: s&apos;anirà omplint a mesura que hi hagi historial.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100 max-h-80 overflow-y-auto -mx-1">
            {data.lapsed.map((l) => (
              <li key={l.clientId} className="flex items-center justify-between gap-2 py-2 px-1">
                <div className="min-w-0 leading-tight">
                  <div className="text-xs font-bold text-stone-800 truncate">{l.name}</div>
                  <div className="text-[11px] text-stone-500 truncate">
                    Última visita fa {l.daysSince} dies{l.usualGap ? ` · sol venir cada ${l.usualGap}` : ""}
                    {l.usualService ? ` · ${l.usualService}` : ""}
                  </div>
                </div>
                <WaButton
                  href={waLink(
                    l.phone,
                    `Hola ${firstName(l.name)}! 😊 Fa temps que no et veiem per Estètica Diana. ${l.usualService ? `Et ve de gust reservar ${l.usualService.toLowerCase()}? ` : "Et ve de gust venir a cuidar-te? "}Respon aquest missatge i et busquem una hora. ✨`
                  )}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={<Cake className="w-4 h-4 text-terra-600" />} title="Aniversaris aquesta setmana" count={data.birthdays.length} defaultOpen={data.birthdays.length > 0}>
        {data.birthdays.length === 0 ? (
          <p className="text-xs text-stone-500">Cap aniversari els propers 7 dies.</p>
        ) : (
          <ul className="divide-y divide-stone-100 -mx-1">
            {data.birthdays.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 py-2 px-1">
                <div className="min-w-0 leading-tight">
                  <div className="text-xs font-bold text-stone-800 truncate">{b.name}</div>
                  <div className="text-[11px] text-stone-500">{b.inDays === 0 ? "Avui! 🎉" : b.inDays === 1 ? "Demà" : fmtDate(`2000-${b.birthday.slice(5)}`)}</div>
                </div>
                <WaButton href={waLink(b.phone, `Per molts anys, ${firstName(b.name)}! 🎉 De part de tot l'equip d'Estètica Diana, que passis un dia preciós. ✨`)} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={<Gift className="w-4 h-4 text-terra-600" />} title="Xecs regal que caduquen" count={data.vouchers.length} defaultOpen={data.vouchers.length > 0}>
        {data.vouchers.length === 0 ? (
          <p className="text-xs text-stone-500">Cap xec actiu caduca els propers 30 dies.</p>
        ) : (
          <ul className="divide-y divide-stone-100 -mx-1">
            {data.vouchers.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 py-2 px-1">
                <div className="min-w-0 leading-tight">
                  <div className="text-xs font-bold text-stone-800 truncate">
                    {v.recipientName} <span className="font-normal text-stone-400">· {v.code}</span>
                  </div>
                  <div className="text-[11px] text-stone-500 truncate">
                    Caduca el {fmtDate(v.expiryDate)} · {v.kind === "servei" ? v.serviceText || "servei" : `queden ${Number(v.remaining).toFixed(2)} €`}
                  </div>
                </div>
                <WaButton
                  href={waLink(
                    v.recipientPhone,
                    `Hola ${firstName(v.recipientName)}! 😊 Et recordem que el teu xec regal d'Estètica Diana caduca el ${fmtDate(v.expiryDate)}. Vols que et reservem una hora per gaudir-lo? ✨`
                  )}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
