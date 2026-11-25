import { pool } from "./index";
import { applyTreatmentColorsOnce, assignDefaultProfessionalsOnce, applyRoomLayoutOnce, addNutricosmeticaOnce } from "./treatment-colors-migration";

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

      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS paid_cash boolean NOT NULL DEFAULT false;

      CREATE TABLE IF NOT EXISTS app_settings (
        key text PRIMARY KEY,
        value text NOT NULL
      );

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

      ALTER TABLE professionals ADD COLUMN IF NOT EXISTS default_room_id integer;
      ALTER TABLE services ADD COLUMN IF NOT EXISTS professional_ids integer[];

      CREATE TABLE IF NOT EXISTS products (
        id serial PRIMARY KEY,
        name text NOT NULL,
        category text,
        price numeric(10,2) NOT NULL DEFAULT 0,
        stock integer NOT NULL DEFAULT 0,
        min_stock integer NOT NULL DEFAULT 2,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT now() NOT NULL
      );
      ALTER TABLE products ADD COLUMN IF NOT EXISTS line text NOT NULL DEFAULT 'venda';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS code text;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS cost numeric(10,2) NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS stock_movements (
        id serial PRIMARY KEY,
        product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity integer NOT NULL,
        kind text NOT NULL,
        date text NOT NULL,
        note text,
        created_at timestamp DEFAULT now() NOT NULL
      );

      ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS appointment_id integer;
      CREATE INDEX IF NOT EXISTS stock_movements_appointment_idx ON stock_movements (appointment_id);

      CREATE TABLE IF NOT EXISTS appointment_extras (
        id serial PRIMARY KEY,
        appointment_id integer NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        kind text NOT NULL DEFAULT 'altre',
        service_id integer REFERENCES services(id) ON DELETE SET NULL,
        description text NOT NULL,
        quantity integer NOT NULL DEFAULT 1,
        unit_price numeric(10,2) NOT NULL DEFAULT 0,
        created_at timestamp DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS appointment_extras_apt_idx ON appointment_extras (appointment_id);
      ALTER TABLE appointment_extras ADD COLUMN IF NOT EXISTS paid_cash boolean NOT NULL DEFAULT false;
      ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS paid_cash boolean NOT NULL DEFAULT false;

      -- Índexs perquè el calendari i les fitxes vagin ràpids amb milers de cites i clientes
      CREATE INDEX IF NOT EXISTS appointments_date_idx ON appointments (date);
      CREATE INDEX IF NOT EXISTS appointments_client_idx ON appointments (client_id);
    `).then(async () => {
      // Dades per defecte d'un sol cop; si fallen, l'app ha de seguir funcionant
      await applyTreatmentColorsOnce().catch(err => console.error("[colors]", err));
      await assignDefaultProfessionalsOnce().catch(err => console.error("[pros]", err));
      await applyRoomLayoutOnce().catch(err => console.error("[sales]", err));
      await addNutricosmeticaOnce().catch(err => console.error("[nutri]", err));
    }).catch(err => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}
