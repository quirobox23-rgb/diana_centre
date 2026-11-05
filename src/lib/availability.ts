import { db } from "@/db";
import { appointments } from "@/db/schema";
import { and, eq, ne, or, sql } from "drizzle-orm";

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMins = h * 60 + m + minutes;
  const newH = Math.floor(totalMins / 60);
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export type ConflictKind = "sala" | "professional";

export const CONFLICT_MESSAGES: Record<ConflictKind, string> = {
  sala: "La sala seleccionada ja té una cita programada en aquest interval horari.",
  professional: "La professional seleccionada ja té una altra cita en aquest interval horari.",
};

/**
 * Comprova si una franja xoca amb una altra cita (no cancel·lada) de la mateixa sala
 * o de la mateixa professional. Retorna el tipus de conflicte o null si està lliure.
 */
export async function findConflict(params: {
  date: string;
  startTime: string;
  endTime: string;
  roomId: number;
  professionalId: number;
  excludeAppointmentId?: number;
}): Promise<ConflictKind | null> {
  const { date, startTime, endTime, roomId, professionalId, excludeAppointmentId } = params;

  const conditions = [
    eq(appointments.date, date),
    sql`${appointments.status} != 'cancel·lada'`,
    or(eq(appointments.roomId, roomId), eq(appointments.professionalId, professionalId)),
  ];
  if (excludeAppointmentId) conditions.push(ne(appointments.id, excludeAppointmentId));

  const sameDay = await db.select().from(appointments).where(and(...conditions));
  const overlapping = sameDay.filter(apt => startTime < apt.endTime && endTime > apt.startTime);

  if (overlapping.some(apt => apt.roomId === roomId)) return "sala";
  if (overlapping.some(apt => apt.professionalId === professionalId)) return "professional";
  return null;
}
