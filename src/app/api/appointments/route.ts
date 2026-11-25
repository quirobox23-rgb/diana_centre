import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, rooms, services, professionals, clients } from "@/db/schema";
import { findClientByPhone } from "@/lib/client-profile";
import { eq, and, asc, gte, lte } from "drizzle-orm";
import { addMinutesToTime, CONFLICT_MESSAGES, findConflict, withBookingLock } from "@/lib/availability";
import { ensureSchema } from "@/db/ensure-schema";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function invalidDateOrTime(date?: unknown, startTime?: unknown, duration?: unknown): string | null {
  if (date !== undefined && (typeof date !== "string" || !DATE_RE.test(date))) return "La data no és vàlida (format AAAA-MM-DD).";
  if (startTime !== undefined && (typeof startTime !== "string" || !TIME_RE.test(startTime))) return "L'hora no és vàlida (format HH:MM).";
  if (duration !== undefined && (!Number.isFinite(Number(duration)) || Number(duration) <= 0 || Number(duration) > 600)) return "La durada no és vàlida.";
  return null;
}


export async function GET(request: Request) {
  try {
    await ensureSchema();
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
      paidCash: appointments.paidCash,
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
      clientAllergies: clients.allergies,
    })
    .from(appointments)
    .leftJoin(rooms, eq(appointments.roomId, rooms.id))
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(professionals, eq(appointments.professionalId, professionals.id))
    .leftJoin(clients, eq(appointments.clientId, clients.id));

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

    // El preu de cada cita es veu sempre (cal per cobrar); el candado només amaga els totals del Resum
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return NextResponse.json({ success: false, error: "Error al carregar les cites" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
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
      paidCash,
      notes,
      source,
    } = body;

    if (!clientName || !clientPhone || !roomId || !serviceId || !professionalId || !date || !startTime) {
      return NextResponse.json({
        success: false,
        error: "Cal omplir tots els camps obligatoris: nom, telèfon, sala, servei, professional, data i hora.",
      }, { status: 400 });
    }

    const validationError = invalidDateOrTime(date, startTime, durationMinutes);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const duration = Number(durationMinutes) || 60;
    // Sense preu (candado tancat): el de la carta
    let finalPrice = price !== undefined && price !== null && price !== "" ? String(price) : null;
    if (finalPrice === null) {
      const [svc] = await db.select({ price: services.price }).from(services).where(eq(services.id, Number(serviceId)));
      finalPrice = svc?.price ?? "0.00";
    }
    const computedEndTime = addMinutesToTime(startTime, duration);

    // Si la clienta no és al fitxer (mateix telèfon), la donem d'alta automàticament
    let linkedClientId: number | null = clientId ? Number(clientId) : null;
    let createdClient = false;

    // Comprovació i reserva juntes, amb bloqueig per dia: dues reserves alhora no poden quedar-se la mateixa hora
    const result = await withBookingLock([date], async (tx) => {
      const conflict = await findConflict({
        date,
        startTime,
        endTime: computedEndTime,
        roomId: Number(roomId),
        professionalId: Number(professionalId),
      }, tx);
      if (conflict) return { conflict };

      if (!linkedClientId) {
        const existing = await findClientByPhone(clientPhone);
        if (existing) {
          linkedClientId = existing.id;
        } else {
          const [created] = await tx.insert(clients).values({
            name: clientName.trim(),
            phone: clientPhone.trim(),
            email: clientEmail?.trim() || null,
          }).returning();
          linkedClientId = created.id;
          createdClient = true;
        }
      }

      const [row] = await tx.insert(appointments).values({
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail?.trim() || null,
        clientId: linkedClientId,
        roomId: Number(roomId),
        serviceId: Number(serviceId),
        professionalId: Number(professionalId),
        date,
        startTime,
        endTime: computedEndTime,
        durationMinutes: duration,
        status: status || "confirmada",
        price: finalPrice,
        paidCash: Boolean(paidCash),
        notes: notes?.trim() || null,
        source: source || "manual",
      }).returning();
      return { row };
    });

    if ("conflict" in result && result.conflict) {
      return NextResponse.json({ success: false, error: CONFLICT_MESSAGES[result.conflict] }, { status: 409 });
    }
    const newAppointment = result.row;

    return NextResponse.json({ success: true, data: newAppointment, createdClient });
  } catch (error) {
    console.error("Error creating appointment:", error);
    return NextResponse.json({ success: false, error: "Error al crear la cita" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureSchema();
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
      paidCash,
      notes,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Falta l'identificador de la cita" }, { status: 400 });
    }

    const validationError = invalidDateOrTime(date, startTime, durationMinutes);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
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
    if (price !== undefined && price !== null && price !== "") updateData.price = String(price);
    if (paidCash !== undefined) updateData.paidCash = Boolean(paidCash);

    const [existing] = await db.select().from(appointments).where(eq(appointments.id, Number(id)));
    if (!existing) {
      return NextResponse.json({ success: false, error: "No s'ha trobat la cita" }, { status: 404 });
    }

    // Recalculem sempre l'hora de final (abans, si només canviava l'hora d'inici, el final no es movia)
    if (startTime !== undefined || durationMinutes !== undefined) {
      const newStart = startTime ?? existing.startTime;
      const newDuration = durationMinutes !== undefined ? Number(durationMinutes) : existing.durationMinutes;
      updateData.startTime = newStart;
      updateData.durationMinutes = newDuration;
      updateData.endTime = addMinutesToTime(newStart, newDuration);
    }

    // Si canvia el dia o l'hora, el recordatori s'ha de tornar a enviar
    const newDate = (updateData.date as string | undefined) ?? existing.date;
    const newStartTime = (updateData.startTime as string | undefined) ?? existing.startTime;
    if (newDate !== existing.date || newStartTime !== existing.startTime) updateData.reminderSent = false;

    // Si la cita continua activa, comprovem que el canvi no xoqui amb cap altra cita
    const finalStatus = (updateData.status as string | undefined) ?? existing.status;
    const result = await withBookingLock([existing.date, newDate], async (tx) => {
    if (finalStatus !== "cancel·lada" && finalStatus !== "no-presentada") {
      const conflict = await findConflict({
        date: (updateData.date as string | undefined) ?? existing.date,
        startTime: (updateData.startTime as string | undefined) ?? existing.startTime,
        endTime: (updateData.endTime as string | undefined) ?? existing.endTime,
        roomId: (updateData.roomId as number | undefined) ?? existing.roomId,
        professionalId: (updateData.professionalId as number | undefined) ?? existing.professionalId,
        excludeAppointmentId: existing.id,
      }, tx);
      if (conflict) return { conflict };
    }

    const [row] = await tx.update(appointments)
      .set(updateData)
      .where(eq(appointments.id, Number(id)))
      .returning();
    return { row };
    });

    if ("conflict" in result && result.conflict) {
      return NextResponse.json({ success: false, error: CONFLICT_MESSAGES[result.conflict] }, { status: 409 });
    }
    const updated = result.row;

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating appointment:", error);
    return NextResponse.json({ success: false, error: "Error al modificar la cita" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Falta l'identificador" }, { status: 400 });
    }

    // No l'esborrem: la marquem com a cancel·lada perquè es pugui desfer i quedi a l'historial de la clienta
    const [before] = await db.select({ status: appointments.status }).from(appointments).where(eq(appointments.id, Number(id)));
    if (!before) return NextResponse.json({ success: false, error: "No s'ha trobat la cita" }, { status: 404 });
    await db.update(appointments).set({ status: "cancel·lada" }).where(eq(appointments.id, Number(id)));

    return NextResponse.json({ success: true, message: "Cita cancel·lada correctament", previousStatus: before.status });
  } catch (error) {
    console.error("Error deleting appointment:", error);
    return NextResponse.json({ success: false, error: "Error al cancel·lar la cita" }, { status: 500 });
  }
}
