import { NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { phoneKey } from "@/lib/client-profile";

const MAX_ROWS = 10000;

function str(v: unknown, max = 500): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

// Importa moltes clientes de cop. No duplica: si el telèfon (o, sense telèfon, el nom)
// ja existeix, la fila es salta.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rows: unknown[] = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "No hi ha cap fila per importar" }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ success: false, error: `Màxim ${MAX_ROWS} files per cop` }, { status: 400 });
    }

    const existing = await db.select({ name: clients.name, phone: clients.phone }).from(clients);
    const seen = new Set<string>();
    const keyOf = (name: string, phone: string) => {
      const p = phoneKey(phone);
      return p.length >= 6 ? `t:${p}` : `n:${name.toLowerCase().replace(/\s+/g, " ")}`;
    };
    for (const c of existing) seen.add(keyOf(c.name, c.phone));

    const toInsert: (typeof clients.$inferInsert)[] = [];
    let duplicates = 0;
    let invalid = 0;

    for (const r of rows as Record<string, unknown>[]) {
      const name = str(r?.name, 200);
      if (!name) {
        invalid++;
        continue;
      }
      const phone = (str(r.phone, 30) ?? "").replace(/[^\d+]/g, "");
      const key = keyOf(name, phone);
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      const birthday = str(r.birthday, 10);
      toInsert.push({
        name,
        phone,
        email: str(r.email, 200),
        birthday: birthday && /^\d{4}-\d{2}-\d{2}$/.test(birthday) ? birthday : null,
        notes: str(r.notes, 2000),
        allergies: str(r.allergies, 1000),
        isActive: true,
      });
    }

    for (let i = 0; i < toInsert.length; i += 500) {
      await db.insert(clients).values(toInsert.slice(i, i + 500));
    }

    return NextResponse.json({
      success: true,
      data: { created: toInsert.length, duplicates, invalid },
    });
  } catch (error) {
    console.error("Error importing clients:", error);
    return NextResponse.json({ success: false, error: "Error al importar les clientes" }, { status: 500 });
  }
}
