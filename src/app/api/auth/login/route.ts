import { NextResponse } from "next/server";
import { checkPassword, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

// Límit d'intents fallits per IP (en memòria de cada servidor; prou per frenar proves a l'atzar)
const failures = new Map<string, { n: number; until: number }>();
const MAX_FAILS = 8;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  const f = failures.get(ip);
  if (f && f.n >= MAX_FAILS && f.until > Date.now()) {
    return NextResponse.json({ success: false, error: "Massa intents. Torna-ho a provar d'aquí a 15 minuts." }, { status: 429 });
  }

  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) {
    return NextResponse.json(
      { success: false, error: "El panell no té contrasenya configurada (ADMIN_PASSWORD / SESSION_SECRET)." },
      { status: 500 }
    );
  }

  let password = "";
  try {
    const body = await request.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    // cos buit o invàlid
  }

  if (!(await checkPassword(password))) {
    // Petita espera per fer més lents els intents a l'atzar
    const prev = failures.get(ip);
    failures.set(ip, { n: (prev && prev.until > Date.now() ? prev.n : 0) + 1, until: Date.now() + WINDOW_MS });
    await new Promise(r => setTimeout(r, 800));
    return NextResponse.json({ success: false, error: "Contrasenya incorrecta" }, { status: 401 });
  }

  failures.delete(ip);
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
