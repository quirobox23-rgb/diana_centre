"use client";

import React, { useState } from "react";
import { Clock, CheckCircle2, AlertCircle, Plus, Calendar, Save, Sun, Moon } from "lucide-react";
import { Schedule } from "@/types";

interface ScheduleManagerProps {
  schedules: Schedule[];
  onSchedulesUpdated: () => void;
}

export function ScheduleManager({ schedules, onSchedulesUpdated }: ScheduleManagerProps) {
  const [localSchedules, setLocalSchedules] = useState<Schedule[]>(schedules);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Per afegir dia especial o nou horari
  const [isAddSpecialOpen, setIsAddSpecialOpen] = useState(false);
  const [specialDayName, setSpecialDayName] = useState("");
  const [specialMorningStart, setSpecialMorningStart] = useState("10:00");
  const [specialMorningEnd, setSpecialMorningEnd] = useState("14:00");
  const [specialAfternoonStart, setSpecialAfternoonStart] = useState("16:00");
  const [specialAfternoonEnd, setSpecialAfternoonEnd] = useState("20:00");
  const [specialNotes, setSpecialNotes] = useState("");
  const [addingSpecial, setAddingSpecial] = useState(false);

  // Sincronitzar amb props
  React.useEffect(() => {
    setLocalSchedules(schedules);
  }, [schedules]);

  const handleFieldChange = (id: number, field: keyof Schedule, value: unknown) => {
    setLocalSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleSaveDay = async (sch: Schedule) => {
    setSavingId(sch.id);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/schedules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sch.id,
          isOpen: sch.isOpen,
          morningStart: sch.morningStart,
          morningEnd: sch.morningEnd,
          afternoonStart: sch.afternoonStart,
          afternoonEnd: sch.afternoonEnd,
          notes: sch.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Error al desar l'horari");
        setSavingId(null);
        return;
      }

      setSuccessMsg(`Horari de ${sch.dayName} desat correctament!`);
      setTimeout(() => setSuccessMsg(null), 3000);
      onSchedulesUpdated();
    } catch (err: unknown) {
      setErrorMsg("Error de xarxa: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingId(null);
    }
  };

  const handleAddSpecial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialDayName.trim()) return;

    setAddingSpecial(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayOfWeek: 99,
          dayName: specialDayName.trim(),
          isOpen: true,
          morningStart: specialMorningStart,
          morningEnd: specialMorningEnd,
          afternoonStart: specialAfternoonStart,
          afternoonEnd: specialAfternoonEnd,
          notes: specialNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Dia especial "${specialDayName}" afegit correctament!`);
        setTimeout(() => setSuccessMsg(null), 3000);
        setIsAddSpecialOpen(false);
        setSpecialDayName("");
        onSchedulesUpdated();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingSpecial(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Capçalera */}
      <div className="bg-white rounded-2xl shadow-xs border border-rose-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-rose-600" />
            <span>Gestió d&apos;Horaris d&apos;Obertura i Disponibilitat</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configura els torns de matí i tarda per a cada dia de la setmana. El bot utilitza aquests intervals per oferir les 3 opcions.
          </p>
        </div>

        <button
          onClick={() => setIsAddSpecialOpen(!isAddSpecialOpen)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 rounded-xl shadow-xs transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Afegir Horari Especial</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Formulari per afegir dia especial */}
      {isAddSpecialOpen && (
        <form
          onSubmit={handleAddSpecial}
          className="bg-white rounded-2xl p-5 border border-rose-200 shadow-md space-y-4"
        >
          <h3 className="font-bold text-sm text-gray-900 flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-rose-600" />
            <span>Afegir Dia Especial o Festiu Obert</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div className="md:col-span-2">
              <label className="block text-gray-700 font-medium mb-1">Nom del dia / Data especial:</label>
              <input
                type="text"
                required
                placeholder="Ex: Festiu de Sant Jordi (23 d'abril)"
                value={specialDayName}
                onChange={(e) => setSpecialDayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">Torn Matí:</label>
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  value={specialMorningStart}
                  onChange={(e) => setSpecialMorningStart(e.target.value)}
                  className="w-16 px-1.5 py-1 text-center border rounded-md"
                />
                <span>-</span>
                <input
                  type="text"
                  value={specialMorningEnd}
                  onChange={(e) => setSpecialMorningEnd(e.target.value)}
                  className="w-16 px-1.5 py-1 text-center border rounded-md"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">Torn Tarda:</label>
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  value={specialAfternoonStart}
                  onChange={(e) => setSpecialAfternoonStart(e.target.value)}
                  className="w-16 px-1.5 py-1 text-center border rounded-md"
                />
                <span>-</span>
                <input
                  type="text"
                  value={specialAfternoonEnd}
                  onChange={(e) => setSpecialAfternoonEnd(e.target.value)}
                  className="w-16 px-1.5 py-1 text-center border rounded-md"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={addingSpecial}
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors text-xs"
              >
                {addingSpecial ? "Afegint..." : "Guardar Dia Especial"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Llista dels 7 dies de la setmana */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs divide-y divide-gray-100 overflow-hidden">
        {localSchedules.map((sch) => {
          const isSaving = savingId === sch.id;

          return (
            <div
              key={sch.id}
              className={`p-4 transition-colors ${
                !sch.isOpen ? "bg-stone-50/70 opacity-75" : "hover:bg-rose-50/20"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Dia i Interruptor Obert/Tancat */}
                <div className="flex items-center space-x-3 w-48 shrink-0">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      sch.isOpen ? "bg-emerald-500" : "bg-gray-300"
                    }`}
                  />
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">{sch.dayName}</h4>
                    <label className="flex items-center space-x-1.5 mt-0.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sch.isOpen}
                        onChange={(e) => handleFieldChange(sch.id, "isOpen", e.target.checked)}
                        className="rounded-sm text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                      />
                      <span className="text-[11px] font-medium text-gray-500">
                        {sch.isOpen ? "Obert al públic" : "Tancat (Descans)"}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Torns Matí i Tarda */}
                {sch.isOpen ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 flex-1 text-xs">
                    {/* Torn de Matí */}
                    <div className="flex items-center space-x-2 bg-amber-50/60 p-2.5 rounded-xl border border-amber-100">
                      <Sun className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="font-semibold text-amber-900 block text-[11px]">
                          Matí
                        </span>
                        <div className="flex items-center space-x-1 mt-0.5">
                          <input
                            type="time"
                            value={sch.morningStart}
                            onChange={(e) =>
                              handleFieldChange(sch.id, "morningStart", e.target.value)
                            }
                            className="bg-white px-2 py-0.5 border border-amber-200 rounded-md font-semibold text-gray-800 text-xs"
                          />
                          <span className="text-gray-400">fins a</span>
                          <input
                            type="time"
                            value={sch.morningEnd}
                            onChange={(e) =>
                              handleFieldChange(sch.id, "morningEnd", e.target.value)
                            }
                            className="bg-white px-2 py-0.5 border border-amber-200 rounded-md font-semibold text-gray-800 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Torn de Tarda */}
                    <div className="flex items-center space-x-2 bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100">
                      <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <span className="font-semibold text-indigo-900 block text-[11px]">
                          Tarda
                        </span>
                        <div className="flex items-center space-x-1 mt-0.5">
                          <input
                            type="time"
                            value={sch.afternoonStart}
                            onChange={(e) =>
                              handleFieldChange(sch.id, "afternoonStart", e.target.value)
                            }
                            className="bg-white px-2 py-0.5 border border-indigo-200 rounded-md font-semibold text-gray-800 text-xs"
                          />
                          <span className="text-gray-400">fins a</span>
                          <input
                            type="time"
                            value={sch.afternoonEnd}
                            onChange={(e) =>
                              handleFieldChange(sch.id, "afternoonEnd", e.target.value)
                            }
                            className="bg-white px-2 py-0.5 border border-indigo-200 rounded-md font-semibold text-gray-800 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Observacions */}
                    <div className="flex items-center">
                      <input
                        type="text"
                        placeholder="Observacions (ex: Cita prèvia)"
                        value={sch.notes || ""}
                        onChange={(e) => handleFieldChange(sch.id, "notes", e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-700"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 text-xs text-gray-400 italic py-2">
                    Aquest dia el centre roman tancat per descans del personal.
                  </div>
                )}

                {/* Botó Desar */}
                <div className="shrink-0 flex items-center justify-end">
                  <button
                    onClick={() => handleSaveDay(sch)}
                    disabled={isSaving}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? "Desant..." : "Desar Canvis"}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
