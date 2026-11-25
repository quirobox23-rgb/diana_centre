import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    // Abans aquí es carregaven dades d'exemple si la base de dades era buida: ja no
    // (una visita a aquesta adreça podia omplir l'app de clientes falses).
    return Response.json({ ok: true, center: "Estètica Diana" });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
