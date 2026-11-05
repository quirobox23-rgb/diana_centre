import { NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getClientStats, getClientTreatments, saveClientTreatments } from "@/lib/client-profile";

type Ctx = { params: Promise<{ id: string }> };

// Fitxa ampliada: tractaments propis (durada i professional) + estadístiques de l'historial
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const id = Number((await params).id);
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    if (!client) {
      return NextResponse.json({ success: false, error: "Clienta no trobada" }, { status: 404 });
    }
    const [treatments, stats] = await Promise.all([getClientTreatments(id), getClientStats(client)]);
    return NextResponse.json({ success: true, data: { treatments, stats } });
  } catch (error) {
    console.error("Error fetching client profile:", error);
    return NextResponse.json({ success: false, error: "Error al carregar la fitxa" }, { status: 500 });
  }
}

// Desa la llista completa de tractaments de la clienta
export async function PUT(request: Request, { params }: Ctx) {
  try {
    const id = Number((await params).id);
    const body = await request.json();
    const items = Array.isArray(body?.treatments) ? body.treatments : [];
    for (const i of items) {
      const d = i.durationMinutes;
      if (d !== null && d !== undefined && d !== "" && (!Number.isFinite(Number(d)) || Number(d) <= 0 || Number(d) > 600)) {
        return NextResponse.json({ success: false, error: "La durada ha de ser entre 1 i 600 minuts" }, { status: 400 });
      }
    }
    await saveClientTreatments(id, items);
    return NextResponse.json({ success: true, data: await getClientTreatments(id) });
  } catch (error) {
    console.error("Error saving client treatments:", error);
    return NextResponse.json({ success: false, error: "Error al desar els tractaments" }, { status: 500 });
  }
}
