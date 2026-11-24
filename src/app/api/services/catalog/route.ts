import { NextResponse } from "next/server";
import { db } from "@/db";
import { services } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { CENTRE_CATALOG } from "@/lib/service-catalog";
import { colorForService } from "@/lib/treatment-colors";
import { assignDefaultProfessionals, assignDefaultRooms } from "@/db/treatment-colors-migration";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// Carrega la carta del centre: afegeix els serveis que falten (no toca els que ja hi són)
// i, si es demana, desactiva els serveis que no són a la carta (els d'exemple).
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const existing = await db.select().from(services);
    const byName = new Map(existing.map(s => [norm(s.name), s]));
    const catalogNames = new Set(CENTRE_CATALOG.map(c => norm(c.name)));

    const toInsert = CENTRE_CATALOG.filter(c => !byName.has(norm(c.name))).map(c => ({
      name: c.name,
      category: c.category,
      durationMinutes: c.durationMinutes,
      price: "0.00",
      description: c.description ?? null,
      color: colorForService(c.name, c.category),
      isActive: true,
    }));
    if (toInsert.length) {
      const inserted = await db.insert(services).values(toInsert).returning({ id: services.id });
      // Qui fa cada tractament nou (Diana / Montsant), si ja hi són a Professionals
      const ids = inserted.map(r => r.id);
      await assignDefaultProfessionals(ids).catch(err => console.error("[pros]", err));
      await assignDefaultRooms(ids).catch(err => console.error("[sales]", err));
    }

    let deactivated = 0;
    if (body.deactivateOthers) {
      const others = existing.filter(s => s.isActive && !catalogNames.has(norm(s.name))).map(s => s.id);
      if (others.length) {
        await db.update(services).set({ isActive: false }).where(inArray(services.id, others));
        deactivated = others.length;
      }
    }

    return NextResponse.json({
      success: true,
      data: { added: toInsert.length, alreadyThere: CENTRE_CATALOG.length - toInsert.length, deactivated },
    });
  } catch (error) {
    console.error("Error loading catalog:", error);
    return NextResponse.json({ success: false, error: "Error al carregar la carta" }, { status: 500 });
  }
}
