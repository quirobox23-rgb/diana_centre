import { db } from "@/db";
import { sql } from "drizzle-orm";
import { seedDatabase } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    // Check if database needs seeding
    await seedDatabase().catch((e) => console.error("Seed check:", e));
    return Response.json({ ok: true, center: "Estètica Diana" });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
