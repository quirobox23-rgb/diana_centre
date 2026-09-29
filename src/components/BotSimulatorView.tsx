"use client";

import React, { useState, useEffect } from "react";
import {
  Smartphone,
  Send,
  Sparkles,
  Bot,
  User,
  CheckCircle,
  Clock,
  Calendar,
  Layers,
  Check,
  ChevronRight,
  Code,
  Settings,
  History,
  MessageSquare,
  RefreshCw,
  PhoneCall,
  CheckCheck,
} from "lucide-react";
import { ProposedSlot, BotSimulation, Service } from "@/types";

interface BotSimulatorViewProps {
  services: Service[];
  onAppointmentBooked: (date: string) => void;
}

interface ChatMessage {
  id: string;
  sender: "client" | "bot" | "system";
  text: string;
  timestamp: string;
  slots?: ProposedSlot[];
  selectedSlotIndex?: number;
  simulationId?: number;
}

export function BotSimulatorView({ services, onAppointmentBooked }: BotSimulatorViewProps) {
  const [activeTab, setActiveTab] = useState<"simulator" | "history" | "webhook">("simulator");
  const [clientName, setClientName] = useState("Carla Soler");
  const [clientPhone, setClientPhone] = useState("+34 622 88 99 00");
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bookingSlotIndex, setBookingSlotIndex] = useState<number | null>(null);
  const [confirmedSuccess, setConfirmedSuccess] = useState<string | null>(null);

  const [history, setHistory] = useState<BotSimulation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Missatges inicials de mostra al xat
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "system",
      text: "Simulador de missatgeria mòbil (WhatsApp / SMS) d'Estètica Diana activat. L'algoritme analitza la disponibilitat real de les 3 sales i ofereix 3 opcions d'horari automàticament.",
      timestamp: "09:30",
    },
    {
      id: "2",
      sender: "client",
      text: "Hola! Voldria demanar cita per fer-me les ungles semipermanents aquesta setmana a la tarda si teniu lloc.",
      timestamp: "09:31",
    },
    {
      id: "3",
      sender: "bot",
      text: "Hola Carla! ✨ Gràcies per contactar amb Estètica Diana.\n\nHe buscat a la nostra agenda per al servei de Manicura Russa Semipermanent (60 min - 35€) a la Cabina 3 amb la Laia.\n\nAquestes són les 3 opcions disponibles més properes:",
      timestamp: "09:31",
      slots: [
        {
          date: new Date().toISOString().split("T")[0],
          displayDate: "Avui",
          time: "17:30",
          endTime: "18:30",
          roomId: 3,
          roomName: "Cabina 3 - Mans, Peus & Mirada",
          professionalId: 3,
          professionalName: "Laia Puig",
        },
        {
          date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
          displayDate: "Demà",
          time: "16:00",
          endTime: "17:00",
          roomId: 3,
          roomName: "Cabina 3 - Mans, Peus & Mirada",
          professionalId: 3,
          professionalName: "Laia Puig",
        },
        {
          date: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
          displayDate: "Passat demà",
          time: "18:30",
          endTime: "19:30",
          roomId: 3,
          roomName: "Cabina 3 - Mans, Peus & Mirada",
          professionalId: 3,
          professionalName: "Laia Puig",
        },
      ],
      selectedSlotIndex: undefined,
    },
  ]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/bot");
      const data = await res.json();
      if (data.success && data.history) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab]);

  // Enviar missatge al bot simulador
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "client",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setLoading(true);
    setIsTyping(true);
    setConfirmedSuccess(null);

    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientPhone,
          clientName,
          message: textToSend,
        }),
      });

      const data = await res.json();
      setIsTyping(false);

      if (data.success) {
        const botMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: "bot",
          text: data.replyMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          slots: data.proposedSlots,
          simulationId: data.simulationId,
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        const botErrorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: "bot",
          text: `Hola ${clientName}! Ho sento, he tingut un petit problema en consultar l'agenda. Si us plau, especifica quin servei o tractament desitges (per exemple: neteja facial, ungles, làser o massatge).`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, botErrorMsg]);
      }
    } catch (err) {
      setIsTyping(false);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Confirmar una de les 3 opcions proposades
  const handleSelectSlot = async (msgId: string, slotIndex: number, slot: ProposedSlot, simId?: number) => {
    setBookingSlotIndex(slotIndex);
    try {
      const res = await fetch("/api/bot/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulationId: simId,
          slotIndex,
          manualSlot: slot,
          clientName,
          clientPhone,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Actualitzar missatge per marcar l'opció com a seleccionada
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, selectedSlotIndex: slotIndex } : m))
        );

        // Afegir resposta de confirmació del client
        const clientChoiceMsg: ChatMessage = {
          id: Date.now().toString(),
          sender: "client",
          text: `Vull l'opció ${slotIndex + 1}: ${slot.displayDate} a les ${slot.time}h`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        // Afegir resposta final de confirmació del bot
        const botConfirmationMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: "bot",
          text: data.confirmationMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        setMessages((prev) => [...prev, clientChoiceMsg, botConfirmationMsg]);
        setConfirmedSuccess(`La cita ha quedat confirmada per al dia ${slot.date} a les ${slot.time}h a la ${slot.roomName}!`);
        onAppointmentBooked(slot.date);
      }
    } catch (err) {
      console.error("Error booking slot:", err);
    } finally {
      setBookingSlotIndex(null);
    }
  };

  // Casos de prova ràpids
  const quickScenarios = [
    {
      title: "💅 Manicura Semipermanent (Tarda)",
      prompt: "Hola! Voldria demanar cita per fer-me les ungles semipermanents aquesta setmana a la tarda si teniu lloc.",
    },
    {
      title: "🧖‍♀️ Neteja Facial Profunda (Matí)",
      prompt: "Bones! Voldria demanar hora per una neteja facial d'oxigen al matí, si us plau.",
    },
    {
      title: "⚡ Depilació Làser Camallers",
      prompt: "Hola Diana! Teniu buit per depilació làser díode de cames aquesta setmana?",
    },
    {
      title: "💆 Massatge Relaxant Aromateràpia",
      prompt: "Bona tarda, necessito un massatge relaxant d'olis essencials per desconnectar, quan teniu disponibilitat?",
    },
    {
      title: "👁️ Lifting i Tint de Pestanyes",
      prompt: "Hola! Vull cita per fer-me un lifting de pestanyes amb tint abans del cap de setmana.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Barra de Pestanyes */}
      <div className="bg-white rounded-2xl shadow-xs border border-rose-100 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-xs">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
              <span>Simulador de Resposta Automàtica Mòbil (WhatsApp / SMS)</span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase">
                Simulat & Preparat
              </span>
            </h2>
            <p className="text-xs text-gray-500">
              Quan arriba un missatge demanant cita, respon automàticament oferint les 3 millors hores lliures.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab("simulator")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center space-x-1.5 ${
              activeTab === "simulator"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Simulador Interactiv</span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center space-x-1.5 ${
              activeTab === "history"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial de Missatges</span>
          </button>
          <button
            onClick={() => setActiveTab("webhook")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center space-x-1.5 ${
              activeTab === "webhook"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Code className="w-4 h-4" />
            <span>Connexió Real (Webhook / API)</span>
          </button>
        </div>
      </div>

      {confirmedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{confirmedSuccess}</span>
          </div>
          <button
            onClick={() => setConfirmedSuccess(null)}
            className="text-xs font-bold text-emerald-900 underline ml-4 hover:text-emerald-700"
          >
            D&apos;acord
          </button>
        </div>
      )}

      {/* PESTANYA 1: SIMULADOR INTERACTIU */}
      {activeTab === "simulator" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Panell de Control i Proves a l'esquerra (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-gray-900 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-rose-500" />
                <span>Simula un Missatge Entrant de Clienta</span>
              </h3>

              {/* Dades de la clienta remitent */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Nom Clienta:</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Mòbil Remitent:</label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Escenaris predefinits */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Proves Ràpides amb 1 Clic:
                </label>
                <div className="space-y-2">
                  {quickScenarios.map((sc, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSendMessage(sc.prompt)}
                      disabled={loading}
                      className="w-full text-left p-2.5 rounded-xl border border-gray-200 hover:border-rose-300 hover:bg-rose-50/50 transition-all text-xs group flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-gray-800 group-hover:text-rose-700">
                          {sc.title}
                        </div>
                        <div className="text-gray-500 line-clamp-1 mt-0.5 text-[11px]">
                          &ldquo;{sc.prompt}&rdquo;
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-rose-600 shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Explicació de com funciona la IA i el simulador */}
              <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 text-xs text-stone-700 space-y-1.5">
                <p className="font-bold text-stone-900 flex items-center space-x-1">
                  <Bot className="w-4 h-4 text-rose-600" />
                  <span>Com respon el sistema:</span>
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-stone-600">
                  <li>Detecta el tractament sol·licitat (neteja, ungles, làser, massatges).</li>
                  <li>Identifica la cabina assignada (Cabina 1, 2 o 3) i la professional especialitzada.</li>
                  <li>Revisa els horaris reals d&apos;obertura i les cites ja ocupades a la base de dades.</li>
                  <li>Proposa 3 opcions d&apos;horari disponibles i permet reservar en un sol clic.</li>
                </ol>
              </div>
            </div>
          </div>

          {/* SIMULADOR SMARTPHONE MÒBIL (7 cols) */}
          <div className="lg:col-span-7 flex justify-center">
            {/* Marc del Telèfon Mòbil estil iPhone */}
            <div className="w-full max-w-[430px] bg-slate-900 rounded-[44px] p-3.5 shadow-2xl border-4 border-slate-700">
              {/* Pantalla interior */}
              <div className="bg-[#efeae2] rounded-[36px] overflow-hidden flex flex-col h-[650px] relative shadow-inner">
                {/* Barra d'estat superior del telèfon */}
                <div className="bg-[#075e54] text-white px-6 pt-3 pb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-xs tracking-tight">09:41</span>
                  {/* Dynamic Island / Notch */}
                  <div className="w-20 h-4 bg-black/60 rounded-full" />
                  <div className="flex items-center space-x-1.5 text-[11px]">
                    <span>5G</span>
                    <div className="w-4 h-2 border border-white rounded-xs p-0.5">
                      <div className="w-full h-full bg-white" />
                    </div>
                  </div>
                </div>

                {/* Capçalera WhatsApp d'Estètica Diana */}
                <div className="bg-[#075e54] text-white px-4 py-3 flex items-center justify-between shadow-md">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-400 to-rose-500 flex items-center justify-center font-bold text-white shadow-sm border border-white/40">
                        ED
                      </div>
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#075e54] rounded-full" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm leading-tight">Estètica Diana ✨</h4>
                      <p className="text-[11px] text-emerald-200">En línia · Resposta automàtica</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 text-white/80">
                    <PhoneCall className="w-4 h-4 cursor-pointer hover:text-white" />
                  </div>
                </div>

                {/* Àrea de Missatges del Xat */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]/60 bg-[radial-gradient(#d1c7b8_1px,transparent_1px)] [background-size:16px_16px]">
                  {messages.map((msg) => {
                    if (msg.sender === "system") {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <span className="text-[10px] bg-amber-100/90 text-amber-900 border border-amber-200 px-3 py-1 rounded-full text-center max-w-[85%] font-medium shadow-xs">
                            {msg.text}
                          </span>
                        </div>
                      );
                    }

                    const isClient = msg.sender === "client";

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isClient ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-xs relative text-xs leading-relaxed ${
                            isClient
                              ? "bg-[#dcf8c6] text-gray-900 rounded-tr-none"
                              : "bg-white text-gray-900 rounded-tl-none border border-gray-100"
                          }`}
                        >
                          <div className="whitespace-pre-line">{msg.text}</div>

                          {/* Targetes amb les 3 OPCIONS D'HORARI proposades pel bot */}
                          {msg.slots && msg.slots.length > 0 && (
                            <div className="mt-3 space-y-2 pt-2 border-t border-gray-100">
                              <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                                📅 Tria una de les 3 opcions:
                              </p>

                              {msg.slots.map((slot, sIdx) => {
                                const isSelected = msg.selectedSlotIndex === sIdx;
                                const isBookingThis = bookingSlotIndex === sIdx;

                                return (
                                  <div
                                    key={sIdx}
                                    className={`p-2.5 rounded-xl border transition-all ${
                                      isSelected
                                        ? "bg-emerald-50 border-emerald-500 shadow-xs"
                                        : "bg-stone-50 hover:bg-rose-50/60 border-stone-200 hover:border-rose-300"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <div className="flex items-center space-x-1.5 font-bold text-gray-900 text-xs">
                                          <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px]">
                                            {sIdx + 1}
                                          </span>
                                          <span>{slot.displayDate}</span>
                                          <span className="text-rose-600 font-extrabold">
                                            {slot.time}h
                                          </span>
                                        </div>
                                        <div className="text-[11px] text-gray-500 mt-1 flex flex-col space-y-0.5">
                                          <span>🏢 {slot.roomName}</span>
                                          <span>👩‍🦰 {slot.professionalName}</span>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        disabled={msg.selectedSlotIndex !== undefined || isBookingThis}
                                        onClick={() =>
                                          handleSelectSlot(msg.id, sIdx, slot, msg.simulationId)
                                        }
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                          isSelected
                                            ? "bg-emerald-600 text-white"
                                            : msg.selectedSlotIndex !== undefined
                                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                            : "bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                                        }`}
                                      >
                                        {isSelected ? (
                                          <span className="flex items-center space-x-1">
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Reservada</span>
                                          </span>
                                        ) : isBookingThis ? (
                                          "Agendant..."
                                        ) : (
                                          "Confirmar"
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div
                            className={`flex items-center justify-end space-x-1 text-[10px] text-gray-400 mt-1 ${
                              isClient ? "text-emerald-700/80" : ""
                            }`}
                          >
                            <span>{msg.timestamp}</span>
                            {isClient && <CheckCheck className="w-3.5 h-3.5 text-sky-500" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Indicador d'escrivint */}
                  {isTyping && (
                    <div className="flex items-center space-x-1.5 bg-white text-gray-500 px-3 py-2 rounded-2xl rounded-tl-none w-fit shadow-xs text-xs">
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse delay-100" />
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse delay-200" />
                      <span className="text-[11px] text-gray-400 ml-1">
                        Estètica Diana està escrivint...
                      </span>
                    </div>
                  )}
                </div>

                {/* Barra d'escriptura inferior de WhatsApp */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="bg-[#f0f2f5] p-2 flex items-center space-x-2 border-t border-gray-200"
                >
                  <input
                    type="text"
                    placeholder="Escriu com a clienta (ex: vull cita per...)"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    disabled={loading}
                    className="flex-1 bg-white px-3.5 py-2 text-xs rounded-full border border-gray-300 focus:outline-hidden focus:border-rose-500 text-gray-800"
                  />
                  <button
                    type="submit"
                    disabled={loading || !inputMessage.trim()}
                    className="w-9 h-9 rounded-full bg-[#075e54] hover:bg-[#128c7e] text-white flex items-center justify-center transition-colors disabled:opacity-40 shrink-0 shadow-xs"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PESTANYA 2: HISTORIAL DE MISSATGES I SIMULACIONS */}
      {activeTab === "history" && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm flex items-center space-x-2">
              <History className="w-4 h-4 text-rose-600" />
              <span>Registre de Missatges i Simulacions d&apos;Horaris</span>
            </h3>
            <button
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center space-x-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
              <span>Actualitzar</span>
            </button>
          </div>

          {history.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Encara no s&apos;ha registrat cap conversa al simulador.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {history.map((sim) => (
                <div key={sim.id} className="py-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-gray-900">{sim.clientName}</span>
                      <span className="text-gray-500">({sim.clientPhone})</span>
                      <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-medium">
                        {sim.detectedIntent || "Cita"}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        sim.status === "cita_confirmada"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {sim.status === "cita_confirmada" ? "Cita Confirmada" : "Opcions Enviades"}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-700">
                    <span className="font-semibold text-gray-900">Missatge entrant:</span> &ldquo;
                    {sim.incomingMessage}&rdquo;
                  </div>

                  {sim.proposedSlots && (
                    <div className="text-[11px] text-gray-600">
                      <span className="font-semibold text-rose-700">3 Opcions proposades: </span>
                      {(() => {
                        try {
                          const slots = JSON.parse(sim.proposedSlots);
                          return slots
                            .map((s: ProposedSlot, i: number) => `Opció ${i + 1}: ${s.displayDate || s.date} ${s.time}h`)
                            .join(" · ");
                        } catch {
                          return "";
                        }
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PESTANYA 3: CONNEXIÓ REAL (INSTRUCCIONS DE CONNEXIÓ AMB WHATSAPP CLOUD API O TWILIO) */}
      {activeTab === "webhook" && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="font-bold text-base text-gray-900 flex items-center space-x-2">
              <Code className="w-5 h-5 text-rose-600" />
              <span>Com connectar el teu número de WhatsApp real quan estiguis a punt</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              L&apos;aplicació ja té l&apos;endpoint de Webhook creat i el motor d&apos;intel·ligència de 3 opcions preparat. Quan vulguis activar el número mòbil real del centre, segueix aquests passos:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* Opció A: WhatsApp Cloud API de Meta */}
            <div className="p-4 rounded-xl border border-gray-200 bg-stone-50 space-y-3">
              <h4 className="font-bold text-sm text-gray-900 flex items-center space-x-1.5">
                <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                  A
                </span>
                <span>Meta WhatsApp Cloud API (Recomanat & Oficial)</span>
              </h4>
              <p className="text-gray-600 leading-relaxed">
                1. Registra el número de mòbil d&apos;Estètica Diana a developers.facebook.com.
                <br />
                2. A la configuració del Webhook de WhatsApp, afegeix:
              </p>
              <div className="p-2.5 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto">
                URL de Retorn: https://el-teu-domini.cat/api/bot/webhook
                <br />
                Token de Verificació: estetica_diana_token
              </div>
              <p className="text-gray-600">
                3. Subscriu-te a l&apos;esdeveniment &ldquo;messages&rdquo;. El bot respondrà en mil·lisegons a qualsevol clienta que enviï un WhatsApp.
              </p>
            </div>

            {/* Opció B: Twilio per a WhatsApp / SMS */}
            <div className="p-4 rounded-xl border border-gray-200 bg-stone-50 space-y-3">
              <h4 className="font-bold text-sm text-gray-900 flex items-center space-x-1.5">
                <span className="w-5 h-5 rounded-md bg-rose-600 text-white flex items-center justify-center text-[10px]">
                  B
                </span>
                <span>Twilio WhatsApp / SMS Sandbox</span>
              </h4>
              <p className="text-gray-600 leading-relaxed">
                1. A la consola de Twilio, ves a <strong>Messaging &gt; Senders</strong>.
                <br />
                2. A la secció &ldquo;When a message comes in&rdquo;, selecciona Webhook POST:
              </p>
              <div className="p-2.5 rounded-lg bg-slate-900 text-rose-400 font-mono text-[11px] overflow-x-auto">
                POST https://el-teu-domini.cat/api/bot
              </div>
              <p className="text-gray-600">
                3. Twilio enviarà automàticament el missatge, el mòbil del remitent i rebrà les 3 opcions en format text i botons interactius.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
