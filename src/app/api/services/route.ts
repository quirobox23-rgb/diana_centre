import { NextResponse } from "next/server";
import { db } from "@/db";
import { services, rooms } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  try {
    const allServices = await db.select({
      id: services.id,
      name: services.name,
      category: services.category,
      durationMinutes: services.durationMinutes,
      price: services.price,
      description: services.description,
      defaultRoomId: services.defaultRoomId,
      color: services.color,
      isActive: services.isActive,
      roomName: rooms.name,
    })
    .from(services)
    .leftJoin(rooms, eq(services.defaultRoomId, rooms.id))
    .orderBy(asc(services.category), asc(services.name));

    return NextResponse.json({ success: true, data: allServices });
  } catch (error) {
    console.error("Error fetching services:", error);
    return NextResponse.json({ success: false, error: "Error al carregar els serveis" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, category, durationMinutes, price, description, defaultRoomId, color } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "El nom del servei és obligatori" }, { status: 400 });
    }

    const [newService] = await db.insert(services).values({
      name: name.trim(),
      category: category?.trim() || "Facial",
      durationMinutes: Number(durationMinutes) || 60,
      price: price ? String(price) : "45.00",
      description: description?.trim() || null,
      defaultRoomId: defaultRoomId ? Number(defaultRoomId) : null,
      color: color || "#f43f5e",
      isActive: true,
    }).returning();

    return NextResponse.json({ success: true, data: newService });
  } catch (error) {
    console.error("Error creating service:", error);
    return NextResponse.json({ success: false, error: "Error al crear el servei" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, category, durationMinutes, price, description, defaultRoomId, color, isActive } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Falta l'identificador del servei" }, { status: 400 });
    }

    const [updatedService] = await db.update(services)
      .set({
        name: name !== undefined ? name.trim() : undefined,
        category: category !== undefined ? category.trim() : undefined,
        durationMinutes: durationMinutes !== undefined ? Number(durationMinutes) : undefined,
        price: price !== undefined ? String(price) : undefined,
        description: description !== undefined ? description?.trim() : undefined,
        defaultRoomId: defaultRoomId !== undefined ? (defaultRoomId ? Number(defaultRoomId) : null) : undefined,
        color: color !== undefined ? color : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      })
      .where(eq(services.id, Number(id)))
      .returning();

    return NextResponse.json({ success: true, data: updatedService });
  } catch (error) {
    console.error("Error updating service:", error);
    return NextResponse.json({ success: false, error: "Error al modificar el servei" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Falta l'identificador" }, { status: 400 });
    }

    // Mark as inactive instead of hard delete to avoid foreign key errors on appointments
    await db.update(services).set({ isActive: false }).where(eq(services.id, Number(id)));

    return NextResponse.json({ success: true, message: "Servei desactivat correctament" });
  } catch (error) {
    console.error("Error deleting service:", error);
    return NextResponse.json({ success: false, error: "Error al eliminar el servei" }, { status: 500 });
  }
}
