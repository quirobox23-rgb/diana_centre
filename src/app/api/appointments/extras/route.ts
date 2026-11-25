import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointmentExtras, appointments, services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureSchema } from "@/db/ensure-schema";

// Coses afegides al compte d'una cita: un altre tractament, un bo, o qualsevol altra cosa amb preu.
// (Els productes de l'Estoc es venen per /api/stock amb appointmentId.)

function money(v: unknown): string | null {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : null;
}

export async function GET(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("appointmentId"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ success: false, error: "Falta la cita" }, { status: 400 });
  try {
    await ensureSchema();
    const rows = await db.select().from(appointmentExtras).where(eq(appointmentExtras.appointmentId, id)).orderBy(appointmentExtras.createdAt);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error extras:", error);
    return NextResponse.json({ success: false, error: "Error al carregar el compte" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json().catch(() => ({}));
    const appointmentId = Number(body.appointmentId);
    const [apt] = Number.isInteger(appointmentId) ? await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.id, appointmentId)) : [];
    if (!apt) return NextResponse.json({ success: false, error: "No trobo la cita" }, { status: 404 });

    const kind = ["servei", "bo", "altre"].includes(body.kind) ? body.kind : "altre";
    const quantity = Number.isInteger(Number(body.quantity)) && Number(body.quantity) > 0 ? Number(body.quantity) : 1;
    let description = typeof body.description === "string" ? body.description.trim() : "";
    let unitPrice = money(body.unitPrice);
    let serviceId: number | null = null;

    if (kind === "servei") {
      const [svc] = await db.select().from(services).where(eq(services.id, Number(body.serviceId)));
      if (!svc) return NextResponse.json({ success: false, error: "Tria el tractament" }, { status: 400 });
      serviceId = svc.id;
      description = description || svc.name;
      if (unitPrice === null) unitPrice = svc.price;
    }
    if (!description) return NextResponse.json({ success: false, error: "Escriu què s'afegeix" }, { status: 400 });
    if (unitPrice === null) return NextResponse.json({ success: false, error: "Posa el preu" }, { status: 400 });

    const [row] = await db.insert(appointmentExtras).values({ appointmentId, kind, serviceId, description, quantity, unitPrice, paidCash: body.paidCash === true }).returning();
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    console.error("Error extras:", error);
    return NextResponse.json({ success: false, error: "No s'ha pogut afegir" }, { status: 500 });
  }
}

// Canviar com es cobra una línia (targeta / efectiu)
export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ success: false, error: "Falta la línia" }, { status: 400 });
    await db.update(appointmentExtras).set({ paidCash: body.paidCash === true }).where(eq(appointmentExtras.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error extras:", error);
    return NextResponse.json({ success: false, error: "No s'ha pogut canviar" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ success: false, error: "Falta la línia" }, { status: 400 });
  try {
    await db.delete(appointmentExtras).where(eq(appointmentExtras.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error extras:", error);
    return NextResponse.json({ success: false, error: "No s'ha pogut treure" }, { status: 500 });
  }
}
