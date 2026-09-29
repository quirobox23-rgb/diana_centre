import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, rooms, services, professionals } from "@/db/schema";
import { eq, and, sql, asc, gte, lte } from "drizzle-orm";

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMins = h * 60 + m + minutes;
  const newH = Math.floor(totalMins / 60);
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const roomId = searchParams.get("roomId");
    const professionalId = searchParams.get("professionalId");

    const query = db.select({
      id: appointments.id,
      clientName: appointments.clientName,
      clientPhone: appointments.clientPhone,
      clientEmail: appointments.clientEmail,
      clientId: appointments.clientId,
      roomId: appointments.roomId,
      serviceId: appointments.serviceId,
      professionalId: appointments.professionalId,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      durationMinutes: appointments.durationMinutes,
      status: appointments.status,
      price: appointments.price,
      notes: appointments.notes,
      source: appointments.source,
      createdAt: appointments.createdAt,
      roomName: rooms.name,
      roomColor: rooms.color,
      serviceName: services.name,
      serviceCategory: services.category,
      serviceColor: services.color,
      professionalName: professionals.name,
      professionalColor: professionals.color,
    })
    .from(appointments)
    .leftJoin(rooms, eq(appointments.roomId, rooms.id))
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(professionals, eq(appointments.professionalId, professionals.id));

    const conditions = [];
    if (startDate && endDate) {
      conditions.push(gte(appointments.date, startDate));
      conditions.push(lte(appointments.date, endDate));
    } else if (date) {
      conditions.push(eq(appointments.date, date));
    }

    if (roomId) {
      conditions.push(eq(appointments.roomId, Number(roomId)));
    }
    if (professionalId) {
      conditions.push(eq(appointments.professionalId, Number(professionalId)));
    }

    const result = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(asc(appointments.date), asc(appointments.startTime))
      : await query.orderBy(asc(appointments.date), asc(appointments.startTime));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return NextResponse.json({ success: false, error: "Error al carregar les cites" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      clientName,
      clientPhone,
      clientEmail,
      clientId,
      roomId,
      serviceId,
      professionalId,
      date,
      startTime,
      durationMinutes,
      status,
      price,
      notes,
      source,
    } = body;

    if (!clientName || !clientPhone || !roomId || !serviceId || !professionalId || !date || !startTime) {
      return NextResponse.json({
        success: false,
        error: "Cal omplir tots els camps obligatoris: nom, telèfon, sala, servei, professional, data i hora.",
      }, { status: 400 });
    }

    const duration = Number(durationMinutes) || 60;
    const computedEndTime = addMinutesToTime(startTime, duration);

    // Comprovar si la sala ja està ocupada en aquesta data i franja horària
    const existingRoomAppointments = await db.select().from(appointments)
      .where(and(
        eq(appointments.roomId, Number(roomId)),
        eq(appointments.date, date),
        sql`${appointments.status} != 'cancel·lada'`
      ));

    const hasConflict = existingRoomAppointments.some(apt => {
      return (startTime < apt.endTime && computedEndTime > apt.startTime);
    });

    if (hasConflict) {
      return NextResponse.json({
        success: false,
        error: "La sala seleccionada ja té una cita programada en aquest interval horari.",
      }, { status: 409 });
    }

    const [newAppointment] = await db.insert(appointments).values({
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail?.trim() || null,
      clientId: clientId ? Number(clientId) : null,
      roomId: Number(roomId),
      serviceId: Number(serviceId),
      professionalId: Number(professionalId),
      date,
      startTime,
      endTime: computedEndTime,
      durationMinutes: duration,
      status: status || "confirmada",
      price: price ? String(price) : "0.00",
      notes: notes?.trim() || null,
      source: source || "manual",
    }).returning();

    return NextResponse.json({ success: true, data: newAppointment });
  } catch (error) {
    console.error("Error creating appointment:", error);
    return NextResponse.json({ success: false, error: "Error al crear la cita" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      clientName,
      clientPhone,
      clientEmail,
      clientId,
      roomId,
      serviceId,
      professionalId,
      date,
      startTime,
      durationMinutes,
      status,
      price,
      notes,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Falta l'identificador de la cita" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (clientName !== undefined) updateData.clientName = clientName.trim();
    if (clientPhone !== undefined) updateData.clientPhone = clientPhone.trim();
    if (clientEmail !== undefined) updateData.clientEmail = clientEmail?.trim() || null;
    if (clientId !== undefined) updateData.clientId = clientId ? Number(clientId) : null;
    if (roomId !== undefined) updateData.roomId = Number(roomId);
    if (serviceId !== undefined) updateData.serviceId = Number(serviceId);
    if (professionalId !== undefined) updateData.professionalId = Number(professionalId);
    if (date !== undefined) updateData.date = date;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (status !== undefined) updateData.status = status;
    if (price !== undefined) updateData.price = String(price);

    if (startTime !== undefined && durationMinutes !== undefined) {
      updateData.startTime = startTime;
      updateData.durationMinutes = Number(durationMinutes);
      updateData.endTime = addMinutesToTime(startTime, Number(durationMinutes));
    } else if (startTime !== undefined) {
      updateData.startTime = startTime;
    }

    const [updated] = await db.update(appointments)
      .set(updateData)
      .where(eq(appointments.id, Number(id)))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating appointment:", error);
    return NextResponse.json({ success: false, error: "Error al modificar la cita" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Falta l'identificador" }, { status: 400 });
    }

    await db.delete(appointments).where(eq(appointments.id, Number(id)));

    return NextResponse.json({ success: true, message: "Cita cancel·lada correctament" });
  } catch (error) {
    console.error("Error deleting appointment:", error);
    return NextResponse.json({ success: false, error: "Error al cancel·lar la cita" }, { status: 500 });
  }
}
