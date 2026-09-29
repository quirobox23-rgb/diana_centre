import { NextResponse } from "next/server";
import { db } from "@/db";
import { professionals } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  try {
    const list = await db.select().from(professionals).orderBy(asc(professionals.id));
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    console.error("Error fetching professionals:", error);
    return NextResponse.json({ success: false, error: "Error al carregar professionals" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, specialty, color } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "El nom del/la professional és obligatori" }, { status: 400 });
    }

    const [newProf] = await db.insert(professionals).values({
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      specialty: specialty?.trim() || null,
      color: color || "#8b5cf6",
      isActive: true,
    }).returning();

    return NextResponse.json({ success: true, data: newProf });
  } catch (error) {
    console.error("Error creating professional:", error);
    return NextResponse.json({ success: false, error: "Error al crear professional" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, email, phone, specialty, color, isActive } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Falta l'identificador" }, { status: 400 });
    }

    const [updated] = await db.update(professionals)
      .set({
        name: name !== undefined ? name.trim() : undefined,
        email: email !== undefined ? email?.trim() : undefined,
        phone: phone !== undefined ? phone?.trim() : undefined,
        specialty: specialty !== undefined ? specialty?.trim() : undefined,
        color: color !== undefined ? color : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      })
      .where(eq(professionals.id, Number(id)))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating professional:", error);
    return NextResponse.json({ success: false, error: "Error al modificar professional" }, { status: 500 });
  }
}
