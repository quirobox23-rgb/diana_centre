import { NextResponse } from "next/server";
import {
  OWNER_COOKIE,
  OWNER_UNLOCK_SECONDS,
  checkPin,
  createOwnerToken,
  isLockConfigured,
  isOwnerUnlocked,
  setPin,
} from "@/lib/owner-lock";

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      configured: await isLockConfigured(),
      unlocked: await isOwnerUnlocked(),
    });
  } catch (error) {
    console.error("Error owner lock:", error);
    return NextResponse.json({ success: false, error: "Error amb el candado" }, { status: 500 });
  }
}

function withUnlockCookie(res: NextResponse) {
  res.cookies.set(OWNER_COOKIE, createOwnerToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OWNER_UNLOCK_SECONDS,
  });
  return res;
}

// action: "unlock" (pin) · "lock" · "setup" (pin, la primera vegada) · "change" (current, pin)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";

    if (body.action === "lock") {
      const res = NextResponse.json({ success: true, unlocked: false });
      res.cookies.delete(OWNER_COOKIE);
      return res;
    }

    if (body.action === "unlock") {
      if (!(await checkPin(pin))) {
        await new Promise(r => setTimeout(r, 800));
        return NextResponse.json({ success: false, error: "Clau incorrecta" }, { status: 401 });
      }
      return withUnlockCookie(NextResponse.json({ success: true, unlocked: true }));
    }

    if (body.action === "setup" || body.action === "change") {
      if (pin.length < 4) {
        return NextResponse.json({ success: false, error: "La clau ha de tenir com a mínim 4 caràcters" }, { status: 400 });
      }
      if (body.action === "setup" && (await isLockConfigured())) {
        return NextResponse.json({ success: false, error: "La clau ja està creada" }, { status: 400 });
      }
      const current = typeof body.current === "string" ? body.current : "";
      if (!(await setPin(pin, current))) {
        await new Promise(r => setTimeout(r, 800));
        return NextResponse.json({ success: false, error: "La clau actual no és correcta" }, { status: 401 });
      }
      return withUnlockCookie(NextResponse.json({ success: true, unlocked: true }));
    }

    return NextResponse.json({ success: false, error: "Acció no vàlida" }, { status: 400 });
  } catch (error) {
    console.error("Error owner lock:", error);
    return NextResponse.json({ success: false, error: "Error amb el candado" }, { status: 500 });
  }
}
