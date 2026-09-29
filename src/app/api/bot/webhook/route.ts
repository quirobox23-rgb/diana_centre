import { NextResponse } from "next/server";
import { db } from "@/db";
import { botSimulations, centerSettings } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateBotReply, SlotOption } from "@/lib/bot-engine";
import { sendWhatsApp, validateTwilioSignature } from "@/lib/twilio";

// Verificació estàndard de Meta / WhatsApp Business API (no cal per Twilio, es manté per compatibilitat futura)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === (process.env.WHATSAPP_VERIFY_TOKEN || "estetica_diana_token")) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({
    status: "online",
    service: "Estètica Diana - WhatsApp Webhook",
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  // 1. Validar que la petició ve realment de Twilio
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/bot/webhook`
    : "";
  const signature = request.headers.get("x-twilio-signature");
  if (!validateTwilioSignature(signature, rawBody, appUrl)) {
    console.error("[webhook] Firma de Twilio invàlida — petició rebutjada");
    return NextResponse.json({ status: "invalid_signature" }, { status: 403 });
  }

  const params = new URLSearchParams(rawBody);
  const from = params.get("From") || ""; // "whatsapp:+34..."
  const body = (params.get("Body") || "").trim();
  const profileName = params.get("ProfileName") || "Clienta";
  const phone = from.replace("whatsapp:", "");

  if (!phone || !body) {
    return NextResponse.json({ status: "ignored" });
  }

  try {
    await handleIncomingMessage(phone, profileName, body);
  } catch (error) {
    console.error("[webhook] Error processant el missatge:", error);
  }

  // Twilio només necessita un 200 OK; les respostes s'envien via API, no via TwiML
  return NextResponse.json({ status: "received" });
}

async function handleIncomingMessage(phone: string, clientName: string, body: string) {
  // Busquem si hi ha una conversa oberta amb aquesta clienta (encara no confirmada per la professional)
  const [openConvo] = await db.select().from(botSimulations)
    .where(and(eq(botSimulations.clientPhone, phone), eq(botSimulations.status, "opcions_enviades")))
    .orderBy(desc(botSimulations.createdAt))
    .limit(1);

  const lower = body.toLowerCase().trim();

  // PAS 2: la clienta ja ha triat una opció i ara confirma amb "sí"
  if (openConvo && openConvo.conversationStep === "esperant_confirmacio") {
    if (["si", "sí", "yes", "s"].includes(lower)) {
      // NO reservem automàticament: guardem l'elecció i esperem que la professional confirmi des del panell
      await db.update(botSimulations)
        .set({ status: "pendent_confirmacio", conversationStep: "tancada" })
        .where(eq(botSimulations.id, openConvo.id));

      const slots: SlotOption[] = openConvo.proposedSlots ? JSON.parse(openConvo.proposedSlots) : [];
      const slot = slots[openConvo.selectedSlotIndex ?? 0];
      const [settings] = await db.select().from(centerSettings).limit(1);

      const msg = slot
        ? `Perfecte, ${clientName.split(" ")[0]}! 📝\n\nHas triat:\n📅 *${slot.displayDate}*\n🕐 *${slot.time}h - ${slot.endTime}h*\n\nLa teva professional et confirmarà aquesta hora en breu. T'avisarem per aquí en quant estigui tot llest ✅`
        : settings?.autoReplyConfirmation || "Gràcies! T'avisarem en breu.";

      await sendWhatsApp(phone, msg);
      return;
    }
    // Si respon una altra cosa, tornem a preguntar
    await sendWhatsApp(phone, `Respon *SÍ* per confirmar l'horari triat, si us plau 🙏`);
    return;
  }

  // PAS 1b: la clienta ja té opcions enviades i tria un número (1, 2 o 3)
  if (openConvo && openConvo.conversationStep === "esperant_seleccio") {
    const choice = parseInt(lower, 10);
    if (choice >= 1 && choice <= 3) {
      const slots: SlotOption[] = openConvo.proposedSlots ? JSON.parse(openConvo.proposedSlots) : [];
      const slot = slots[choice - 1];
      if (slot) {
        await db.update(botSimulations)
          .set({ selectedSlotIndex: choice - 1, conversationStep: "esperant_confirmacio" })
          .where(eq(botSimulations.id, openConvo.id));

        await sendWhatsApp(phone,
          `Has triat: *${slot.displayDate} a les ${slot.time}h*.\n\nRespon *SÍ* per confirmar aquesta elecció 🙏`
        );
        return;
      }
    }
    await sendWhatsApp(phone, `Respon amb *1*, *2* o *3* per triar una de les opcions, si us plau 🙏`);
    return;
  }

  // PAS 1a: missatge nou — detectar servei i enviar 3 opcions
  const { replyText } = await generateBotReply({ clientPhone: phone, clientName, message: body });
  await sendWhatsApp(phone, replyText);
}
