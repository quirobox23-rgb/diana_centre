import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, services } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { agentUnauthorized } from "@/lib/agent-auth";
import { formatDateCatalan } from "@/lib/bot-engine";
import { phoneKey } from "@/lib/client-profile";
import { todayStr } from "@/lib/dates";

// Properes cites d'una clienta (per quan pregunta "quan tinc hora?")
export async function GET(request: Request) {
  const denied = agentUnauthorized(request);
  if (denied) return denied;

  const key = phoneKey(new URL(request.url).searchParams.get("phone"));
  if (key.length < 6) return NextResponse.json({ appointments: [] });

  const rows = await db.select({
    date: appointments.date,
    startTime: appointments.startTime,
    status: appointments.status,
    serviceName: services.name,
  }).from(appointments)
    .leftJoin(services, eq(services.id, appointments.serviceId))
    .where(and(
      gte(appointments.date, todayStr()),
      sql`${appointments.status} != 'cancel·lada'`,
      sql`right(regexp_replace(${appointments.clientPhone}, '\\D', '', 'g'), 9) = ${key}`,
    ))
    .orderBy(appointments.date, appointments.startTime)
    .limit(5);

  return NextResponse.json({
    appointments: rows.map((r) => ({
      displayDate: formatDateCatalan(r.date),
      time: r.startTime,
      serviceName: r.serviceName ?? "",
      status: r.status,
    })),
  });
}
