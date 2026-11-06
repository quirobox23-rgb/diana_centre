import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionRole, SESSION_COOKIE } from "@/lib/auth";

// Diu al panell si qui ha entrat és la dueña (admin) o l'equip (staff)
export async function GET() {
  const store = await cookies();
  const role = await getSessionRole(store.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ success: true, role });
}
