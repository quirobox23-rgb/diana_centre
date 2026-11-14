import { NextResponse } from "next/server";
import { db } from "@/db";
import { centerSettings, schedules, services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { agentUnauthorized } from "@/lib/agent-auth";
import { sectionOf } from "@/lib/service-catalog";

// Informació del centre per a l'agent de WhatsApp: nom, adreça, horari i carta de serveis.
export async function GET(request: Request) {
  const denied = agentUnauthorized(request);
  if (denied) return denied;

  const [settings] = await db.select().from(centerSettings).limit(1);
  const days = await db.select().from(schedules);
  const list = await db.select().from(services).where(eq(services.isActive, true));

  const order = [1, 2, 3, 4, 5, 6, 0];
  const hours = order.map((d) => {
    const s = days.find((x) => x.dayOfWeek === d);
    if (!s) return null;
    if (!s.isOpen) return `${s.dayName}: tancat`;
    return `${s.dayName}: ${s.morningStart}-${s.morningEnd} i ${s.afternoonStart}-${s.afternoonEnd}${s.notes ? ` (${s.notes})` : ""}`;
  }).filter((h): h is string => !!h);

  return NextResponse.json({
    name: settings?.centerName ?? "Estètica Diana",
    address: settings?.address,
    phone: settings?.phone,
    hours,
    services: list.map((s) => ({
      id: s.id,
      name: s.name,
      section: sectionOf(s.category),
      durationMinutes: s.durationMinutes,
      price: Number(s.price) || 0,
    })),
  });
}
