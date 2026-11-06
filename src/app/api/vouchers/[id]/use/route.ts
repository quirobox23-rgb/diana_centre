import { NextResponse } from "next/server";
import { db, pool } from "@/db";
import { giftVouchers, giftVoucherUses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureSchema } from "@/db/ensure-schema";
import { todayStr } from "@/lib/dates";

// Fa servir un xec: tot (servei) o una part de l'import
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const id = Number((await params).id);
    const body = await request.json().catch(() => ({}));
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

    const [voucher] = await db.select().from(giftVouchers).where(eq(giftVouchers.id, id));
    if (!voucher) return NextResponse.json({ success: false, error: "Xec no trobat" }, { status: 404 });
    if (voucher.status !== "actiu") {
      return NextResponse.json({ success: false, error: "Aquest xec ja no està actiu" }, { status: 400 });
    }
    if (voucher.expiryDate && voucher.expiryDate < todayStr()) {
      return NextResponse.json({ success: false, error: `Aquest xec va caducar el ${voucher.expiryDate}` }, { status: 400 });
    }

    const remaining = Number(voucher.remaining);
    let amount = voucher.kind === "servei" ? remaining : Number(String(body.amount ?? "").replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ success: false, error: "Import no vàlid" }, { status: 400 });
    }
    if (voucher.kind === "import") {
      if (amount <= 0) return NextResponse.json({ success: false, error: "Indica quin import es gasta" }, { status: 400 });
      if (amount > remaining + 0.001) {
        return NextResponse.json({ success: false, error: `Només queden ${remaining.toFixed(2)} € al xec` }, { status: 400 });
      }
    }
    amount = Math.round(amount * 100) / 100;
    const left = voucher.kind === "servei" ? 0 : Math.max(0, Math.round((remaining - amount) * 100) / 100);

    // Actualització condicionada al saldo actual, perquè dos usos alhora no el deixin negatiu
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const upd = await client.query(
        `UPDATE gift_vouchers SET remaining = $1, status = $2 WHERE id = $3 AND remaining = $4 AND status = 'actiu'`,
        [left.toFixed(2), left <= 0 ? "bescanviat" : "actiu", id, voucher.remaining]
      );
      if (upd.rowCount !== 1) {
        await client.query("ROLLBACK");
        return NextResponse.json({ success: false, error: "El xec ha canviat, torna-ho a provar" }, { status: 409 });
      }
      await client.query(
        `INSERT INTO gift_voucher_uses (voucher_id, date, amount, note) VALUES ($1, $2, $3, $4)`,
        [id, todayStr(), amount.toFixed(2), note]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    const [updated] = await db.select().from(giftVouchers).where(eq(giftVouchers.id, id));
    const uses = await db.select().from(giftVoucherUses).where(eq(giftVoucherUses.voucherId, id)).orderBy(giftVoucherUses.date);
    return NextResponse.json({ success: true, data: { ...updated, uses } });
  } catch (error) {
    console.error("Error using voucher:", error);
    return NextResponse.json({ success: false, error: "Error al bescanviar el xec" }, { status: 500 });
  }
}
