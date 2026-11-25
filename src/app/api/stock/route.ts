import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, stockMovements } from "@/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { ensureSchema } from "@/db/ensure-schema";
import { todayStr } from "@/lib/dates";
import { AROMSNATUR_CATALOG } from "@/lib/aromsnatur-catalog";

function clean(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function money(v: unknown): string {
  const n = Number(String(v ?? "0").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : "0.00";
}

function wholeNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// Llista de productes amb el que en queda i el que s'ha venut aquest mes
// (?appointmentId=N: només els productes venuts en aquella cita)
export async function GET(request: Request) {
  try {
    await ensureSchema();
    const aptId = Number(new URL(request.url).searchParams.get("appointmentId"));
    if (Number.isInteger(aptId) && aptId > 0) {
      const sales = await db
        .select({
          id: stockMovements.id,
          productId: stockMovements.productId,
          productName: products.name,
          quantity: sql<number>`(-${stockMovements.quantity})::int`,
          price: products.price,
          paidCash: stockMovements.paidCash,
        })
        .from(stockMovements)
        .innerJoin(products, eq(products.id, stockMovements.productId))
        .where(and(eq(stockMovements.appointmentId, aptId), eq(stockMovements.kind, "venda")))
        .orderBy(stockMovements.createdAt);
      return NextResponse.json({ success: true, data: sales });
    }
    const monthStart = `${todayStr().slice(0, 7)}-01`;
    const list = await db.select().from(products).where(eq(products.isActive, true)).orderBy(products.name);
    // Sortides del mes: venudes (al públic) o gastades al centre (ús professional)
    const out = await db
      .select({
        productId: stockMovements.productId,
        kind: stockMovements.kind,
        qty: sql<number>`coalesce(sum(-${stockMovements.quantity}), 0)::int`,
      })
      .from(stockMovements)
      .where(and(inArray(stockMovements.kind, ["venda", "us"]), gte(stockMovements.date, monthStart)))
      .groupBy(stockMovements.productId, stockMovements.kind);
    const soldMap = new Map(out.filter((s) => s.kind === "venda").map((s) => [s.productId, Number(s.qty)]));
    const usedMap = new Map(out.filter((s) => s.kind === "us").map((s) => [s.productId, Number(s.qty)]));

    const recent = await db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        productName: products.name,
        quantity: stockMovements.quantity,
        kind: stockMovements.kind,
        date: stockMovements.date,
        note: stockMovements.note,
      })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .orderBy(desc(stockMovements.createdAt))
      .limit(30);

    return NextResponse.json({
      success: true,
      data: list.map((p) => ({ ...p, soldThisMonth: soldMap.get(p.id) ?? 0, usedThisMonth: usedMap.get(p.id) ?? 0 })),
      recent,
    });
  } catch (error) {
    console.error("Error stock:", error);
    return NextResponse.json({ success: false, error: "Error al carregar l'estoc" }, { status: 500 });
  }
}

// action: "create" · "update" · "delete" · "move" (venda / entrada / ajust)
export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json().catch(() => ({}));

    if (body.action === "create") {
      const name = clean(body.name);
      if (!name) return NextResponse.json({ success: false, error: "Cal posar el nom del producte" }, { status: 400 });
      const stock = wholeNumber(body.stock) ?? 0;
      const [created] = await db.insert(products).values({
        name,
        category: clean(body.category),
        line: body.line === "professional" ? "professional" : "venda",
        code: clean(body.code),
        price: body.line === "professional" ? "0.00" : money(body.price),
        cost: money(body.cost),
        stock,
        minStock: wholeNumber(body.minStock) ?? 2,
      }).returning();
      if (stock > 0) {
        await db.insert(stockMovements).values({ productId: created.id, quantity: stock, kind: "entrada", date: todayStr(), note: "Estoc inicial" });
      }
      return NextResponse.json({ success: true, data: created });
    }

    // Carrega el catàleg Aromsnatur (venda al públic, sense codi ni unitats). No repeteix els que ja hi són.
    if (body.action === "import-catalog") {
      const existing = await db.select({ name: products.name }).from(products).where(eq(products.isActive, true));
      const have = new Set(existing.map((p) => p.name.trim().toLowerCase()));
      const toAdd = AROMSNATUR_CATALOG
        .map((c) => ({ ...c, fullName: `${c.name} (${c.format})` }))
        .filter((c) => !have.has(c.fullName.toLowerCase()) && !have.has(c.name.toLowerCase()));
      if (toAdd.length > 0) {
        await db.insert(products).values(toAdd.map((c) => ({
          name: c.fullName,
          category: c.category,
          line: "venda",
          code: null,
          price: c.price,
          cost: "0.00",
          stock: 0,
          minStock: 0,
        })));
      }
      return NextResponse.json({ success: true, added: toAdd.length, skipped: AROMSNATUR_CATALOG.length - toAdd.length });
    }

    // Treure una venda feta per error des de la fitxa de la cita (torna les unitats a l'estoc)
    if (body.action === "undo-sale") {
      const moveId = Number(body.moveId);
      const [move] = await db.select().from(stockMovements).where(and(eq(stockMovements.id, moveId), eq(stockMovements.kind, "venda")));
      if (!move) return NextResponse.json({ success: false, error: "No trobo la venda" }, { status: 404 });
      await db.transaction(async (tx) => {
        await tx.update(products).set({ stock: sql`${products.stock} + ${-move.quantity}` }).where(eq(products.id, move.productId));
        await tx.delete(stockMovements).where(eq(stockMovements.id, move.id));
      });
      return NextResponse.json({ success: true });
    }

    // Canviar com es cobra una venda feta en una cita (targeta / efectiu)
    if (body.action === "set-cash") {
      const moveId = Number(body.moveId);
      if (!Number.isInteger(moveId)) return NextResponse.json({ success: false, error: "Falta la venda" }, { status: 400 });
      await db.update(stockMovements).set({ paidCash: body.paidCash === true }).where(and(eq(stockMovements.id, moveId), eq(stockMovements.kind, "venda")));
      return NextResponse.json({ success: true });
    }

    const id = Number(body.id ?? body.productId);
    if (!Number.isInteger(id)) return NextResponse.json({ success: false, error: "Falta el producte" }, { status: 400 });

    if (body.action === "update") {
      const name = clean(body.name);
      if (!name) return NextResponse.json({ success: false, error: "Cal posar el nom del producte" }, { status: 400 });
      const [updated] = await db.update(products).set({
        name,
        category: clean(body.category),
        line: body.line === "professional" ? "professional" : "venda",
        code: clean(body.code),
        price: body.line === "professional" ? "0.00" : money(body.price),
        cost: money(body.cost),
        minStock: wholeNumber(body.minStock) ?? 2,
      }).where(eq(products.id, id)).returning();
      return NextResponse.json({ success: true, data: updated });
    }

    if (body.action === "delete") {
      await db.update(products).set({ isActive: false }).where(eq(products.id, id));
      return NextResponse.json({ success: true });
    }

    if (body.action === "move") {
      const kind = body.kind;
      const qty = wholeNumber(body.quantity);
      if (!["venda", "us", "entrada", "ajust"].includes(kind) || qty === null) {
        return NextResponse.json({ success: false, error: "Quantitat no vàlida" }, { status: 400 });
      }
      const [product] = await db.select().from(products).where(eq(products.id, id));
      if (!product) return NextResponse.json({ success: false, error: "No trobo el producte" }, { status: 404 });

      // Venda / ús al centre: resta · Entrada: suma · Ajust: el recompte real que hi ha ara
      // (l'ús professional no compta com a venda: només com a despesa, a preu de compra)
      const delta = kind === "venda" || kind === "us" ? -qty : kind === "entrada" ? qty : qty - product.stock;
      if (kind !== "ajust" && qty === 0) {
        return NextResponse.json({ success: false, error: "Posa una quantitat" }, { status: 400 });
      }
      const appointmentId = Number.isInteger(Number(body.appointmentId)) && Number(body.appointmentId) > 0 ? Number(body.appointmentId) : null;

      // Venda feta a una clienta: si el producte és a la botiga es pot vendre encara que el recompte
      // digui que no n'hi ha (molts productes es van carregar sense unitats). L'estoc no baixa de 0.
      if (kind === "venda" && appointmentId) {
        const [updated] = await db.update(products)
          .set({ stock: sql`greatest(${products.stock} - ${qty}, 0)` })
          .where(eq(products.id, id))
          .returning();
        await db.insert(stockMovements).values({ productId: id, quantity: -qty, kind, date: todayStr(), note: clean(body.note), appointmentId, paidCash: body.paidCash === true });
        return NextResponse.json({ success: true, data: updated });
      }
      const [updated] = await db.update(products)
        .set({ stock: sql`${products.stock} + ${delta}` })
        .where(and(eq(products.id, id), sql`${products.stock} + ${delta} >= 0`))
        .returning();
      if (!updated) {
        return NextResponse.json({
          success: false,
          error: `Només en queden ${product.stock}. Si n'hi ha més, fes una entrada o corregeix el recompte.`,
        }, { status: 409 });
      }
      if (delta !== 0) {
        await db.insert(stockMovements).values({ productId: id, quantity: delta, kind, date: todayStr(), note: clean(body.note) });
      }
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: false, error: "Acció no vàlida" }, { status: 400 });
  } catch (error) {
    console.error("Error stock:", error);
    return NextResponse.json({ success: false, error: "Error amb l'estoc" }, { status: 500 });
  }
}
