import { db } from "@/db";
import { rooms, services, professionals, schedules, appointments, botSimulations, centerSettings } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { addDays, dayOfWeek, nowTimeStr, todayStr } from "@/lib/dates";
import { addMinutesToTime } from "@/lib/availability";
import { findClientByPhone, getClientStats, getClientTreatment, getClientTreatments } from "@/lib/client-profile";

// Paraules clau per relacionar la categoria d'un servei amb l'especialitat de cada professional.
// Si cap professional encaixa, es fa servir qualsevol professional activa.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "facial": ["facial"],
  "corporal": ["corporal", "massatge"],
  "depilació": ["depila", "làser", "laser"],
  "mans i peus": ["manicura", "pedicura", "mans", "peus", "ungles"],
  "mirada": ["mirada", "pestany", "cella"],
  "benestar": ["massatge", "benestar"],
};

function pickProfessionalsForCategory<T extends { specialty: string | null }>(pros: T[], category: string): T[] {
  const keywords = CATEGORY_KEYWORDS[category.toLowerCase()] ?? [category.toLowerCase()];
  const matching = pros.filter(p => {
    const specialty = (p.specialty || "").toLowerCase();
    return keywords.some(k => specialty.includes(k));
  });
  return matching.length > 0 ? matching : pros;
}

export interface SlotOption {
  date: string;
  displayDate: string;
  time: string;
  endTime: string;
  roomId: number;
  roomName: string;
  professionalId: number;
  professionalName: string;
}

export function formatDateCatalan(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  const days = ["Diumenge", "Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte"];
  const months = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"];
  return `${days[dayOfWeek(dateStr)]}, ${d} de ${months[m - 1]}`;
}

/**
 * Detecta el servei desitjat, calcula 3 franges lliures reals i genera el text
 * de resposta. Utilitzat tant pel simulador (panell) com pel webhook real de WhatsApp.
 */
export async function generateBotReply(params: { clientPhone: string; clientName: string; message: string }) {
  const { clientPhone, clientName, message } = params;
  const lower = message.toLowerCase();

  const allServices = await db.select().from(services).where(eq(services.isActive, true));
  const allRooms = await db.select().from(rooms).where(eq(rooms.isActive, true));
  const allProfessionals = await db.select().from(professionals).where(eq(professionals.isActive, true));
  const allSchedules = await db.select().from(schedules);

  // Si la clienta ja és a la fitxa, fem servir els seus tractaments i costums
  const knownClient = await findClientByPhone(clientPhone);
  const clientStats = knownClient ? await getClientStats(knownClient) : null;

  let matchedService = allServices[0];
  let serviceDetected = false;
  for (const s of allServices) {
    const sName = s.name.toLowerCase();
    const sCat = s.category.toLowerCase();
    if (
      lower.includes(sName) ||
      (sCat === "facial" && (lower.includes("facial") || lower.includes("neteja") || lower.includes("oxigen") || lower.includes("lifting") || lower.includes("pell"))) ||
      (sCat === "corporal" && (lower.includes("corporal") || lower.includes("madero") || lower.includes("reductor"))) ||
      (sCat === "depilació" && (lower.includes("laser") || lower.includes("làser") || lower.includes("depila") || lower.includes("cames"))) ||
      (sCat === "mans i peus" && (lower.includes("ungles") || lower.includes("manicur") || lower.includes("pedicur") || lower.includes("peus") || lower.includes("esmalt"))) ||
      (sCat === "mirada" && (lower.includes("pestany") || lower.includes("mirada") || lower.includes("pestanyes"))) ||
      (sCat === "benestar" && (lower.includes("massatge") || lower.includes("relax")))
    ) {
      matchedService = s;
      serviceDetected = true;
      break;
    }
  }

  // Si el missatge no diu quin servei vol, suposem el que més es fa (o el primer de la seva fitxa)
  if (!serviceDetected && knownClient) {
    const usualServiceId = clientStats?.topServices[0]?.serviceId
      ?? (await getClientTreatments(knownClient.id))[0]?.serviceId;
    const usual = allServices.find(s => s.id === usualServiceId);
    if (usual) matchedService = usual;
  }

  // Durada i professional propis de la clienta per a aquest tractament
  const clientTreatment = knownClient ? await getClientTreatment(knownClient.id, matchedService.id) : null;
  const durationMinutes = clientTreatment?.durationMinutes || matchedService.durationMinutes;
  const preferredProId = clientTreatment?.professionalId ?? clientStats?.topProfessional?.professionalId ?? null;

  const targetRoom = allRooms.find(r => r.id === matchedService.defaultRoomId) || allRooms[0];
  let candidatePros = pickProfessionalsForCategory(allProfessionals, matchedService.category);
  const preferredPro = allProfessionals.find(p => p.id === preferredProId);
  if (preferredPro) candidatePros = [preferredPro, ...candidatePros.filter(p => p.id !== preferredPro.id)];

  let prefersMorning = lower.includes("matí") || lower.includes("mati") || lower.includes("pronto") || lower.includes("mañana");
  let prefersAfternoon = lower.includes("tarda") || lower.includes("tarde") || lower.includes("vespre");
  // Si no ho diu, mirem si sempre ve de matí o de tarda (mínim 2 visites i un 75% en una franja)
  if (!prefersMorning && !prefersAfternoon && clientStats && clientStats.totalVisits >= 2) {
    const { morning, afternoon } = clientStats.timeOfDay;
    if (morning / clientStats.totalVisits >= 0.75) prefersMorning = true;
    else if (afternoon / clientStats.totalVisits >= 0.75) prefersAfternoon = true;
  }
  // Dies que sol triar (els que ha repetit almenys dues vegades)
  const usualDays = new Set((clientStats?.weekdays ?? []).filter(d => d.count >= 2).map(d => d.day));
  const MAX_CANDIDATES = usualDays.size > 0 ? 8 : 3;

  const [settingsForSlots] = await db.select().from(centerSettings).limit(1);
  const step = settingsForSlots?.slotIntervalMinutes || 30;

  const foundSlots: SlotOption[] = [];
  const today = todayStr();
  // No oferim hores que ja han passat ni que comencin d'aquí a menys d'una hora
  const earliestToday = addMinutesToTime(nowTimeStr(), 60);

  for (let dayOffset = 0; dayOffset < 14 && foundSlots.length < MAX_CANDIDATES; dayOffset++) {
    const dateStr = addDays(today, dayOffset);
    const weekDay = dayOfWeek(dateStr);

    const daySchedule = allSchedules.find(s => s.dayOfWeek === weekDay);
    if (!daySchedule || !daySchedule.isOpen) continue;

    const dayAppointments = await db.select().from(appointments)
      .where(and(
        eq(appointments.date, dateStr),
        sql`${appointments.status} != 'cancel·lada'`
      ));

    const windows: [string, string][] = [];
    if (!prefersAfternoon) windows.push([daySchedule.morningStart, daySchedule.morningEnd]);
    if (!prefersMorning) windows.push([daySchedule.afternoonStart, daySchedule.afternoonEnd]);
    if (prefersMorning && prefersAfternoon) {
      windows.push([daySchedule.morningStart, daySchedule.morningEnd], [daySchedule.afternoonStart, daySchedule.afternoonEnd]);
    }

    // Com a molt una opció per franja (matí / tarda) i dia, perquè la clienta tingui varietat
    for (const [windowStart, windowEnd] of windows) {
      if (foundSlots.length >= MAX_CANDIDATES) break;

      for (let time = windowStart; time < windowEnd; time = addMinutesToTime(time, step)) {
        const endTime = addMinutesToTime(time, durationMinutes);
        if (endTime > windowEnd) break;
        if (dayOffset === 0 && time < earliestToday) continue;

        const overlapping = dayAppointments.filter(apt => time < apt.endTime && endTime > apt.startTime);
        if (overlapping.some(apt => apt.roomId === targetRoom.id)) continue;

        const freePro = candidatePros.find(p => !overlapping.some(apt => apt.professionalId === p.id));
        if (!freePro) continue;

        foundSlots.push({
          date: dateStr,
          displayDate: formatDateCatalan(dateStr),
          time,
          endTime,
          roomId: targetRoom.id,
          roomName: targetRoom.name,
          professionalId: freePro.id,
          professionalName: freePro.name,
        });
        break;
      }
    }
  }

  // Entre les opcions trobades, prioritzem els dies que la clienta sol triar i ens quedem amb 3
  if (foundSlots.length > 3) {
    const ranked = [...foundSlots].sort((a, b) =>
      Number(usualDays.has(dayOfWeek(b.date))) - Number(usualDays.has(dayOfWeek(a.date))) || a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
    ).slice(0, 3);
    ranked.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    foundSlots.splice(0, foundSlots.length, ...ranked);
  }

  const settings = settingsForSlots;
  const greeting = settings?.autoReplyGreeting || `Hola ${clientName.trim()}! ✨ Gràcies per contactar amb Estètica Diana.`;

  let replyText = `${greeting}\n\nHe buscat a la nostra agenda per al servei de *${matchedService.name}* (${durationMinutes} min - ${matchedService.price}€).\n\nAquestes són les millors hores disponibles que et puc oferir a la *${targetRoom.name}*:\n\n`;

  foundSlots.forEach((slot, idx) => {
    replyText += `Opció ${idx + 1}️⃣: ${slot.displayDate} a les ${slot.time}h (amb ${slot.professionalName})\n`;
  });

  if (foundSlots.length === 0) {
    replyText = `${greeting}\n\nAra mateix no trobo cap hora lliure per a *${matchedService.name}* les properes dues setmanes 😔. Una professional del centre et contactarà per buscar-te una hora.`;
  } else {
    const options = foundSlots.map((_, idx) => idx + 1).join(", ").replace(/, (\d)$/, " o $1");
    replyText += `\nRespon amb el número de l'opció (${options}) per triar la teva cita. La teva professional et confirmarà l'hora definitiva en breu ✅`;
  }

  const [savedSimulation] = await db.insert(botSimulations).values({
    clientPhone,
    clientName: clientName.trim(),
    incomingMessage: message,
    detectedIntent: "Reserva de cita",
    detectedServiceId: matchedService.id,
    replyMessage: replyText,
    proposedSlots: JSON.stringify(foundSlots),
    // Si no hi ha opcions, tanquem la conversa perquè el següent missatge torni a començar
    status: foundSlots.length > 0 ? "opcions_enviades" : "sense_opcions",
    conversationStep: foundSlots.length > 0 ? "esperant_seleccio" : "tancada",
  }).returning();

  return {
    simulation: savedSimulation,
    matchedService,
    foundSlots,
    replyText,
  };
}
