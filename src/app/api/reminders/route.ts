import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { sendWhatsApp } from "@/lib/twilio";
import { formatDateCatalan } from "@/lib/bot-engine";
import { addDays, todayStr } from "@/lib/dates";

// Es crida un cop al dia des de Vercel Cron (vercel.json).
// Envia el recordatori a totes les cites confirmades per a l'endemà que encara no l'han rebut.
export async function GET(request: Request) {
  // Vercel Cron envia automàticament "Authorization: Bearer <CRON_SECRET>".
  // Si la variable no està configurada, rebutgem la petició (abans quedava oberta a tothom).
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const tomorrowStr = addDays(todayStr(), 1);

  const toRemind = await db.select().from(appointments)
    .where(and(
      eq(appointments.date, tomorrowStr),
      eq(appointments.status, "confirmada"),
      eq(appointments.reminderSent, false)
    ));

  let sent = 0;
  for (const apt of toRemind) {
    try {
      const msg = `👋 Hola ${apt.clientName.split(" ")[0]}! Et recordem la teva cita demà a Estètica Diana:\n\n📅 ${formatDateCatalan(apt.date)}\n🕐 ${apt.startTime}h\n\nSi necessites canviar-la, respon a aquest xat. T'esperem! ✨`;
      await sendWhatsApp(apt.clientPhone, msg);
      await db.update(appointments).set({ reminderSent: true }).where(eq(appointments.id, apt.id));
      sent++;
    } catch (err) {
      console.error(`[reminders] Error enviant recordatori a cita ${apt.id}:`, err);
    }
  }

  return NextResponse.json({ status: "ok", checked: toRemind.length, sent });
}
