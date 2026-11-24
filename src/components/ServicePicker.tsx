"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { groupBySection } from "@/lib/service-catalog";

interface PickerService {
  id: number;
  name: string;
  category: string;
  color: string;
  durationMinutes: number;
  price: string;
  isActive: boolean;
}

interface ServicePickerProps {
  services: PickerService[];
  value: number | null | undefined;
  onChange: (id: number) => void;
  placeholder?: string;
  /** mostra durada i preu a cada línia */
  showDetails?: boolean;
  className?: string;
}

/** Bola amb el color del tractament (el mateix que al calendari i a Google Calendar). */
export function ColorDot({ color, size = 14 }: { color?: string | null; size?: number }) {
  return (
    <span
      className="inline-block rounded-full shrink-0 ring-1 ring-black/10"
      style={{ backgroundColor: color || "#d6d3d1", width: size, height: size }}
    />
  );
}

/**
 * Desplegable de tractaments amb el nom i, a la dreta, la bola del color,
 * perquè es pugui triar mirant el color. Agrupat per seccions de la carta i amb cercador.
 */
export function ServicePicker({ services, value, onChange, placeholder = "Tria el tractament…", showDetails, className = "" }: ServicePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = services.find((s) => s.id === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const q = norm(query.trim());
  const visible = services.filter((s) => (s.isActive || s.id === value) && (!q || norm(s.name).includes(q)));
  const groups = groupBySection(visible);

  const pick = (id: number) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const details = (s: PickerService) =>
    `${s.durationMinutes} min${Number(s.price) > 0 ? ` · ${Number(s.price)} €` : ""}`;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white text-left focus:ring-2 focus:ring-terra-500"
      >
        <span className={`flex-1 truncate ${selected ? "text-stone-900" : "text-stone-400"}`}>
          {selected ? selected.name : placeholder}
          {selected && showDetails && <span className="text-stone-400"> · {details(selected)}</span>}
        </span>
        {selected && <ColorDot color={selected.color} />}
        <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
      </button>

      {open && (
        <div className="mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-stone-100 flex items-center gap-2">
            <Search className="w-4 h-4 text-stone-400 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca…"
              className="flex-1 min-w-0 w-full text-sm outline-hidden bg-transparent"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {groups.length === 0 && <div className="px-3 py-3 text-xs text-stone-400">Cap tractament</div>}
            {groups.map(({ section, items }) => (
              <div key={section.id}>
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">{section.label}</div>
                {items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pick(s.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-stone-50 ${
                      s.id === value ? "bg-terra-50 font-semibold" : ""
                    }`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-stone-900">{s.name}</span>
                      {showDetails && <span className="block text-[11px] text-stone-400">{details(s)}</span>}
                    </span>
                    <ColorDot color={s.color} size={16} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
