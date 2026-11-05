import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

// La llibreria pg ja tracta sslmode=require com a verify-full; ho escrivim explícitament
// per evitar l'avís "SECURITY WARNING" als logs de Vercel i mantenir la seguretat a pg v9.
const databaseUrl = process.env.DATABASE_URL.replace(/sslmode=(require|prefer|verify-ca)\b/, "sslmode=verify-full");

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
