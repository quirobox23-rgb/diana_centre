import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, clients, giftVouchers, services } from "@/db/schema";
import { and, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { addDays, todayStr } from "@/lib/dates";
import { ensureSchema } from "@/db/ensure-schema";

const daysBetween = (a: string, b: string) =>
  Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);

// Avisos per tenir cura de les clientes:
// - les que fa temps que no venen (més del que és habitual en elles),
// - les que fan anys aquesta setmana,
// - els xecs regal que caduquen aviat i encara tenen saldo.
export async function GET() {
  try {
    await ensureSchema();
    const today = todayStr();
    const since = addDays(today, -730);

    // Visites passades (fetes o confirmades) dels últims dos anys
    const visits = await db
      .select({
        clientId: appointments.clientId,
        date: appointments.date,
        serviceName: services.name,
      })
      .from(appointments)
      .leftJoin(services, eq(services.id, appointments.serviceId))
      .where(and(isNotNull(appointments.clientId), gte(appointments.date, since), inArray(appointments.status, ["confirmada", "completada"])));

    const byClient = new Map<number, { dates: Set<string>; future: boolean; services: Map<string, number> }>();
    for (const v of visits) {
      const id = v.clientId!;
      const e = byClient.get(id) ?? { dates: new Set<string>(), future: false, services: new Map<string, number>() };
      if (v.date > today) e.future = true;
      else {
        e.dates.add(v.date);
        if (v.serviceName) e.services.set(v.serviceName, (e.services.get(v.serviceName) ?? 0) + 1);
      }
      byClient.set(id, e);
    }

    const lapsedRaw: { clientId: number; lastVisit: string; daysSince: number; usualGap: number | null; visits: number; usualService: string | null }[] = [];
    for (const [clientId, e] of byClient) {
      if (e.future || e.dates.size === 0) continue; // ja té una cita reservada
      const dates = [...e.dates].sort();
      const last = dates[dates.length - 1];
      const daysSince = daysBetween(last, today);
      let usualGap: number | null = null;
      if (dates.length >= 2) {
        const gaps = dates.slice(1).map((d, i) => daysBetween(dates[i], d));
        usualGap = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
      }
      const overdue = usualGap ? daysSince > Math.max(21, usualGap * 1.5) : daysSince > 75;
      if (!overdue) continue;
      const usualService = [...e.services.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      lapsedRaw.push({ clientId, lastVisit: last, daysSince, usualGap, visits: dates.length, usualService });
    }
    // Primer les que venien més sovint i fa més temps que no venen
    lapsedRaw.sort((a, b) => b.visits - a.visits || b.daysSince - a.daysSince);
    const lapsedTop = lapsedRaw.slice(0, 60);

    const ids = lapsedTop.map((l) => l.clientId);
    const clientRows = ids.length
      ? await db.select({ id: clients.id, name: clients.name, phone: clients.phone }).from(clients).where(and(inArray(clients.id, ids), eq(clients.isActive, true)))
      : [];
    const cMap = new Map(clientRows.map((c) => [c.id, c]));
    const lapsed = lapsedTop.filter((l) => cMap.has(l.clientId)).map((l) => ({ ...l, name: cMap.get(l.clientId)!.name, phone: cMap.get(l.clientId)!.phone }));

    // Aniversaris dels propers 7 dies (data guardada com AAAA-MM-DD)
    const nextDays = Array.from({ length: 7 }, (_, i) => addDays(today, i).slice(5));
    const withBirthday = await db
      .select({ id: clients.id, name: clients.name, phone: clients.phone, birthday: clients.birthday })
      .from(clients)
      .where(and(eq(clients.isActive, true), isNotNull(clients.birthday)));
    const birthdays = withBirthday
      .filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.birthday || "") && nextDays.includes(c.birthday!.slice(5)))
      .map((c) => ({ ...c, inDays: nextDays.indexOf(c.birthday!.slice(5)) }))
      .sort((a, b) => a.inDays - b.inDays);

    // Xecs regal actius que caduquen en els propers 30 dies
    const vouchers = await db
      .select({
        id: giftVouchers.id,
        code: giftVouchers.code,
        recipientName: giftVouchers.recipientName,
        recipientPhone: giftVouchers.recipientPhone,
        expiryDate: giftVouchers.expiryDate,
        remaining: giftVouchers.remaining,
        kind: giftVouchers.kind,
        serviceText: giftVouchers.serviceText,
      })
      .from(giftVouchers)
      .where(and(eq(giftVouchers.status, "actiu"), isNotNull(giftVouchers.expiryDate), gte(giftVouchers.expiryDate, today), lte(giftVouchers.expiryDate, addDays(today, 30))))
      .orderBy(giftVouchers.expiryDate);

    return NextResponse.json({ success: true, lapsed, lapsedTotal: lapsedRaw.length, birthdays, vouchers });
  } catch (error) {
    console.error("Error avisos:", error);
    return NextResponse.json({ success: false, error: "Error al carregar els avisos" }, { status: 500 });
  }
}
