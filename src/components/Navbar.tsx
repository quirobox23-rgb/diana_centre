"use client";

import React from "react";
import { Sparkles, Calendar, Smartphone, Scissors, Clock, Users, Plus, Phone, UserCheck, MessageCircle, LogOut } from "lucide-react";

type TabId = "calendar" | "clients" | "bot" | "services" | "schedules" | "professionals" | "pending";

interface NavbarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onNewAppointmentClick: () => void;
  pendingCount?: number;
}

export function Navbar({ activeTab, onTabChange, onNewAppointmentClick, pendingCount = 0 }: NavbarProps) {
  interface TabItem {
    id: TabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    highlight?: boolean;
    badge?: number;
  }

  const tabs: TabItem[] = [
    { id: "pending", label: "Sol·licituds per confirmar", icon: MessageCircle, badge: pendingCount },
    { id: "calendar", label: "Calendari de Sales (Dia & Setmana)", icon: Calendar },
    { id: "clients", label: "Fitxer de Clientes", icon: Users },
    { id: "bot", label: "Simulador Mòbil Cites (3 Opcions)", icon: Smartphone },
    { id: "services", label: "Serveis & Tractaments", icon: Scissors },
    { id: "schedules", label: "Horaris d'Obertura", icon: Clock },
    { id: "professionals", label: "Professionals", icon: UserCheck },
  ];

  return (
    <header className="bg-white border-b border-terra-100 sticky top-0 z-40 shadow-xs">
      {/* Barra superior de benvinguda */}
      <div className="bg-gradient-to-r from-terra-700 via-arcilla-700 to-terra-800 text-white py-1 px-4 text-xs font-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span>Estètica Diana</span>
          </div>
          <div className="hidden sm:flex items-center space-x-4 text-terra-100">
            <span className="flex items-center space-x-1">
              <Phone className="w-3 h-3" />
              <span>Cites i WhatsApp: +34 689 34 52 10</span>
            </span>
          </div>
        </div>
      </div>

      {/* Barra principal de navegació */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo i Marca */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange("calendar")}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-terra-500 via-arcilla-500 to-moka-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-stone-900 flex items-center space-x-1.5">
                <span>Estètica Diana</span>
                <span className="text-xs font-bold text-terra-600 bg-terra-50 px-2 py-0.5 rounded-full border border-terra-100">
                  Bellesa & Benestar
                </span>
              </h1>
              <p className="text-[11px] text-stone-400 font-medium -mt-0.5">
                Visió 3 Sales (Dia & Setmana) · Fitxer Clientes · Bot WhatsApp
              </p>
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
                {!!tab.badge && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
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
