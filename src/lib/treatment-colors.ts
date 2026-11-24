// Colors per tipus de tractament: els mateixos que les noies fan servir a Google Calendar
// (marquen cada cita amb un color en lloc del nom del tractament). Hex exactes de Google.

export interface GoogleColor {
  id: string;
  /** nom com surt a Google Calendar en català */
  label: string;
  hex: string;
}

// Paleta completa de 24 colors de Google Calendar
export const GOOGLE_COLORS: GoogleColor[] = [
  { id: "radicchio", label: "Radicchio", hex: "#AD1457" },
  { id: "cherry", label: "Flor de cirerer", hex: "#D81B60" },
  { id: "flamingo", label: "Flamenc", hex: "#E67C73" },
  { id: "tomato", label: "Tomàquet", hex: "#D50000" },
  { id: "tangerine", label: "Mandarina", hex: "#F4511E" },
  { id: "pumpkin", label: "Carabassa", hex: "#EF6C00" },
  { id: "mango", label: "Mango", hex: "#F09300" },
  { id: "banana", label: "Plàtan", hex: "#F6BF26" },
  { id: "citron", label: "Llimona", hex: "#E4C441" },
  { id: "avocado", label: "Advocat", hex: "#C0CA33" },
  { id: "pistachio", label: "Pistatxo", hex: "#7CB342" },
  { id: "basil", label: "Alfàbrega", hex: "#0B8043" },
  { id: "sage", label: "Sàlvia", hex: "#33B679" },
  { id: "eucalyptus", label: "Eucaliptus", hex: "#009688" },
  { id: "peacock", label: "Paó", hex: "#039BE5" },
  { id: "cobalt", label: "Cobalt", hex: "#4285F4" },
  { id: "lavender", label: "Lavanda", hex: "#7986CB" },
  { id: "blueberry", label: "Nabiu", hex: "#3F51B5" },
  { id: "wisteria", label: "Malva", hex: "#B39DDB" },
  { id: "amethyst", label: "Ametista", hex: "#9E69AF" },
  { id: "grape", label: "Raïm negre", hex: "#8E24AA" },
  { id: "cocoa", label: "Cacau", hex: "#795548" },
  { id: "graphite", label: "Grafit", hex: "#616161" },
  { id: "birch", label: "Bedoll", hex: "#A79B8E" },
];

const g = (id: string) => GOOGLE_COLORS.find(c => c.id === id)!.hex;

export interface TreatmentType {
  id: string;
  label: string;
  /** nom del color a Google Calendar */
  colorName: string;
  color: string;
}

// Els 12 tipus que fan servir al centre, amb el seu color
export const TREATMENT_TYPES: TreatmentType[] = [
  { id: "facial", label: "Facial", colorName: "Flamenc", color: g("flamingo") },
  { id: "corporal", label: "Corporal", colorName: "Cobalt", color: g("cobalt") },
  { id: "depilacio", label: "Depilació", colorName: "Tomàquet", color: g("tomato") },
  { id: "mans-peus", label: "Manicura i pedicura", colorName: "Raïm negre", color: g("grape") },
  { id: "solarium", label: "Solàrium", colorName: "Llimona", color: g("citron") },
  { id: "fotodepilacio", label: "Fotodepilació", colorName: "Alfàbrega", color: g("basil") },
  { id: "pressoterapia", label: "Pressoteràpia", colorName: "Mandarina", color: g("tangerine") },
  { id: "maquillatge", label: "Maquillatge", colorName: "Nabiu", color: g("blueberry") },
  { id: "pestanyes", label: "Pestanyes", colorName: "Eucaliptus", color: g("eucalyptus") },
  { id: "extensions", label: "Extensions de pestanyes", colorName: "Malva", color: g("wisteria") },
  { id: "nutricosmetica", label: "Control nutricosmètica", colorName: "Pistatxo", color: g("pistachio") },
  { id: "micropigmentacio", label: "Micropigmentació", colorName: "Advocat", color: g("avocado") },
];

const norm = (s: string | null | undefined) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** Tipus de tractament d'un servei, segons el nom i la secció de la carta. */
export function treatmentTypeOf(name: string, category?: string | null): TreatmentType {
  const n = norm(name);
  const c = norm(category);
  const t = (id: string) => TREATMENT_TYPES.find(x => x.id === id)!;

  if (/extensi/.test(n) && /pestany/.test(n)) return t("extensions");
  if (/micropigment/.test(n)) return t("micropigmentacio");
  if (/fotodepil|laser|\bipl\b/.test(n)) return t("fotodepilacio");
  if (/depila|\bcera\b/.test(n) || c === "depilacio") return t("depilacio");
  if (/solarium|\buva\b/.test(n)) return t("solarium");
  if (/pres+oter/.test(n)) return t("pressoterapia");
  if (/maquilla/.test(n)) return t("maquillatge");
  if (/dietet|nutri/.test(n)) return t("nutricosmetica");
  if (/pestany|celles/.test(n)) return t("pestanyes");
  if (/manicur|pedicur|ungl|esmalt/.test(n) || c === "mans i peus") return t("mans-peus");
  if (/massatge|corporal|body|geisha|equilibri|pindes/.test(n) || c === "corporal") return t("corporal");
  return t("facial");
}

/** Color que toca a un servei segons el seu tipus. */
export function colorForService(name: string, category?: string | null): string {
  return treatmentTypeOf(name, category).color;
}

/** Text blanc o fosc perquè es llegeixi bé sobre el color de fons. */
export function textColorOn(hex: string | null | undefined): string {
  const h = (hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(h)) return "#ffffff";
  const [r, gg, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
  return lum > 0.36 ? "#1c1917" : "#ffffff";
}

/** Nom del color de Google (si n'és un), per mostrar-lo. */
export function googleColorName(hex: string | null | undefined): string | null {
  const h = (hex || "").toUpperCase();
  return GOOGLE_COLORS.find(c => c.hex === h)?.label ?? null;
}

// Colors que posava l'app abans (paleta terra i sorra i colors antics). Els serveis que encara
// tenen un d'aquests colors no els ha triat ningú a mà, i es poden passar als colors nous.
export const OLD_DEFAULT_COLORS = [
  "#c06a44", "#a85436", "#71392b", "#b98a5a", "#d6bd99", "#866353", "#4d3b35", "#72845b", "#aebb9c", "#c5a074",
  "#b0805a", "#7c8c6b", "#8a7f74", "#8e6042", "#596846", "#cf825f", "#8f9f78",
  "#ec4899", "#8b5cf6", "#0ea5e9", "#db2777", "#7c3aed", "#0284c7", "#f43f5e", "#10b981", "#d97706", "#06b6d4", "#6366f1",
];

// Qui fa cada tipus de tractament (ho va dir el centre el 24/11/2026). L'ordre compta:
// la primera és la que es proposa abans (Diana prefereix fer la mínima depilació possible).
export type ProKey = "diana" | "montsant";

/** Professionals per defecte d'un servei; null = no ho sabem (el pot fer qualsevol). */
export function defaultProsFor(name: string, category?: string | null): ProKey[] | null {
  const n = norm(name);
  const type = treatmentTypeOf(name, category).id;
  switch (type) {
    case "facial":
      return ["diana"];
    case "corporal":
      return /radiofrequencia/.test(n) ? ["montsant", "diana"] : ["montsant"];
    case "depilacio":
      return ["montsant", "diana"];
    case "fotodepilacio":
      return ["diana", "montsant"];
    case "mans-peus":
      return /pedicur/.test(n) ? ["diana", "montsant"] : ["montsant"];
    case "maquillatge":
      return ["diana", "montsant"];
    case "pestanyes":
      return /celles/.test(n) ? ["montsant"] : ["diana", "montsant"];
    case "extensions":
      return ["montsant"];
    case "nutricosmetica":
      return ["diana", "montsant"];
    default:
      return null; // solàrium, pressoteràpia, micropigmentació: no ho van dir
  }
}

/** Reconeix la professional pel nom ("Diana ...", "Montsant ..."). */
export function proKeyOf(name: string): ProKey | null {
  const n = norm(name);
  if (/^diana\b/.test(n)) return "diana";
  if (/^montsan/.test(n)) return "montsant";
  return null;
}
