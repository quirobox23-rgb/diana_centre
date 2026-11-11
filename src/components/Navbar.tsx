"use client";

import React from "react";
import { Sparkles, Calendar, Smartphone, Scissors, Clock, Users, Plus, UserCheck, MessageCircle, LogOut, BarChart3, Gift, Lock, LockOpen, KeyRound } from "lucide-react";

type TabId = "calendar" | "clients" | "bot" | "services" | "schedules" | "professionals" | "pending" | "summary" | "vouchers";

interface NavbarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onNewAppointmentClick: () => void;
  pendingCount?: number;
  ownerUnlocked?: boolean;
  lockedTabs?: TabId[];
  onLockClick?: () => void;
  onChangeKey?: () => void;
}

export function Navbar({ activeTab, onTabChange, onNewAppointmentClick, pendingCount = 0, ownerUnlocked = false, lockedTabs = [], onLockClick, onChangeKey }: NavbarProps) {
  interface TabItem {
    id: TabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    highlight?: boolean;
    badge?: number;
  }

  const tabs: TabItem[] = [
    { id: "pending", label: "Per confirmar", icon: MessageCircle, badge: pendingCount },
    { id: "calendar", label: "Calendari", icon: Calendar },
    { id: "clients", label: "Clientes", icon: Users },
    { id: "vouchers", label: "Xecs regal", icon: Gift },
    { id: "summary", label: "Resum", icon: BarChart3 },
    { id: "bot", label: "Simulador", icon: Smartphone },
    { id: "services", label: "Serveis", icon: Scissors },
    { id: "schedules", label: "Horaris", icon: Clock },
    { id: "professionals", label: "Professionals", icon: UserCheck },
  ];

  return (
    <header className="bg-white border-b border-terra-100 sticky top-0 z-40 shadow-xs">
      {/* Barra principal de navegació */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo i Marca */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange("calendar")}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-terra-500 via-arcilla-500 to-moka-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-stone-900">Estètica Diana</h1>
            </div>
          </div>

          {/* Botó Nova Cita Acció Directa */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onNewAppointmentClick}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-terra-600 to-arcilla-600 hover:from-terra-700 hover:to-arcilla-700 rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Cita</span>
            </button>
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
        <div className="flex space-x-1 overflow-x-auto pb-2 scrollbar-none border-t border-stone-100 pt-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
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
  );
}
