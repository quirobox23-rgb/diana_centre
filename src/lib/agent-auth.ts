import { NextResponse } from "next/server";
import crypto from "node:crypto";

// Les rutes /api/agent/* les crida l'agent de WhatsApp (projecte agente-whatsapp).
// Van protegides amb una clau compartida: AGENT_API_KEY (la mateixa que DIANA_AGENT_KEY a l'agent).
export function agentUnauthorized(request: Request): NextResponse | null {
  const key = process.env.AGENT_API_KEY;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${key}`;
  const ok = !!key && given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  return ok ? null : NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
