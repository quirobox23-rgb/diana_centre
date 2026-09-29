import { NextResponse } from "next/server";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  try {
    const allRooms = await db.select().from(rooms).orderBy(asc(rooms.id));
    return NextResponse.json({ success: true, data: allRooms });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json({ success: false, error: "Error al carregar les sales" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, color, capacity } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "El nom de la sala és obligatori" }, { status: 400 });
    }

    const [newRoom] = await db.insert(rooms).values({
      name: name.trim(),
      description: description?.trim() || null,
      color: color || "#ec4899",
      capacity: capacity ? Number(capacity) : 1,
      isActive: true,
    }).returning();

    return NextResponse.json({ success: true, data: newRoom });
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json({ success: false, error: "Error al crear la sala" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, description, color, capacity, isActive } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Falta l'identificador de la sala" }, { status: 400 });
    }

    const [updatedRoom] = await db.update(rooms)
      .set({
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description?.trim() : undefined,
        color: color !== undefined ? color : undefined,
        capacity: capacity !== undefined ? Number(capacity) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      })
      .where(eq(rooms.id, Number(id)))
      .returning();

    return NextResponse.json({ success: true, data: updatedRoom });
  } catch (error) {
    console.error("Error updating room:", error);
    return NextResponse.json({ success: false, error: "Error al modificar la sala" }, { status: 500 });
  }
}
