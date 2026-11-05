import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, botSimulations, services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendWhatsApp } from "@/lib/twilio";
import { CONFLICT_MESSAGES, findConflict } from "@/lib/availability";
import { findClientByPhone } from "@/lib/client-profile";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { simulationId, slotIndex, manualSlot, clientName, clientPhone } = body;

    let targetSlot = manualSlot;
    let targetClientName = clientName;
    let targetClientPhone = clientPhone;
    let serviceId: number | null = null;
    let serviceName = "Servei d'estètica";
    let price = "50.00";
    let durationMinutes = 60;

    if (simulationId) {
      const [sim] = await db.select().from(botSimulations).where(eq(botSimulations.id, Number(simulationId)));
      if (sim) {
        targetClientName = sim.clientName;
        targetClientPhone = sim.clientPhone;
        serviceId = sim.detectedServiceId;

        if (sim.proposedSlots) {
          try {
            const slots = JSON.parse(sim.proposedSlots);
            if (slots && slots[slotIndex !== undefined ? slotIndex : 0]) {
              targetSlot = slots[slotIndex !== undefined ? slotIndex : 0];
            }
          } catch {
            // ignore parse err
          }
        }
      }
    }

    if (!targetSlot) {
      return NextResponse.json({ success: false, error: "No s'ha trobat la franja horària per confirmar" }, { status: 400 });
    }

    // Obtenir informació del servei
    if (serviceId) {
      const [svc] = await db.select().from(services).where(eq(services.id, serviceId));
      if (svc) {
        serviceName = svc.name;
        price = svc.price;
        durationMinutes = svc.durationMinutes;
      }
    }

    // La durada real és la de la franja oferta (pot ser la personalitzada de la clienta)
    const [sh, sm] = String(targetSlot.time).split(":").map(Number);
    const [eh, em] = String(targetSlot.endTime).split(":").map(Number);
    const slotMinutes = (eh * 60 + em) - (sh * 60 + sm);
    if (slotMinutes > 0) durationMinutes = slotMinutes;

    // Vinculem la cita amb la fitxa de la clienta si la trobem pel telèfon
    const knownClient = targetClientPhone ? await findClientByPhone(targetClientPhone) : null;

    // L'hora es va oferir fa una estona: comprovem que encara estigui lliure abans de reservar-la
    const conflict = await findConflict({
      date: targetSlot.date,
      startTime: targetSlot.time,
      endTime: targetSlot.endTime,
      roomId: Number(targetSlot.roomId),
      professionalId: Number(targetSlot.professionalId),
    });
    if (conflict) {
      return NextResponse.json({
        success: false,
        error: `${CONFLICT_MESSAGES[conflict]} Aquesta hora ja s'ha ocupat des que es va oferir; tria'n una altra.`,
      }, { status: 409 });
    }

    // Crear la cita oficial a la base de dades
    const [newAppointment] = await db.insert(appointments).values({
      clientName: targetClientName || "Clienta WhatsApp",
      clientPhone: targetClientPhone || "+34 600 00 00 00",
      clientId: knownClient?.id ?? null,
      roomId: targetSlot.roomId,
      serviceId: serviceId || 1,
      professionalId: targetSlot.professionalId,
      date: targetSlot.date,
      startTime: targetSlot.time,
      endTime: targetSlot.endTime,
      durationMinutes,
      status: "confirmada",
      price: price,
      notes: `Reservada automàticament via Assistència Virtual Mòbil / WhatsApp. Opcions proposades acceptades.`,
      source: "whatsapp_bot",
    }).returning();

    // Actualitzar la simulació
    let wasRealPendingRequest = false;
    if (simulationId) {
      const [simBefore] = await db.select().from(botSimulations).where(eq(botSimulations.id, Number(simulationId)));
      wasRealPendingRequest = simBefore?.status === "pendent_confirmacio";

      await db.update(botSimulations)
        .set({
          selectedSlotIndex: slotIndex,
          status: "cita_confirmada",
        })
        .where(eq(botSimulations.id, Number(simulationId)));
    }

    const confirmationMessage = `✅ Cita Confirmada amb Èxit!\n\n${targetClientName}, t'hem agendat per a *${serviceName}*:\n📅 Data: ${targetSlot.displayDate || targetSlot.date}\n⏰ Hora: ${targetSlot.time}h a ${targetSlot.endTime}h\n🏠 Sala: ${targetSlot.roomName}\n👩‍🦰 Professional: ${targetSlot.professionalName}\n\nSi necessites fer qualsevol canvi, pots respondre a aquest mateix xat. T'esperem! ✨`;

    // Només enviem el WhatsApp real quan ve d'una sol·licitud real pendent de confirmar
    // (evita enviar-lo si és una prova manual des del simulador)
    let whatsappSent = false;
    if (wasRealPendingRequest && targetClientPhone) {
      try {
        await sendWhatsApp(targetClientPhone, confirmationMessage);
        whatsappSent = true;
      } catch (err) {
        console.error("[bot/confirm] Error enviant WhatsApp de confirmació:", err);
      }
    }

    return NextResponse.json({
      success: true,
      appointment: newAppointment,
      confirmationMessage,
      whatsappSent,
    });
  } catch (error) {
    console.error("Error confirming slot:", error);
    return NextResponse.json({ success: false, error: "Error al confirmar la cita" }, { status: 500 });
  }
}
