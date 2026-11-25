import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointmentExtras, appointments, giftVouchers, giftVoucherUses, products, stockMovements } from "@/db/schema";
import { and, eq, gte, lte, ne, notInArray, sql } from "drizzle-orm";
import { isOwnerUnlocked } from "@/lib/owner-lock";
import { ensureSchema } from "@/db/ensure-schema";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Altres ingressos del període (productes venuts i xecs regal) per al Resum.
// Només amb el candado obert, com la resta d'imports.
export async function GET(request: Request) {
  if (!(await isOwnerUnlocked())) {
    return NextResponse.json({ success: false, error: "Cal obrir el candado" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start") || "";
  const end = searchParams.get("end") || "";
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
    return NextResponse.json({ success: false, error: "Dates no vàlides" }, { status: 400 });
  }
  try {
    await ensureSchema();
    const [prod] = await db
      .select({
        units: sql<number>`coalesce(sum(-${stockMovements.quantity}), 0)::int`,
        amount: sql<string>`coalesce(sum(-${stockMovements.quantity} * ${products.price}), 0)::text`,
        cash: sql<string>`coalesce(sum(-${stockMovements.quantity} * ${products.price}) filter (where ${stockMovements.paidCash}), 0)::text`,
      })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .where(and(eq(stockMovements.kind, "venda"), gte(stockMovements.date, start), lte(stockMovements.date, end)));

    const sold = await db
      .select({ method: giftVouchers.paymentMethod, amount: sql<string>`coalesce(sum(${giftVouchers.amount}), 0)::text`, n: sql<number>`count(*)::int` })
      .from(giftVouchers)
      .where(and(gte(giftVouchers.issueDate, start), lte(giftVouchers.issueDate, end), ne(giftVouchers.status, "anul·lat")))
      .groupBy(giftVouchers.paymentMethod);

    const [used] = await db
      .select({ amount: sql<string>`coalesce(sum(${giftVoucherUses.amount}), 0)::text` })
      .from(giftVoucherUses)
      .where(and(gte(giftVoucherUses.date, start), lte(giftVoucherUses.date, end)));

    // Altres coses del compte de les cites (un altre tractament, bons...), amb el que s'ha cobrat en efectiu
    const [ext] = await db
      .select({
        amount: sql<string>`coalesce(sum(${appointmentExtras.quantity} * ${appointmentExtras.unitPrice}), 0)::text`,
        cash: sql<string>`coalesce(sum(${appointmentExtras.quantity} * ${appointmentExtras.unitPrice}) filter (where ${appointmentExtras.paidCash}), 0)::text`,
      })
      .from(appointmentExtras)
      .innerJoin(appointments, eq(appointments.id, appointmentExtras.appointmentId))
      .where(and(gte(appointments.date, start), lte(appointments.date, end), notInArray(appointments.status, ["cancel·lada", "no-presentada"])));

    return NextResponse.json({
      success: true,
      extras: { amount: Number(ext?.amount ?? 0), cash: Number(ext?.cash ?? 0) },
      products: { units: Number(prod?.units ?? 0), amount: Number(prod?.amount ?? 0), cash: Number(prod?.cash ?? 0) },
      vouchersSold: {
        count: sold.reduce((s, r) => s + Number(r.n), 0),
        amount: sold.reduce((s, r) => s + Number(r.amount), 0),
        byMethod: Object.fromEntries(sold.map((r) => [r.method || "sense indicar", Number(r.amount)])),
      },
      vouchersUsed: Number(used?.amount ?? 0),
    });
  } catch (error) {
    console.error("Error summary:", error);
    return NextResponse.json({ success: false, error: "Error al carregar el resum" }, { status: 500 });
  }
}
