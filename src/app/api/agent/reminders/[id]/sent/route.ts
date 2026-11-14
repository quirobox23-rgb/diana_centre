import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { agentUnauthorized } from "@/lib/agent-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = agentUnauthorized(request);
  if (denied) return denied;

  const { id } = await params;
  await db.update(appointments).set({ reminderSent: true }).where(eq(appointments.id, Number(id)));
  return NextResponse.json({ ok: true });
}
