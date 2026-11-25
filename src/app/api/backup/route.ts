import { db } from "@/db";
import * as t from "@/db/schema";
import { isOwnerUnlocked } from "@/lib/owner-lock";
import { todayStr } from "@/lib/dates";
import { ensureSchema } from "@/db/ensure-schema";

export const dynamic = "force-dynamic";

// Còpia de seguretat completa (un fitxer JSON) que la dueña es descarrega quan vol.
// Només amb el candado obert. No inclou la clau del candado.
export async function GET() {
  if (!(await isOwnerUnlocked())) {
    return Response.json({ success: false, error: "Cal obrir el candado" }, { status: 403 });
  }
  try {
    await ensureSchema();
    const tables = {
      clients: t.clients,
      client_treatments: t.clientTreatments,
      appointments: t.appointments,
      services: t.services,
      professionals: t.professionals,
      rooms: t.rooms,
      schedules: t.schedules,
      gift_vouchers: t.giftVouchers,
      gift_voucher_uses: t.giftVoucherUses,
      products: t.products,
      stock_movements: t.stockMovements,
      whatsapp_requests: t.botSimulations,
      center_settings: t.centerSettings,
    };
    const data: Record<string, unknown[]> = {};
    for (const [name, table] of Object.entries(tables)) {
      data[name] = await db.select().from(table);
    }
    const body = JSON.stringify({ app: "Estètica Diana", createdAt: new Date().toISOString(), tables: data }, null, 1);
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="copia-estetica-diana-${todayStr()}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error backup:", error);
    return Response.json({ success: false, error: "No s'ha pogut fer la còpia" }, { status: 500 });
  }
}
