import { NextResponse } from "next/server";
import { agentUnauthorized } from "@/lib/agent-auth";
import { findClientByPhone, getClientStats, getClientTreatments } from "@/lib/client-profile";
import { formatDateCatalan } from "@/lib/bot-engine";

// Fitxa de la clienta per a l'agent de WhatsApp: notes de la dueña, preferències,
// al·lèrgies, tractaments habituals i costums (dies, matí/tarda, professional).
// L'agent ho fa servir per atendre-la millor; mai li llegeix les notes.
export async function GET(request: Request) {
  const denied = agentUnauthorized(request);
  if (denied) return denied;

  const phone = new URL(request.url).searchParams.get("phone") ?? "";
  const client = await findClientByPhone(phone);
  if (!client) return NextResponse.json({ client: null });

  const [stats, treatments] = await Promise.all([getClientStats(client), getClientTreatments(client.id)]);
  const { morning, afternoon } = stats.timeOfDay;
  const total = morning + afternoon;

  return NextResponse.json({
    client: {
      name: client.name,
      notes: client.notes,
      preferences: client.preferences,
      allergies: client.allergies,
      totalVisits: stats.totalVisits,
      lastVisit: stats.lastVisit ? formatDateCatalan(stats.lastVisit) : null,
      usualDays: stats.weekdays.slice(0, 2).map((d) => d.dayName),
      usualPart: total < 2 ? null : morning >= total * 0.7 ? "mati" : afternoon >= total * 0.7 ? "tarda" : null,
      usualTime: stats.usualTime,
      usualProfessional: stats.topProfessional?.professionalName || null,
      treatments: [
        ...treatments.map((t) => ({
          serviceId: t.serviceId,
          serviceName: t.serviceName ?? "",
          durationMinutes: t.durationMinutes ?? t.defaultDuration,
          professional: t.professionalName,
          notes: t.notes,
        })),
        ...stats.topServices
          .filter((s) => !treatments.some((t) => t.serviceId === s.serviceId))
          .slice(0, 3)
          .map((s) => ({ serviceId: s.serviceId, serviceName: s.serviceName, durationMinutes: s.avgDuration, professional: null, notes: null })),
      ],
    },
  });
}
