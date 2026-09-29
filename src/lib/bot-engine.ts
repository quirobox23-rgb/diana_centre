import { db } from "@/db";
import { rooms, services, professionals, schedules, appointments, botSimulations, centerSettings } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

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

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMins = h * 60 + m + minutes;
  const newH = Math.floor(totalMins / 60);
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export function formatDateCatalan(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const days = ["Diumenge", "Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte"];
  const months = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"];
  return `${days[dateObj.getDay()]}, ${d} de ${months[m - 1]}`;
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

  let matchedService = allServices[0];
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
      break;
    }
  }

  const targetRoom = allRooms.find(r => r.id === matchedService.defaultRoomId) || allRooms[0];
  const targetProfessional = allProfessionals.find(p => {
    if (matchedService.category === "Mans i Peus" || matchedService.category === "Mirada") {
      return p.name.includes("Laia");
    }
    if (matchedService.category === "Corporal" || matchedService.category === "Depilació") {
      return p.name.includes("Marta") || p.name.includes("Diana");
    }
    return p.name.includes("Diana") || p.name.includes("Marta");
  }) || allProfessionals[0];

  const prefersMorning = lower.includes("matí") || lower.includes("mati") || lower.includes("pronto");
  const prefersAfternoon = lower.includes("tarda") || lower.includes("tarde") || lower.includes("vespre");

  const foundSlots: SlotOption[] = [];
  const today = new Date();

  for (let dayOffset = 0; dayOffset < 8 && foundSlots.length < 3; dayOffset++) {
    const checkDateObj = new Date(today);
    checkDateObj.setDate(today.getDate() + dayOffset);
    const dateStr = checkDateObj.toISOString().split("T")[0];
    const dayOfWeek = checkDateObj.getDay();

    const daySchedule = allSchedules.find(s => s.dayOfWeek === dayOfWeek);
    if (!daySchedule || !daySchedule.isOpen) continue;

    const bookedAppointments = await db.select().from(appointments)
      .where(and(
        eq(appointments.roomId, targetRoom.id),
        eq(appointments.date, dateStr),
        sql`${appointments.status} != 'cancel·lada'`
      ));

    const candidateTimes: string[] = [];
    if (!prefersAfternoon) candidateTimes.push("10:00", "11:00", "12:00");
    if (!prefersMorning) candidateTimes.push("16:00", "17:00", "18:00", "19:00");
    if (!prefersMorning && !prefersAfternoon) {
      candidateTimes.length = 0;
      candidateTimes.push("10:30", "12:00", "16:30", "17:30", "18:30");
    }

    for (const time of candidateTimes) {
      if (foundSlots.length >= 3) break;
      const endTime = addMinutesToTime(time, matchedService.durationMinutes);
      const hasConflict = bookedAppointments.some(apt => time < apt.endTime && endTime > apt.startTime);
      if (!hasConflict) {
        foundSlots.push({
          date: dateStr,
          displayDate: formatDateCatalan(dateStr),
          time,
          endTime,
          roomId: targetRoom.id,
          roomName: targetRoom.name,
          professionalId: targetProfessional.id,
          professionalName: targetProfessional.name,
        });
      }
    }
  }

  const [settings] = await db.select().from(centerSettings).limit(1);
  const greeting = settings?.autoReplyGreeting || `Hola ${clientName.trim()}! ✨ Gràcies per contactar amb Estètica Diana.`;

  let replyText = `${greeting}\n\nHe buscat a la nostra agenda per al servei de *${matchedService.name}* (${matchedService.durationMinutes} min - ${matchedService.price}€).\n\nAquestes són les 3 millors hores disponibles que et puc oferir a la *${targetRoom.name}* amb la *${targetProfessional.name}*:\n\n`;

  foundSlots.forEach((slot, idx) => {
    replyText += `Opció ${idx + 1}️⃣: ${slot.displayDate} a les ${slot.time}h\n`;
  });

  replyText += `\nRespon amb el número de l'opció (1, 2 o 3) per triar la teva cita. La teva professional et confirmarà l'hora definitiva en breu ✅`;

  const [savedSimulation] = await db.insert(botSimulations).values({
    clientPhone,
    clientName: clientName.trim(),
    incomingMessage: message,
    detectedIntent: "Reserva de cita",
    detectedServiceId: matchedService.id,
    replyMessage: replyText,
    proposedSlots: JSON.stringify(foundSlots),
    status: "opcions_enviades",
    conversationStep: "esperant_seleccio",
  }).returning();

  return {
    simulation: savedSimulation,
    matchedService,
    foundSlots,
    replyText,
  };
}
