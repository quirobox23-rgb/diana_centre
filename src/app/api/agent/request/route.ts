import { NextResponse } from "next/server";
import { db } from "@/db";
import { botSimulations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { agentUnauthorized } from "@/lib/agent-auth";

// La clienta ha triat una opció: queda PENDENT perquè la propietària la confirmi des del panell
// (surt a "Sol·licituds pendents", igual que amb el bot d'abans).
export async function POST(request: Request) {
  const denied = agentUnauthorized(request);
  if (denied) return denied;

  let body: { requestId?: unknown; slotIndex?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Petició no vàlida" }, { status: 400 });
  }
  const { requestId, slotIndex } = body;
  const [sim] = await db.select().from(botSimulations).where(eq(botSimulations.id, Number(requestId)));
  if (!sim) return NextResponse.json({ ok: false, message: "No trobo aquesta proposta" });

  let slots: unknown[] = [];
  try {
    slots = sim.proposedSlots ? JSON.parse(sim.proposedSlots) : [];
  } catch {
    return NextResponse.json({ ok: false, message: "La proposta està malmesa" });
  }
  const idx = Number(slotIndex) - 1;
  if (!slots[idx]) return NextResponse.json({ ok: false, message: "Aquesta opció no existeix" });
  if (sim.status !== "opcions_enviades") return NextResponse.json({ ok: false, message: "Aquesta proposta ja s'ha fet servir" });

  await db.update(botSimulations)
    .set({ selectedSlotIndex: idx, status: "pendent_confirmacio", conversationStep: "tancada" })
    .where(eq(botSimulations.id, sim.id));

  return NextResponse.json({ ok: true });
}
