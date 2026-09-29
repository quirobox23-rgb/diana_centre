import { NextResponse } from "next/server";
import { db } from "@/db";
import { clients, appointments } from "@/db/schema";
import { eq, desc, ilike, or } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    let query = db.select().from(clients);
    if (search && search.trim()) {
      const pattern = `%${search.trim()}%`;
      query = query.where(
        or(
          ilike(clients.name, pattern),
          ilike(clients.phone, pattern),
          ilike(clients.email, pattern)
        )
      ) as typeof query;
    }

    const allClients = await query.orderBy(desc(clients.createdAt));
    return NextResponse.json({ success: true, data: allClients });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json({ success: false, error: "Error al carregar el llistat de clientes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, email, notes, allergies, preferences, birthday } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "El nom de la clienta és obligatori" }, { status: 400 });
    }
    if (!phone || !phone.trim()) {
      return NextResponse.json({ success: false, error: "El telèfon mòbil és obligatori" }, { status: 400 });
    }

    const [newClient] = await db.insert(clients).values({
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      notes: notes?.trim() || null,
      allergies: allergies?.trim() || null,
      preferences: preferences?.trim() || null,
      birthday: birthday?.trim() || null,
      isActive: true,
    }).returning();

    return NextResponse.json({ success: true, data: newClient });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json({ success: false, error: "Error al registrar la clienta" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, phone, email, notes, allergies, preferences, birthday, isActive } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Falta l'identificador de la clienta" }, { status: 400 });
    }

    const [updatedClient] = await db.update(clients)
      .set({
        name: name !== undefined ? name.trim() : undefined,
        phone: phone !== undefined ? phone.trim() : undefined,
        email: email !== undefined ? (email?.trim() || null) : undefined,
        notes: notes !== undefined ? (notes?.trim() || null) : undefined,
        allergies: allergies !== undefined ? (allergies?.trim() || null) : undefined,
        preferences: preferences !== undefined ? (preferences?.trim() || null) : undefined,
        birthday: birthday !== undefined ? (birthday?.trim() || null) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      })
      .where(eq(clients.id, Number(id)))
      .returning();

    return NextResponse.json({ success: true, data: updatedClient });
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json({ success: false, error: "Error al modificar la clienta" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Falta l'identificador" }, { status: 400 });
    }

    await db.update(clients).set({ isActive: false }).where(eq(clients.id, Number(id)));

    return NextResponse.json({ success: true, message: "Clienta desactivada" });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json({ success: false, error: "Error al desactivar la clienta" }, { status: 500 });
  }
}
