import { NextResponse } from "next/server";
import { db } from "@/db";
import { services } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { CENTRE_CATALOG } from "@/lib/service-catalog";

const SECTION_COLORS: Record<string, string> = {
  Ulls: "#866353",
  Facial: "#c06a44",
  "Depilació": "#b0805a",
  Corporal: "#7c8c6b",
  "Mans i Peus": "#a85436",
  Altres: "#8a7f74",
};

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
      color: SECTION_COLORS[c.category] ?? "#a85436",
      isActive: true,
    }));
    if (toInsert.length) await db.insert(services).values(toInsert);

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
