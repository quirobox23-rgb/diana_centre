import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Rutes que han de ser accessibles sense iniciar sessió.
// - El webhook de WhatsApp el crida Twilio (ja valida la seva firma).
// - Els recordatoris els crida Vercel Cron (valida CRON_SECRET).
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/bot/webhook",
  "/api/reminders",
  "/api/health",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: "Cal iniciar sessió" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Tot excepte els fitxers estàtics de Next i la icona
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
