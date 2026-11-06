import { pool } from "./index";

// Crea les taules noves si encara no existeixen, perquè no calgui executar
// "drizzle-kit push" a producció a mà. Només s'executa un cop per instància.
let ensured: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!ensured) {
    ensured = pool.query(`
      CREATE TABLE IF NOT EXISTS client_treatments (
        id serial PRIMARY KEY,
        client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        service_id integer NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        duration_minutes integer,
        professional_id integer REFERENCES professionals(id) ON DELETE SET NULL,
        notes text,
        created_at timestamp DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS client_treatments_client_service_idx
        ON client_treatments (client_id, service_id);

      CREATE TABLE IF NOT EXISTS gift_vouchers (
        id serial PRIMARY KEY,
        code text NOT NULL UNIQUE,
        kind text NOT NULL DEFAULT 'import',
        amount numeric(10,2) NOT NULL DEFAULT 0,
        remaining numeric(10,2) NOT NULL DEFAULT 0,
        service_id integer REFERENCES services(id) ON DELETE SET NULL,
        service_text text,
        buyer_name text NOT NULL,
        buyer_phone text,
        recipient_name text NOT NULL,
        recipient_phone text,
        issue_date text NOT NULL,
        expiry_date text,
        payment_method text,
        status text NOT NULL DEFAULT 'actiu',
        notes text,
        created_at timestamp DEFAULT now() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS gift_voucher_uses (
        id serial PRIMARY KEY,
        voucher_id integer NOT NULL REFERENCES gift_vouchers(id) ON DELETE CASCADE,
        date text NOT NULL,
        amount numeric(10,2) NOT NULL DEFAULT 0,
        note text,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `).then(() => undefined).catch(err => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}
