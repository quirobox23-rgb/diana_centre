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
    `).then(() => undefined).catch(err => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}
