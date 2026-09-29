import { NextResponse } from "next/server";
import { db } from "@/db";
import { botSimulations } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// Sol·licituds de WhatsApp on la clienta ja ha triat i confirmat un horari,
// i ara esperen que la professional les confirmi des del panell.
export async function GET() {
  try {
    const pending = await db.select().from(botSimulations)
      .where(eq(botSimulations.status, "pendent_confirmacio"))
      .orderBy(desc(botSimulations.createdAt));

    return NextResponse.json({ success: true, pending });
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    return NextResponse.json({ success: false, error: "Error al carregar sol·licituds pendents" }, { status: 500 });
  }
}

// Permet descartar una sol·licitud pendent sense confirmar-la (p.ex. la clienta ha cancel·lat per telèfon)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Falta l'id" }, { status: 400 });

    await db.update(botSimulations)
      .set({ status: "cancel·lat" })
      .where(eq(botSimulations.id, Number(id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error dismissing pending request:", error);
    return NextResponse.json({ success: false, error: "Error al descartar la sol·licitud" }, { status: 500 });
  }
}
