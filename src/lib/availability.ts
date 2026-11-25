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
type Executor = Pick<typeof db, "select">;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Fa la comprovació de conflictes i la reserva dins d'una transacció amb un bloqueig per dia.
 * Així, si el panell i l'agent de WhatsApp reserven la mateixa hora alhora, només una entra.
 */
export async function withBookingLock<T>(dates: string[], fn: (tx: Tx) => Promise<T>): Promise<T> {
  const unique = [...new Set(dates.filter(Boolean))].sort();
  return db.transaction(async (tx) => {
    for (const d of unique) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"reserva:" + d}))`);
    return fn(tx);
  });
}

export async function findConflict(params: {
  date: string;
  startTime: string;
  endTime: string;
  roomId: number;
  professionalId: number;
  excludeAppointmentId?: number;
}, exec: Executor = db): Promise<ConflictKind | null> {
  const { date, startTime, endTime, roomId, professionalId, excludeAppointmentId } = params;

  const conditions = [
    eq(appointments.date, date),
    sql`${appointments.status} not in ('cancel·lada', 'no-presentada')`,
    or(eq(appointments.roomId, roomId), eq(appointments.professionalId, professionalId)),
  ];
  if (excludeAppointmentId) conditions.push(ne(appointments.id, excludeAppointmentId));

  const sameDay = await exec.select().from(appointments).where(and(...conditions));
  const overlapping = sameDay.filter(apt => startTime < apt.endTime && endTime > apt.startTime);

  if (overlapping.some(apt => apt.roomId === roomId)) return "sala";
  if (overlapping.some(apt => apt.professionalId === professionalId)) return "professional";
  return null;
}
