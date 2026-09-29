import { NextResponse } from "next/server";
import { db } from "@/db";
import { centerSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const list = await db.select().from(centerSettings).limit(1);
    if (list.length === 0) {
      const [created] = await db.insert(centerSettings).values({
        centerName: "Estètica Diana",
        phone: "+34 689 34 52 10",
        address: "Carrer Gran de Gràcia, 112, Barcelona",
      }).returning();
      return NextResponse.json({ success: true, data: created });
    }
    return NextResponse.json({ success: true, data: list[0] });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ success: false, error: "Error al carregar configuració" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, centerName, phone, address, autoReplyEnabled, autoReplyGreeting, autoReplyConfirmation } = body;

    const list = await db.select().from(centerSettings).limit(1);
    if (list.length === 0) {
      const [created] = await db.insert(centerSettings).values({
        centerName: centerName || "Estètica Diana",
        phone: phone || "+34 689 34 52 10",
        address: address || "Carrer Gran de Gràcia, 112, Barcelona",
        autoReplyEnabled: autoReplyEnabled !== undefined ? autoReplyEnabled : true,
        autoReplyGreeting,
        autoReplyConfirmation,
      }).returning();
      return NextResponse.json({ success: true, data: created });
    }

    const currentId = id || list[0].id;
    const [updated] = await db.update(centerSettings)
      .set({
        centerName: centerName !== undefined ? centerName : undefined,
        phone: phone !== undefined ? phone : undefined,
        address: address !== undefined ? address : undefined,
        autoReplyEnabled: autoReplyEnabled !== undefined ? autoReplyEnabled : undefined,
        autoReplyGreeting: autoReplyGreeting !== undefined ? autoReplyGreeting : undefined,
        autoReplyConfirmation: autoReplyConfirmation !== undefined ? autoReplyConfirmation : undefined,
      })
      .where(eq(centerSettings.id, currentId))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ success: false, error: "Error al desar la configuració" }, { status: 500 });
  }
}
