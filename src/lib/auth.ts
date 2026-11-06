// Sessió simple per al panell: una galeta signada amb HMAC-SHA256.
// Funciona tant al proxy com a les rutes (fa servir Web Crypto).

export const SESSION_COOKIE = "diana_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dies

const encoder = new TextEncoder();

function getSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  let bin = "";
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type Role = "admin" | "staff";

// La galeta porta la caducitat i el rol, signats: "caducitat.rol.firma"
export async function createSessionToken(role: Role = "admin"): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error("Falta SESSION_SECRET (mínim 16 caràcters)");
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = `${expires}.${role}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

/** Retorna el rol de la sessió, o null si la galeta no és vàlida. */
export async function getSessionRole(token: string | undefined): Promise<Role | null> {
  const secret = getSecret();
  if (!secret || !token) return null;
  const parts = token.split(".");
  // Galetes antigues (abans dels rols): "caducitat.firma" → eren de la dueña
  const [expiresStr, role, sig] =
    parts.length === 2 ? [parts[0], "admin", parts[1]] : parts.length === 3 ? parts : [];
  if (!expiresStr || !sig || (role !== "admin" && role !== "staff")) return null;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < Date.now() / 1000) return null;
  const payload = parts.length === 2 ? expiresStr : `${expiresStr}.${role}`;
  return safeEqual(sig, await hmac(secret, payload)) ? (role as Role) : null;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  return (await getSessionRole(token)) !== null;
}

async function matches(input: string, expected: string | undefined): Promise<boolean> {
  if (!expected) return false;
  // Comparem els hash per no filtrar la longitud ni fer comparacions amb temps variable
  const secret = getSecret() ?? "diana";
  return safeEqual(await hmac(secret, input), await hmac(secret, expected));
}

/** Contrasenya de la dueña (ADMIN_PASSWORD) o de l'equip (STAFF_PASSWORD). */
export async function roleForPassword(input: string): Promise<Role | null> {
  if (await matches(input, process.env.ADMIN_PASSWORD)) return "admin";
  if (await matches(input, process.env.STAFF_PASSWORD)) return "staff";
  return null;
}

export async function checkPassword(input: string): Promise<boolean> {
  return (await roleForPassword(input)) !== null;
}
