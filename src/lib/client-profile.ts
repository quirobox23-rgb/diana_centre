import { db } from "@/db";
import { appointments, clients, clientTreatments, professionals, services } from "@/db/schema";
import { ensureSchema } from "@/db/ensure-schema";
import { and, eq, sql } from "drizzle-orm";
import { dayOfWeek } from "@/lib/dates";

export const DAY_NAMES = ["Diumenge", "Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte"];

/** Compara telèfons ignorant espais, prefix +34, etc. (últims 9 dígits). */
export function phoneKey(phone: string | null | undefined): string {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.slice(-9);
}

export interface ClientTreatment {
  id: number;
  serviceId: number;
  serviceName: string | null;
  serviceCategory: string | null;
  defaultDuration: number | null;
  durationMinutes: number | null;
  professionalId: number | null;
  professionalName: string | null;
  notes: string | null;
}

export interface ClientStats {
  totalVisits: number;
  lastVisit: string | null;
  topServices: { serviceId: number; serviceName: string; count: number; avgDuration: number }[];
  weekdays: { day: number; dayName: string; count: number }[];
  timeOfDay: { morning: number; afternoon: number };
  usualTime: string | null;
  topProfessional: { professionalId: number; professionalName: string; count: number } | null;
}

export async function getClientTreatments(clientId: number): Promise<ClientTreatment[]> {
  await ensureSchema();
  return db.select({
    id: clientTreatments.id,
    serviceId: clientTreatments.serviceId,
    serviceName: services.name,
    serviceCategory: services.category,
    defaultDuration: services.durationMinutes,
    durationMinutes: clientTreatments.durationMinutes,
    professionalId: clientTreatments.professionalId,
    professionalName: professionals.name,
    notes: clientTreatments.notes,
  })
    .from(clientTreatments)
    .leftJoin(services, eq(clientTreatments.serviceId, services.id))
    .leftJoin(professionals, eq(clientTreatments.professionalId, professionals.id))
    .where(eq(clientTreatments.clientId, clientId));
}

export async function getClientTreatment(clientId: number, serviceId: number) {
  await ensureSchema();
  const [row] = await db.select().from(clientTreatments)
    .where(and(eq(clientTreatments.clientId, clientId), eq(clientTreatments.serviceId, serviceId)));
  return row ?? null;
}

export async function saveClientTreatments(
  clientId: number,
  items: { serviceId: number; durationMinutes?: number | null; professionalId?: number | null; notes?: string | null }[]
) {
  await ensureSchema();
  await db.transaction(async tx => {
    await tx.delete(clientTreatments).where(eq(clientTreatments.clientId, clientId));
    const seen = new Set<number>();
    const rows = items
      .filter(i => i.serviceId && !seen.has(i.serviceId) && seen.add(i.serviceId))
      .map(i => ({
        clientId,
        serviceId: Number(i.serviceId),
        durationMinutes: i.durationMinutes ? Number(i.durationMinutes) : null,
        professionalId: i.professionalId ? Number(i.professionalId) : null,
        notes: i.notes?.trim() || null,
      }));
    if (rows.length > 0) await tx.insert(clientTreatments).values(rows);
  });
}

/** Busca la clienta pel telèfon (per als missatges de WhatsApp). */
export async function findClientByPhone(phone: string) {
  const key = phoneKey(phone);
  if (key.length < 6) return null;
  const rows = await db.select().from(clients)
    .where(and(eq(clients.isActive, true), sql`right(regexp_replace(${clients.phone}, '\\D', '', 'g'), 9) = ${key}`))
    .limit(1);
  return rows[0] ?? null;
}

type HistoryRow = {
  clientId: number | null;
  clientPhone: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  serviceId: number;
  serviceName: string | null;
  professionalId: number;
  professionalName: string | null;
};

function historyQuery() {
  return db.select({
    clientId: appointments.clientId,
    clientPhone: appointments.clientPhone,
    date: appointments.date,
    startTime: appointments.startTime,
    durationMinutes: appointments.durationMinutes,
    serviceId: appointments.serviceId,
    serviceName: services.name,
    professionalId: appointments.professionalId,
    professionalName: professionals.name,
  })
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(professionals, eq(appointments.professionalId, professionals.id));
}

function computeStats(rows: HistoryRow[]): ClientStats {
  const svcMap = new Map<number, { serviceName: string; count: number; totalDuration: number }>();
  const dayCounts = new Array(7).fill(0) as number[];
  const proMap = new Map<number, { professionalName: string; count: number }>();
  const timeCounts = new Map<string, number>();
  let morning = 0;
  let afternoon = 0;
  let lastVisit: string | null = null;

  for (const r of rows) {
    const s = svcMap.get(r.serviceId) ?? { serviceName: r.serviceName ?? "Servei", count: 0, totalDuration: 0 };
    s.count++;
    s.totalDuration += r.durationMinutes;
    svcMap.set(r.serviceId, s);

    dayCounts[dayOfWeek(r.date)]++;
    if (r.startTime < "14:30") morning++; else afternoon++;
    timeCounts.set(r.startTime, (timeCounts.get(r.startTime) ?? 0) + 1);

    const p = proMap.get(r.professionalId) ?? { professionalName: r.professionalName ?? "", count: 0 };
    p.count++;
    proMap.set(r.professionalId, p);

    if (!lastVisit || r.date > lastVisit) lastVisit = r.date;
  }

  const topServices = [...svcMap.entries()]
    .map(([serviceId, s]) => ({ serviceId, serviceName: s.serviceName, count: s.count, avgDuration: Math.round(s.totalDuration / s.count) }))
    .sort((a, b) => b.count - a.count);

  const weekdays = dayCounts
    .map((count, day) => ({ day, dayName: DAY_NAMES[day], count }))
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count);

  const [topPro] = [...proMap.entries()].sort((a, b) => b[1].count - a[1].count);
  const [usualTime] = [...timeCounts.entries()].sort((a, b) => b[1] - a[1]);

  return {
    totalVisits: rows.length,
    lastVisit,
    topServices,
    weekdays,
    timeOfDay: { morning, afternoon },
    usualTime: usualTime && usualTime[1] > 1 ? usualTime[0] : null,
    topProfessional: topPro ? { professionalId: topPro[0], ...topPro[1] } : null,
  };
}

/** Estadístiques a partir de l'historial de cites (no cancel·lades) de la clienta. */
export async function getClientStats(client: { id: number; phone: string }): Promise<ClientStats> {
  const key = phoneKey(client.phone);
  const rows = await historyQuery().where(and(
    sql`${appointments.status} != 'cancel·lada'`,
    sql`(${appointments.clientId} = ${client.id} OR right(regexp_replace(${appointments.clientPhone}, '\\D', '', 'g'), 9) = ${key})`
  ));
  return computeStats(rows);
}

export interface ClientSummary {
  stats: ClientStats;
  treatments: ClientTreatment[];
}

/** Resum de tots els clients en dues consultes (per al llistat de fitxes). */
export async function getAllClientSummaries(clientList: { id: number; phone: string }[]): Promise<Record<number, ClientSummary>> {
  await ensureSchema();
  const [history, treatments] = await Promise.all([
    historyQuery().where(sql`${appointments.status} != 'cancel·lada'`),
    db.select({
      clientId: clientTreatments.clientId,
      id: clientTreatments.id,
      serviceId: clientTreatments.serviceId,
      serviceName: services.name,
      serviceCategory: services.category,
      defaultDuration: services.durationMinutes,
      durationMinutes: clientTreatments.durationMinutes,
      professionalId: clientTreatments.professionalId,
      professionalName: professionals.name,
      notes: clientTreatments.notes,
    })
      .from(clientTreatments)
      .leftJoin(services, eq(clientTreatments.serviceId, services.id))
      .leftJoin(professionals, eq(clientTreatments.professionalId, professionals.id)),
  ]);

  const byId = new Map(clientList.map(c => [c.id, c.id]));
  const byPhone = new Map(clientList.map(c => [phoneKey(c.phone), c.id]));
  const rowsByClient = new Map<number, HistoryRow[]>();
  for (const r of history) {
    const cid = (r.clientId && byId.get(r.clientId)) || byPhone.get(phoneKey(r.clientPhone));
    if (!cid) continue;
    const list = rowsByClient.get(cid) ?? [];
    list.push(r);
    rowsByClient.set(cid, list);
  }

  const result: Record<number, ClientSummary> = {};
  for (const c of clientList) {
    result[c.id] = {
      stats: computeStats(rowsByClient.get(c.id) ?? []),
      treatments: treatments.filter(t => t.clientId === c.id).map(({ clientId: _clientId, ...t }) => t),
    };
  }
  return result;
}
