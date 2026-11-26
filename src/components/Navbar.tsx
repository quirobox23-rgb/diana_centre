"use client";

import React, { useEffect, useRef, useState } from "react";
import { Sparkles, Calendar, Building2, Scissors, Clock, Users, Plus, UserCheck, MessageCircle, LogOut, BarChart3, Gift, Lock, LockOpen, KeyRound, Package, Download, ChevronLeft, LayoutGrid, X } from "lucide-react";

type TabId = "calendar" | "clients" | "office" | "services" | "schedules" | "professionals" | "pending" | "summary" | "vouchers" | "stock";

interface NavbarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onNewAppointmentClick: () => void;
  pendingCount?: number;
  ownerUnlocked?: boolean;
  lockedTabs?: TabId[];
  onLockClick?: () => void;
  onChangeKey?: () => void;
  /** Mòbil: fletxa per tornar a la pantalla anterior */
  onBack?: () => void;
}

export function Navbar({ activeTab, onTabChange, onNewAppointmentClick, pendingCount = 0, ownerUnlocked = false, lockedTabs = [], onLockClick, onChangeKey, onBack }: NavbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  // En el mòbil les pestanyes no hi caben: portem la pestanya activa a la vista.
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeTab]);

  interface TabItem {
    id: TabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    highlight?: boolean;
    badge?: number;
  }

  // Ordre per ús: primer el que es fa servir cada dia.
  const tabs: TabItem[] = [
    { id: "pending", label: "Per confirmar", icon: MessageCircle, badge: pendingCount },
    { id: "calendar", label: "Calendari", icon: Calendar },
    { id: "vouchers", label: "Xecs regal", icon: Gift },
    { id: "clients", label: "Clientes", icon: Users },
    { id: "stock", label: "Estoc", icon: Package },
    { id: "summary", label: "Resum", icon: BarChart3 },
    { id: "services", label: "Serveis", icon: Scissors },
    { id: "schedules", label: "Horaris", icon: Clock },
    { id: "professionals", label: "Professionals", icon: UserCheck },
    { id: "office", label: "Oficina", icon: Building2 },
  ];

  // Mòbil: les 4 pantalles de cada dia van a la barra de baix; la resta, dins de "Més".
  const PRIMARY: TabId[] = ["pending", "calendar", "vouchers", "clients"];
  const primaryTabs = tabs.filter((t) => PRIMARY.includes(t.id));
  const moreTabs = tabs.filter((t) => !PRIMARY.includes(t.id));
  const current = tabs.find((t) => t.id === activeTab);
  const inMore = !PRIMARY.includes(activeTab);
  const go = (id: TabId) => {
    setMoreOpen(false);
    onTabChange(id);
  };

  return (
    <>
    <header className="bg-white border-b border-terra-100 sticky top-0 z-40 shadow-xs">
      {/* Barra principal de navegació */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Mòbil: fletxa enrere + nom de la pantalla */}
          <div className="flex sm:hidden items-center gap-1 min-w-0">
            {inMore && (
              <button
                onClick={() => (onBack ? onBack() : onTabChange("calendar"))}
                title="Tornar"
                className="-ml-2 p-2 rounded-xl text-stone-600 hover:bg-terra-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {!inMore && (
              <div className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-br from-terra-500 via-arcilla-500 to-moka-600 flex items-center justify-center text-white shadow-md mr-1.5">
                <Sparkles className="w-4 h-4" />
              </div>
            )}
            <h1 className="text-base font-bold tracking-tight text-stone-900 truncate">{current?.label ?? "Estètica Diana"}</h1>
          </div>

          {/* Logo i Marca */}
          <div className="hidden sm:flex items-center space-x-2 sm:space-x-3 cursor-pointer min-w-0" onClick={() => onTabChange("calendar")}>
            <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-2xl bg-gradient-to-br from-terra-500 via-arcilla-500 to-moka-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight leading-tight text-stone-900">Estètica Diana</h1>
            </div>
          </div>

          {/* Botó Nova Cita Acció Directa */}
          <div className="flex items-center space-x-1 sm:space-x-3 shrink-0">
            <button
              onClick={onNewAppointmentClick}
              className="inline-flex items-center whitespace-nowrap space-x-1.5 px-3 sm:px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-terra-600 to-arcilla-600 hover:from-terra-700 hover:to-arcilla-700 rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Cita</span>
            </button>
            {ownerUnlocked && (
              <a
                href="/api/backup"
                title="Descarregar còpia de totes les dades (guarda-la en un lloc segur)"
                className="inline-flex items-center gap-1.5 p-2 sm:px-3 text-xs font-bold text-stone-600 hover:text-terra-700 hover:bg-terra-50 rounded-xl transition-all"
              >
                <Download className="w-4 h-4" />
                <span className="hidden md:inline">Descarregar còpia</span>
              </a>
            )}
            {ownerUnlocked && onChangeKey && (
              <button
                onClick={onChangeKey}
                title="Canviar la clau del candado"
                className="hidden sm:inline-flex items-center p-2 text-stone-400 hover:text-terra-700 hover:bg-terra-50 rounded-xl transition-all"
              >
                <KeyRound className="w-4 h-4" />
              </button>
            )}
            {onLockClick && (
              <button
                onClick={onLockClick}
                title={ownerUnlocked ? "Tancar el candado" : "Obrir el candado (dueña)"}
                className={`inline-flex items-center p-2 rounded-xl transition-all ${
                  ownerUnlocked ? "text-terra-700 bg-terra-50 border border-terra-200" : "text-stone-500 hover:text-terra-700 hover:bg-terra-50"
                }`}
              >
                {ownerUnlocked ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              title="Tancar sessió"
              className="inline-flex items-center p-2 text-stone-500 hover:text-terra-700 hover:bg-terra-50 rounded-xl transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pestanyes de navegació */}
        <div ref={tabsRef} className="hidden sm:flex space-x-1 overflow-x-auto pb-2 scrollbar-none border-t border-stone-100 pt-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                data-active={isActive}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-terra-50 text-terra-700 border border-terra-200 shadow-xs"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-terra-600" : "text-stone-400"}`} />
                <span>{tab.label}</span>
                {lockedTabs.includes(tab.id) && <Lock className="w-3 h-3 text-stone-400" />}
                {!!tab.badge && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold ">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>

      {/* Mòbil: barra de pantalles a baix, a l'abast del dit */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-stone-200 shadow-[0_-2px_10px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => go(tab.id)}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${isActive ? "text-terra-700" : "text-stone-500"}`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-terra-600" : "text-stone-400"}`} />
                <span className="truncate max-w-full px-1">{tab.label}</span>
                {!!tab.badge && (
                  <span className="absolute top-1 left-1/2 ml-2 flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold">
                    {tab.badge}
                  </span>
                )}
                {isActive && <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-terra-600" />}
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${inMore ? "text-terra-700" : "text-stone-500"}`}
          >
            <LayoutGrid className={`w-5 h-5 ${inMore ? "text-terra-600" : "text-stone-400"}`} />
            <span>Més</span>
            {inMore && <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-terra-600" />}
          </button>
        </div>
      </nav>

      {/* Mòbil: menú "Més" amb la resta de pantalles */}
      {moreOpen && (
        <div className="sm:hidden fixed inset-0 z-50 bg-stone-900/40 flex items-end" onClick={() => setMoreOpen(false)}>
          <div
            className="w-full bg-white rounded-t-3xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-stone-900">Més pantalles</span>
              <button onClick={() => setMoreOpen(false)} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100" title="Tancar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {moreTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => go(tab.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-bold ${
                      isActive ? "bg-terra-50 border-terra-200 text-terra-700" : "bg-stone-50 border-stone-200 text-stone-700"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? "text-terra-600" : "text-stone-500"}`} />
                    <span className="flex items-center gap-1">
                      {tab.label}
                      {lockedTabs.includes(tab.id) && <Lock className="w-3 h-3 text-stone-400" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
