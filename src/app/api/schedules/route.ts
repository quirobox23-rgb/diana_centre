import { NextResponse } from "next/server";
import { db } from "@/db";
import { schedules } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  try {
    const list = await db.select().from(schedules).orderBy(asc(schedules.dayOfWeek));
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return NextResponse.json({ success: false, error: "Error al carregar els horaris" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, isOpen, morningStart, morningEnd, afternoonStart, afternoonEnd, notes } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Falta l'identificador de l'horari" }, { status: 400 });
    }

    const [updated] = await db.update(schedules)
      .set({
        isOpen: isOpen !== undefined ? Boolean(isOpen) : undefined,
        morningStart: morningStart !== undefined ? morningStart : undefined,
        morningEnd: morningEnd !== undefined ? morningEnd : undefined,
        afternoonStart: afternoonStart !== undefined ? afternoonStart : undefined,
        afternoonEnd: afternoonEnd !== undefined ? afternoonEnd : undefined,
        notes: notes !== undefined ? notes : undefined,
      })
      .where(eq(schedules.id, Number(id)))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating schedule:", error);
    return NextResponse.json({ success: false, error: "Error al modificar l'horari" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { dayOfWeek, dayName, isOpen, morningStart, morningEnd, afternoonStart, afternoonEnd, notes } = body;

    const [newSchedule] = await db.insert(schedules).values({
      dayOfWeek: Number(dayOfWeek),
      dayName: dayName || "Dia especial",
      isOpen: isOpen !== undefined ? Boolean(isOpen) : true,
      morningStart: morningStart || "09:30",
      morningEnd: morningEnd || "13:30",
      afternoonStart: afternoonStart || "15:30",
      afternoonEnd: afternoonEnd || "20:00",
      notes: notes || null,
    }).returning();

    return NextResponse.json({ success: true, data: newSchedule });
  } catch (error) {
    console.error("Error adding schedule:", error);
    return NextResponse.json({ success: false, error: "Error al afegir horari" }, { status: 500 });
  }
}
