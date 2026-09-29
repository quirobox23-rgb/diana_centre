import { NextResponse } from "next/server";
import { db } from "@/db";
import { botSimulations, centerSettings } from "@/db/schema";
import { sql } from "drizzle-orm";
import { generateBotReply } from "@/lib/bot-engine";

export async function GET() {
  try {
    const history = await db.select().from(botSimulations).orderBy(sql`${botSimulations.createdAt} DESC`).limit(20);
    const [settings] = await db.select().from(centerSettings).limit(1);

    return NextResponse.json({
      success: true,
      history,
      settings: settings || null,
    });
  } catch (error) {
    console.error("Error fetching bot data:", error);
    return NextResponse.json({ success: false, error: "Error al carregar simulador" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientPhone = "+34 600 00 00 00", clientName = "Clienta", message = "" } = body;

    if (!message.trim()) {
      return NextResponse.json({ success: false, error: "Cal introduir un missatge de la clienta" }, { status: 400 });
    }

    const { simulation, matchedService, foundSlots, replyText } = await generateBotReply({
      clientPhone,
      clientName,
      message,
    });

    return NextResponse.json({
      success: true,
      simulationId: simulation.id,
      clientName: clientName.trim(),
      detectedService: matchedService,
      proposedSlots: foundSlots,
      replyMessage: replyText,
    });
  } catch (error) {
    console.error("Error running bot simulator:", error);
    return NextResponse.json({ success: false, error: "Error en el processament del bot" }, { status: 500 });
  }
}
