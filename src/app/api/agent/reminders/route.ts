import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, services } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { agentUnauthorized } from "@/lib/agent-auth";
import { formatDateCatalan } from "@/lib/bot-engine";
import { addDays, todayStr } from "@/lib/dates";

// Cites confirmades de demà que encara no han rebut el recordatori. L'agent els l'envia.
export async function GET(request: Request) {
  const denied = agentUnauthorized(request);
  if (denied) return denied;

  const tomorrow = addDays(todayStr(), 1);
  const rows = await db.select({
    id: appointments.id,
    clientName: appointments.clientName,
    clientPhone: appointments.clientPhone,
    date: appointments.date,
    startTime: appointments.startTime,
    serviceName: services.name,
  }).from(appointments)
    .leftJoin(services, eq(services.id, appointments.serviceId))
    .where(and(eq(appointments.date, tomorrow), eq(appointments.status, "confirmada"), eq(appointments.reminderSent, false)));

  return NextResponse.json({
    reminders: rows.map((r) => ({
      id: String(r.id),
      clientName: r.clientName,
      phone: r.clientPhone,
      displayDate: formatDateCatalan(r.date),
      time: r.startTime,
      serviceName: r.serviceName ?? "",
    })),
  });
}
