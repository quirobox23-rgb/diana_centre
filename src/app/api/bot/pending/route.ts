import { NextResponse } from "next/server";
import { db } from "@/db";
import { botSimulations, services } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { findClientByPhone } from "@/lib/client-profile";

// Sol·licituds de WhatsApp on la clienta ja ha triat i confirmat un horari,
// i ara esperen que la professional les confirmi des del panell.
export async function GET() {
  try {
    // Amb el nom i la durada del tractament, perquè es vegi què s'ha de confirmar
    const rows = await db.select({ sim: botSimulations, serviceName: services.name, serviceDuration: services.durationMinutes })
      .from(botSimulations)
      .leftJoin(services, eq(botSimulations.detectedServiceId, services.id))
      .where(eq(botSimulations.status, "pendent_confirmacio"))
      .orderBy(desc(botSimulations.createdAt));
    // Amb les al·lèrgies de la fitxa (si la clienta ja hi és), perquè es vegin abans de confirmar
    const pending = await Promise.all(rows.map(async r => {
      const known = await findClientByPhone(r.sim.clientPhone).catch(() => null);
      return {
        ...r.sim,
        serviceName: r.serviceName,
        serviceDuration: r.serviceDuration,
        knownClient: !!known,
        clientAllergies: known?.allergies || null,
      };
    }));

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
