// Candado de la dueña: una clau a part (només la sap ella) que obre els apartats
// protegits (Resum, imports, anul·lar xecs). La clau es desa xifrada a la base de dades.
import { scrypt, randomBytes, timingSafeEqual, createHmac } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { pool } from "@/db";
import { ensureSchema } from "@/db/ensure-schema";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const OWNER_COOKIE = "diana_owner";
export const OWNER_UNLOCK_SECONDS = 60 * 60; // es torna a tancar sol al cap d'1 hora
const KEY = "owner_lock_hash";

async function hashPin(pin: string, salt = randomBytes(16)): Promise<string> {
  const hash = await scryptAsync(pin, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function getStoredHash(): Promise<string | null> {
  await ensureSchema();
  const r = await pool.query("SELECT value FROM app_settings WHERE key = $1", [KEY]);
  return r.rows[0]?.value ?? null;
}

export async function isLockConfigured(): Promise<boolean> {
  return (await getStoredHash()) !== null;
}

export async function checkPin(pin: string): Promise<boolean> {
  const stored = await getStoredHash();
  if (!stored || !pin) return false;
  const [saltHex, hashHex] = stored.split(":");
  const candidate = await scryptAsync(pin, Buffer.from(saltHex, "hex"), 32);
  const expected = Buffer.from(hashHex, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** Desa la clau. Si ja n'hi havia una, només es pot canviar sabent l'anterior. */
export async function setPin(pin: string, current?: string): Promise<boolean> {
  if ((await isLockConfigured()) && !(await checkPin(current ?? ""))) return false;
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [KEY, await hashPin(pin)]
  );
  return true;
}

function sign(payload: string): string {
  const secret = process.env.SESSION_SECRET || "diana-dev";
  return createHmac("sha256", secret).update(`owner:${payload}`).digest("base64url");
}

export function createOwnerToken(): string {
  const expires = String(Math.floor(Date.now() / 1000) + OWNER_UNLOCK_SECONDS);
  return `${expires}.${sign(expires)}`;
}

function verifyOwnerToken(token: string | undefined): boolean {
  if (!token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || Number(expires) < Date.now() / 1000) return false;
  const expected = sign(expires);
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

/** Per a les rutes: el candado està obert en aquesta sessió? */
export async function isOwnerUnlocked(): Promise<boolean> {
  const store = await cookies();
  return verifyOwnerToken(store.get(OWNER_COOKIE)?.value);
}
