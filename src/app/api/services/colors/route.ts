import { NextResponse } from "next/server";
import { ensureSchema } from "@/db/ensure-schema";
import { applyTreatmentColors } from "@/db/treatment-colors-migration";

// Torna a posar a tots els serveis el color del seu tipus de tractament (colors de Google Calendar)
export async function POST() {
  try {
    await ensureSchema();
    const changed = await applyTreatmentColors(true);
    return NextResponse.json({ success: true, data: { changed } });
  } catch (error) {
    console.error("Error applying treatment colors:", error);
    return NextResponse.json({ success: false, error: "No s'han pogut aplicar els colors" }, { status: 500 });
  }
}
