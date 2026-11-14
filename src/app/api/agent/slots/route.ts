import { NextResponse } from "next/server";
import { agentUnauthorized } from "@/lib/agent-auth";
import { generateBotReply } from "@/lib/bot-engine";

// L'agent demana hores lliures per a un servei. Fa servir el mateix motor que el bot d'abans
// (durades de cada clienta, professional habitual...) i deixa la proposta guardada.
export async function POST(request: Request) {
  const denied = agentUnauthorized(request);
  if (denied) return denied;

  const { phone, clientName, serviceId, preference } = await request.json();
  if (!phone || !serviceId) return NextResponse.json({ error: "Falten dades" }, { status: 400 });

  const prefWords = preference === "mati" ? "matí" : preference === "tarda" ? "tarda" : "";
  const { simulation, matchedService, foundSlots } = await generateBotReply({
    clientPhone: phone,
    clientName: clientName || "Clienta",
    message: prefWords,
    serviceId: Number(serviceId),
  });

  return NextResponse.json({
    requestId: String(simulation.id),
    serviceName: matchedService.name,
    durationMinutes: foundSlots[0] ? minutesBetween(foundSlots[0].time, foundSlots[0].endTime) : matchedService.durationMinutes,
    slots: foundSlots.map((s, i) => ({
      index: i + 1,
      displayDate: s.displayDate,
      time: s.time,
      endTime: s.endTime,
      professionalName: s.professionalName,
    })),
  });
}

function minutesBetween(start: string, end: string): number {
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
}
