// Llegeix un llistat de clientes (Excel o CSV) i el converteix en files netes.
// Es fa servir al navegador; el servidor torna a validar-ho tot.

export interface ImportRow {
  name: string;
  phone: string;
  email: string | null;
  birthday: string | null;
  notes: string | null;
  allergies: string | null;
}

type Field = "name" | "surname" | "phone" | "phone2" | "email" | "birthday" | "notes" | "allergies";

export const FIELD_LABELS: Record<Field, string> = {
  name: "Nom",
  surname: "Cognoms",
  phone: "Telèfon",
  phone2: "Telèfon 2",
  email: "Email",
  birthday: "Aniversari",
  notes: "Notes",
  allergies: "Al·lèrgies",
};

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

// Paraules que indiquen cada columna (castellà, català i anglès)
const HEADER_WORDS: [Field, RegExp][] = [
  ["surname", /^(cognom|cognoms|apellido|apellidos|surname|last name)\b/],
  ["phone2", /\b(telefono|telefon|tel|movil|mobil|phone)\s*2\b|\bfijo\b|\bfix\b/],
  ["phone", /\b(telefono|telefon|tel|tlf|telf|movil|mobil|celular|whatsapp|phone|mobile)\b/],
  ["email", /\b(email|e mail|correo|correu|mail)\b/],
  ["birthday", /\b(aniversari|cumpleanos|nacimiento|naixement|birthday|fecha nac|data naix)\b/],
  ["allergies", /\b(alergia|alergias|alergies|allergies|allergy)\b/],
  ["notes", /\b(notes|notas|nota|observaciones|observacions|comentarios|comentaris|comments)\b/],
  ["name", /\b(nom|nombre|name|clienta|cliente|client|nom complet|nombre completo)\b/],
];

export function detectColumns(header: string[]): Partial<Record<Field, number>> {
  const map: Partial<Record<Field, number>> = {};
  header.forEach((h, i) => {
    const n = norm(String(h ?? ""));
    if (!n) return;
    for (const [field, re] of HEADER_WORDS) {
      if (re.test(n) && map[field] === undefined) {
        map[field] = i;
        break;
      }
    }
  });
  return map;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/** Accepta 31/12/1990, 31-12-90, 1990-12-31 o una data d'Excel. Si no s'entén, null. */
export function toIsoDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = cellText(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/);
  if (m) {
    let y = m[3] ? +m[3] : 2000; // sense any: només dia i mes
    if (m[3] && m[3].length === 2) y += y > 30 ? 1900 : 2000;
    return valid(y, +m[2], +m[1]);
  }
  return null;
}

function valid(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Neteja un telèfon: deixa + i xifres. 600 11 22 33 → 600112233 */
export function cleanPhone(v: unknown): string {
  const s = cellText(v).replace(/\.0$/, "");
  const plus = s.trim().startsWith("+");
  const digits = s.replace(/\D/g, "");
  return digits ? (plus ? `+${digits}` : digits) : "";
}

export function rowsFromSheet(data: unknown[][]): { rows: ImportRow[]; columns: Partial<Record<Field, number>>; skipped: number } {
  // La capçalera és la primera fila amb alguna paraula reconeguda (a vegades hi ha un títol a dalt)
  let headerIdx = 0;
  let columns: Partial<Record<Field, number>> = {};
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const c = detectColumns((data[i] || []).map(cellText));
    if (c.name !== undefined || c.phone !== undefined) {
      headerIdx = i;
      columns = c;
      break;
    }
  }
  // Sense capçalera reconeguda: suposem "nom, telèfon"
  if (columns.name === undefined && columns.phone === undefined) {
    columns = { name: 0, phone: 1 };
    headerIdx = -1;
  }

  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const raw of data.slice(headerIdx + 1)) {
    const get = (f: Field) => (columns[f] !== undefined ? raw?.[columns[f]!] : undefined);
    const name = [cellText(get("name")), cellText(get("surname"))].filter(Boolean).join(" ").replace(/\s+/g, " ");
    const phone = cleanPhone(get("phone")) || cleanPhone(get("phone2"));
    if (!name && !phone) continue; // fila buida
    if (!name) {
      skipped++;
      continue;
    }
    const email = cellText(get("email"));
    rows.push({
      name,
      phone,
      email: /\S+@\S+\.\S+/.test(email) ? email.toLowerCase() : null,
      birthday: toIsoDate(get("birthday")),
      notes: cellText(get("notes")) || null,
      allergies: cellText(get("allergies")) || null,
    });
  }
  return { rows, columns, skipped };
}
