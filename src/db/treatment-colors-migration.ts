import { pool } from "./index";
import { colorForService, OLD_DEFAULT_COLORS, defaultProsFor, proKeyOf, treatmentTypeOf, type ProKey } from "@/lib/treatment-colors";

const DONE_KEY = "treatment_colors_google_v1";

/**
 * Posa a cada servei el color del seu tipus de tractament (colors de Google Calendar).
 * - all = false: només els serveis que encara tenen un color antic per defecte (es fa un sol cop, en arrencar).
 * - all = true: tots els serveis (botó "Aplicar els colors per tipus" de Serveis).
 */
export async function applyTreatmentColors(all: boolean): Promise<number> {
  const { rows } = await pool.query<{ id: number; name: string; category: string; color: string }>(
    "SELECT id, name, category, color FROM services"
  );
  const old = new Set(OLD_DEFAULT_COLORS.map(c => c.toLowerCase()));
  let changed = 0;
  for (const s of rows) {
    if (!all && !old.has((s.color || "").toLowerCase())) continue;
    const color = colorForService(s.name, s.category);
    if ((s.color || "").toLowerCase() === color.toLowerCase()) continue;
    await pool.query("UPDATE services SET color = $1 WHERE id = $2", [color, s.id]);
    changed++;
  }
  return changed;
}

/** Es fa una sola vegada: passa els colors antics als colors de Google Calendar. */
export async function applyTreatmentColorsOnce(): Promise<void> {
  const done = await pool.query("SELECT 1 FROM app_settings WHERE key = $1", [DONE_KEY]);
  if (done.rowCount) return;
  const changed = await applyTreatmentColors(false);
  await pool.query(
    "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
    [DONE_KEY, new Date().toISOString()]
  );
  if (changed) console.log(`[colors] ${changed} serveis amb els colors de Google Calendar`);
}

const PROS_DONE_KEY = "treatment_pros_v1";

/**
 * Posa qui fa cada tractament (Diana / Montsant) als serveis que encara no en tenen cap de marcada.
 * Si no es passen ids, ho fa a tots els serveis sense professionals. Retorna quants n'ha canviat,
 * o -1 si encara no hi ha la Diana i la Montsant a Professionals.
 */
export async function assignDefaultProfessionals(serviceIds?: number[]): Promise<number> {
  const pros = await pool.query<{ id: number; name: string }>(
    "SELECT id, name FROM professionals WHERE is_active = true ORDER BY id"
  );
  const ids: Partial<Record<ProKey, number>> = {};
  for (const p of pros.rows) {
    const k = proKeyOf(p.name);
    if (k && ids[k] === undefined) ids[k] = p.id;
  }
  if (ids.diana === undefined || ids.montsant === undefined) return -1;

  const { rows } = await pool.query<{ id: number; name: string; category: string }>(
    serviceIds
      ? "SELECT id, name, category FROM services WHERE (professional_ids IS NULL OR cardinality(professional_ids) = 0) AND id = ANY($1)"
      : "SELECT id, name, category FROM services WHERE professional_ids IS NULL OR cardinality(professional_ids) = 0",
    serviceIds ? [serviceIds] : []
  );
  let changed = 0;
  for (const s of rows) {
    const keys = defaultProsFor(s.name, s.category);
    if (!keys) continue;
    await pool.query("UPDATE services SET professional_ids = $1 WHERE id = $2", [keys.map(k => ids[k]!), s.id]);
    changed++;
  }
  return changed;
}

/** Un sol cop: quan ja hi són la Diana i la Montsant, marca qui fa cada tractament. */
export async function assignDefaultProfessionalsOnce(): Promise<void> {
  const done = await pool.query("SELECT 1 FROM app_settings WHERE key = $1", [PROS_DONE_KEY]);
  if (done.rowCount) return;
  const changed = await assignDefaultProfessionals();
  if (changed < 0) return; // encara no hi són: ho tornarem a provar
  await assignDefaultRooms().catch(err => console.error("[sales]", err));
  await pool.query(
    "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
    [PROS_DONE_KEY, new Date().toISOString()]
  );
  if (changed) console.log(`[pros] ${changed} serveis amb qui els fa`);
}

/** Troba la sala número n ("Sala 1", "Cabina 2 - ..."); si els noms no porten número, per ordre. */
async function roomNumbered(): Promise<Partial<Record<1 | 2 | 3, number>>> {
  const { rows } = await pool.query<{ id: number; name: string }>(
    "SELECT id, name FROM rooms WHERE is_active = true ORDER BY id"
  );
  const out: Partial<Record<1 | 2 | 3, number>> = {};
  for (const n of [1, 2, 3] as const) {
    const r = rows.find(x => new RegExp(`(^|\\D)${n}(\\D|$)`).test(x.name));
    if (r) out[n] = r.id;
  }
  if (Object.keys(out).length === 0 && rows.length === 3) {
    out[1] = rows[0].id; out[2] = rows[1].id; out[3] = rows[2].id;
  }
  return out;
}

/**
 * Sales (ho va dir el centre el 24/11/2026): cabina 1 = corporal i depilació, cabina 2 = facial i làser,
 * cabina 3 = manicura i pressoteràpia. La Diana treballa sobretot a la 2.
 */
export async function assignDefaultRooms(serviceIds?: number[]): Promise<void> {
  const room = await roomNumbered();
  if (room[2]) {
    const pros = await pool.query<{ id: number; name: string }>(
      "SELECT id, name FROM professionals WHERE default_room_id IS NULL"
    );
    for (const p of pros.rows) {
      if (proKeyOf(p.name) === "diana") {
        await pool.query("UPDATE professionals SET default_room_id = $1 WHERE id = $2", [room[2], p.id]);
      }
    }
  }
  const byType: Record<string, number | undefined> = {
    corporal: room[1],
    depilacio: room[1],
    facial: room[2],
    fotodepilacio: room[2],
    "mans-peus": room[3],
    pressoterapia: room[3],
  };
  const { rows } = await pool.query<{ id: number; name: string; category: string }>("SELECT id, name, category FROM services");
  for (const s of rows) {
    if (serviceIds && !serviceIds.includes(s.id)) continue;
    const r = byType[treatmentTypeOf(s.name, s.category).id];
    if (r) await pool.query("UPDATE services SET default_room_id = $1 WHERE id = $2", [r, s.id]);
  }
}

const ROOMS_DONE_KEY = "rooms_layout_v2";
export const ROOM_NAMES: Record<1 | 2 | 3, string> = {
  1: "Cabina 1 · Corporal i depilació",
  2: "Cabina 2 · Facial i làser",
  3: "Cabina 3 · Manicura i pressoteràpia",
};

/** Un sol cop: posa els noms nous a les cabines i torna a repartir els tractaments per cabina. */
export async function applyRoomLayoutOnce(): Promise<void> {
  const done = await pool.query("SELECT 1 FROM app_settings WHERE key = $1", [ROOMS_DONE_KEY]);
  if (done.rowCount) return;
  const room = await roomNumbered();
  if (!room[1] || !room[2] || !room[3]) return; // no trobem les 3 cabines: no toquem res
  for (const n of [1, 2, 3] as const) {
    await pool.query("UPDATE rooms SET name = $1 WHERE id = $2", [ROOM_NAMES[n], room[n]]);
  }
  await assignDefaultRooms();
  await pool.query(
    "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
    [ROOMS_DONE_KEY, new Date().toISOString()]
  );
  console.log("[sales] noms i repartiment de cabines actualitzats");
}
