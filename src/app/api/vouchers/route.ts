import { NextResponse } from "next/server";
import { db } from "@/db";
import { giftVouchers, giftVoucherUses } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { ensureSchema } from "@/db/ensure-schema";
import { todayStr } from "@/lib/dates";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ["import", "servei"];
const STATUSES = ["actiu", "bescanviat", "anul·lat"];

// Codi curt i fàcil de dictar: DIANA-XXXX (sense 0/O ni 1/I)
function newCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `DIANA-${out}`;
}

function money(v: unknown): string | null {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : null;
}

function clean(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function GET() {
  try {
    await ensureSchema();
    const list = await db.select().from(giftVouchers).orderBy(desc(giftVouchers.createdAt));
    const ids = list.map(v => v.id);
    const uses = ids.length
      ? await db.select().from(giftVoucherUses).where(inArray(giftVoucherUses.voucherId, ids)).orderBy(giftVoucherUses.date)
      : [];
    return NextResponse.json({
      success: true,
      data: list.map(v => ({ ...v, uses: uses.filter(u => u.voucherId === v.id) })),
    });
  } catch (error) {
    console.error("Error fetching vouchers:", error);
    return NextResponse.json({ success: false, error: "Error al carregar els xecs regal" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const kind = KINDS.includes(body.kind) ? body.kind : "import";
    const buyerName = clean(body.buyerName);
    const recipientName = clean(body.recipientName) ?? buyerName;
    const amount = money(body.amount ?? 0);
    const issueDate = clean(body.issueDate) ?? todayStr();
    const expiryDate = clean(body.expiryDate);

    if (!buyerName) {
      return NextResponse.json({ success: false, error: "Cal el nom de qui compra el xec" }, { status: 400 });
    }
    if (amount === null || (kind === "import" && Number(amount) <= 0)) {
      return NextResponse.json({ success: false, error: "L'import no és vàlid" }, { status: 400 });
    }
    if (kind === "servei" && !body.serviceId && !clean(body.serviceText)) {
      return NextResponse.json({ success: false, error: "Indica el servei regalat" }, { status: 400 });
    }
    if (!DATE_RE.test(issueDate) || (expiryDate && !DATE_RE.test(expiryDate))) {
      return NextResponse.json({ success: false, error: "Data no vàlida" }, { status: 400 });
    }

    const values = {
      kind,
      amount,
      remaining: amount,
      serviceId: body.serviceId ? Number(body.serviceId) : null,
      serviceText: clean(body.serviceText),
      buyerName,
      buyerPhone: clean(body.buyerPhone),
      recipientName: recipientName!,
      recipientPhone: clean(body.recipientPhone),
      issueDate,
      expiryDate,
      paymentMethod: clean(body.paymentMethod),
      notes: clean(body.notes),
      status: "actiu",
    };

    // Reintentem si per casualitat el codi ja existeix
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const [created] = await db.insert(giftVouchers).values({ ...values, code: newCode() }).returning();
        return NextResponse.json({ success: true, data: { ...created, uses: [] } });
      } catch (err) {
        if ((err as { code?: string }).code !== "23505" || attempt === 4) throw err;
      }
    }
    throw new Error("unreachable");
  } catch (error) {
    console.error("Error creating voucher:", error);
    return NextResponse.json({ success: false, error: "Error al crear el xec regal" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return NextResponse.json({ success: false, error: "Falta l'identificador" }, { status: 400 });
    if (body.status !== undefined && !STATUSES.includes(body.status)) {
      return NextResponse.json({ success: false, error: "Estat no vàlid" }, { status: 400 });
    }
    const expiryDate = body.expiryDate === undefined ? undefined : clean(body.expiryDate);
    if (expiryDate && !DATE_RE.test(expiryDate)) {
      return NextResponse.json({ success: false, error: "Data no vàlida" }, { status: 400 });
    }

    const [updated] = await db.update(giftVouchers).set({
      buyerName: body.buyerName !== undefined ? clean(body.buyerName) ?? undefined : undefined,
      buyerPhone: body.buyerPhone !== undefined ? clean(body.buyerPhone) : undefined,
      recipientName: body.recipientName !== undefined ? clean(body.recipientName) ?? undefined : undefined,
      recipientPhone: body.recipientPhone !== undefined ? clean(body.recipientPhone) : undefined,
      serviceText: body.serviceText !== undefined ? clean(body.serviceText) : undefined,
      paymentMethod: body.paymentMethod !== undefined ? clean(body.paymentMethod) : undefined,
      notes: body.notes !== undefined ? clean(body.notes) : undefined,
      expiryDate,
      status: body.status,
    }).where(eq(giftVouchers.id, id)).returning();

    if (!updated) return NextResponse.json({ success: false, error: "Xec no trobat" }, { status: 404 });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating voucher:", error);
    return NextResponse.json({ success: false, error: "Error al modificar el xec regal" }, { status: 500 });
  }
}
