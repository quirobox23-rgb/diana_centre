import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, botSimulations, services, clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendWhatsApp } from "@/lib/twilio";
import { CONFLICT_MESSAGES, findConflict, withBookingLock } from "@/lib/availability";
import { findClientByPhone } from "@/lib/client-profile";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { simulationId, slotIndex, manualSlot, clientName, clientPhone, modified, serviceId: chosenServiceId } = body;

    let targetSlot = manualSlot;
    let targetClientName = clientName;
    let targetClientPhone = clientPhone;
    let serviceId: number | null = null;
    let serviceName = "Servei d'estètica";
    let clientMessage: string | null = null;
    let price = "50.00";
    let durationMinutes = 60;

    if (simulationId) {
      const [sim] = await db.select().from(botSimulations).where(eq(botSimulations.id, Number(simulationId)));
      if (!sim) {
        return NextResponse.json({ success: false, error: "No s'ha trobat la sol·licitud" }, { status: 404 });
      }
      // Una sol·licitud descartada o ja confirmada no es pot tornar a confirmar
      if (sim.status !== "pendent_confirmacio" && sim.status !== "opcions_enviades") {
        return NextResponse.json({ success: false, error: "Aquesta sol·licitud ja s'ha confirmat o descartat." }, { status: 409 });
      }
      if (sim) {
        clientMessage = sim.incomingMessage?.trim() || null;
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

    // La propietària ha canviat el dia o l'hora des de "Sol·licituds pendents"
    if (modified && manualSlot?.date && manualSlot?.time && manualSlot?.endTime) {
      targetSlot = { ...targetSlot, ...manualSlot };
    }

    if (!targetSlot) {
      return NextResponse.json({ success: false, error: "No s'ha trobat la franja horària per confirmar" }, { status: 400 });
    }

    // La dueña pot triar o canviar el tractament des de la targeta
    if (chosenServiceId) serviceId = Number(chosenServiceId);
    if (!serviceId) {
      return NextResponse.json({ success: false, error: "Tria el tractament abans de confirmar." }, { status: 400 });
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

    if (!targetClientPhone) {
      return NextResponse.json({ success: false, error: "La sol·licitud no té telèfon." }, { status: 400 });
    }

    // Vinculem la cita amb la fitxa de la clienta pel telèfon; si és nova, la donem d'alta (com a les cites manuals)
    const knownClient = await findClientByPhone(targetClientPhone);

    // L'hora es va oferir fa una estona: comprovem que encara estigui lliure i reservem, tot amb bloqueig
    const booking = await withBookingLock([targetSlot.date], async (tx) => {
      const conflict = await findConflict({
        date: targetSlot.date,
        startTime: targetSlot.time,
        endTime: targetSlot.endTime,
        roomId: Number(targetSlot.roomId),
        professionalId: Number(targetSlot.professionalId),
      }, tx);
      if (conflict) return { conflict };

      let clientId = knownClient?.id ?? null;
      // El mode demostració de l'agent fa servir un telèfon fals (+34 000…): no el guardem com a clienta
      const isDemoPhone = /^0+$/.test(String(targetClientPhone).replace(/\D/g, "").replace(/^34/, ""));
      if (!clientId && !isDemoPhone) {
        const [created] = await tx.insert(clients).values({
          name: (targetClientName || "Clienta WhatsApp").trim(),
          phone: String(targetClientPhone).trim(),
        }).returning();
        clientId = created.id;
      }

      const notes = ["Reservada per WhatsApp.", clientMessage && !["matí", "tarda"].includes(clientMessage) ? `Missatge: «${clientMessage}»` : null]
        .filter(Boolean)
        .join(" ");
      const [row] = await tx.insert(appointments).values({
        clientName: targetClientName || "Clienta WhatsApp",
        clientPhone: String(targetClientPhone),
        clientId,
        roomId: targetSlot.roomId,
        serviceId: serviceId!,
        professionalId: targetSlot.professionalId,
        date: targetSlot.date,
        startTime: targetSlot.time,
        endTime: targetSlot.endTime,
        durationMinutes,
        status: "confirmada",
        price: price,
        notes,
        source: "whatsapp",
      }).returning();
      return { row };
    });
    if ("conflict" in booking && booking.conflict) {
      return NextResponse.json({
        success: false,
        error: `${CONFLICT_MESSAGES[booking.conflict]} Aquesta hora ja s'ha ocupat des que es va oferir; tria'n una altra.`,
      }, { status: 409 });
    }
    const newAppointment = booking.row;

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
