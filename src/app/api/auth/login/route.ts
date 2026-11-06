import { NextResponse } from "next/server";
import { roleForPassword, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(request: Request) {
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

  const role = await roleForPassword(password);
  if (!role) {
    // Petita espera per fer més lents els intents a l'atzar
    await new Promise(r => setTimeout(r, 800));
    return NextResponse.json({ success: false, error: "Contrasenya incorrecta" }, { status: 401 });
  }

  const res = NextResponse.json({ success: true, role });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
