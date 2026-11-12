// Seccions del catàleg (en l'ordre de la carta del centre) i la carta mateixa,
// amb les durades que va apuntar la dueña. Els preus es posen després des de Serveis.

export interface ServiceSection {
  id: string; // valor desat a services.category
  label: string;
}

export const SERVICE_SECTIONS: ServiceSection[] = [
  { id: "Ulls", label: "Ulls · pestanyes i celles" },
  { id: "Facial", label: "Tractaments facials" },
  { id: "Depilació", label: "Depilacions" },
  { id: "Corporal", label: "Tractaments corporals" },
  { id: "Mans i Peus", label: "Manicura i pedicura" },
  { id: "Altres", label: "Altres serveis" },
];

// Categories antigues que encara poden quedar a la base de dades
const LEGACY: Record<string, string> = { mirada: "Ulls", benestar: "Corporal" };

/** Secció on va un servei (accepta les categories antigues). */
export function sectionOf(category: string | null | undefined): string {
  const c = (category || "").trim();
  const found = SERVICE_SECTIONS.find(s => s.id.toLowerCase() === c.toLowerCase());
  return found ? found.id : LEGACY[c.toLowerCase()] ?? "Altres";
}

export function sectionLabel(id: string): string {
  return SERVICE_SECTIONS.find(s => s.id === id)?.label ?? id;
}

// Dins de cada secció, primer en l'ordre de la carta i després la resta per ordre alfabètic
function catalogRank(name: string): number {
  const i = CENTRE_CATALOG.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
  return i === -1 ? 9999 : i;
}

/** Agrupa una llista de serveis per secció, en l'ordre de la carta. */
export function groupBySection<T extends { category: string; name: string }>(items: T[]): { section: ServiceSection; items: T[] }[] {
  return SERVICE_SECTIONS.map(section => ({
    section,
    items: items
      .filter(i => sectionOf(i.category) === section.id)
      .sort((a, b) => catalogRank(a.name) - catalogRank(b.name) || a.name.localeCompare(b.name, "ca")),
  })).filter(g => g.items.length > 0);
}

export interface CatalogItem {
  name: string;
  category: string;
  durationMinutes: number;
  /** true quan la carta no deia la durada i n'hem posat una per defecte */
  durationToConfirm?: boolean;
  description?: string;
}

const item = (category: string, name: string, durationMinutes: number, extra: Partial<CatalogItem> = {}): CatalogItem => ({
  name,
  category,
  durationMinutes,
  ...extra,
});

export const CENTRE_CATALOG: CatalogItem[] = [
  // ULLS
  item("Ulls", "Extensió de pestanyes", 120),
  item("Ulls", "Manteniment extensió de pestanyes", 60),
  item("Ulls", "Lifting de pestanyes", 60),
  item("Ulls", "Permanent de pestanyes", 60),
  item("Ulls", "Tint de pestanyes", 15),
  item("Ulls", "Tint de celles", 15),
  item("Ulls", "Allisament de celles", 30, { durationToConfirm: true }),
  item("Ulls", "Tractament de contorn d'ulls", 60, { description: "Ulleres, bosses i arrugues" }),

  // FACIALS
  item("Facial", "Rituals facials", 60),
  item("Facial", "Neteja de cutis aromateràpia", 90),
  item("Facial", "Radiofreqüència facial", 60),
  item("Facial", "Tractaments facials personalitzats", 60),
  item("Facial", "Golden Argània", 60, { durationToConfirm: true, description: "Puntes de quars i pindes: volum, densitat, hidratant, nutritiu" }),
  item("Facial", "Golden Citrus", 60, { durationToConfirm: true, description: "Puntes de quars i pindes: reparador, revitalitzant, il·luminador" }),
  item("Facial", "Golden Thalasso", 60, { durationToConfirm: true, description: "Puntes de quars i pindes: lifting facial masculí i femení" }),

  // DEPILACIONS (cera calenta o tèbia)
  item("Depilació", "Depilació llavi", 5),
  item("Depilació", "Depilació celles", 10),
  item("Depilació", "Depilació aixelles", 10),
  item("Depilació", "Depilació engonals", 10),
  item("Depilació", "Depilació braços", 10),
  item("Depilació", "Depilació mitja cama", 15),
  item("Depilació", "Depilació cama sencera", 20),
  item("Depilació", "Cama sencera + aixelles", 30),
  item("Depilació", "Cama sencera + aixelles + celles + llavi", 40),
  item("Depilació", "Depilació làser mèdica", 30, { durationToConfirm: true }),
  item("Depilació", "Depilació elèctrica", 30, { durationToConfirm: true }),

  // CORPORALS
  item("Corporal", "Massatge relaxant aromateràpia 30 min", 30),
  item("Corporal", "Massatge relaxant aromateràpia 1 h", 60),
  item("Corporal", "Pindes de te verd", 75, { description: "Desbloqueig del sistema limfàtic" }),
  item("Corporal", "Radiofreqüència corporal", 60),
  item("Corporal", "Delux Body Sculpt", 60, { description: "Anticel·lulític, reductor" }),
  item("Corporal", "Ritual Geisha", 60, { description: "Exfoliant, suavitza la pell i relaxa la ment" }),
  item("Corporal", "Ritual equilibri interior", 60, { description: "Benestar, equilibri emocional" }),
  item("Corporal", "Rituals corporals", 60),

  // MANICURA I PEDICURA
  item("Mans i Peus", "Manicura completa", 40),
  item("Mans i Peus", "Pedicura", 30),
  item("Mans i Peus", "Pedicura completa", 40, { description: "Ungles clavades, ulls de poll, durícies..." }),
  item("Mans i Peus", "Esmaltat CND Vinylux", 10),
  item("Mans i Peus", "Esmaltat semipermanent CND Shellac", 20),
  item("Mans i Peus", "Ungles Acrylic Gel amb semipermanent", 60, { durationToConfirm: true, description: "Allargament i reconstrucció" }),
  item("Mans i Peus", "Construcció ungla Acrylic Gel", 30, { durationToConfirm: true }),

  // ALTRES
  item("Altres", "Maquillatge (diari, festa, núvia)", 30),
  item("Altres", "Pressoteràpia", 40),
  item("Altres", "Micropigmentació", 60, { durationToConfirm: true }),
  item("Altres", "Curs d'automaquillatge", 60, { durationToConfirm: true }),
  item("Altres", "Solàrium", 15, { durationToConfirm: true }),
  item("Altres", "Assessorament estètic", 30, { durationToConfirm: true }),
  item("Altres", "Assessorament dietètic", 30, { durationToConfirm: true }),
  item("Altres", "Control dietètic", 30, { durationToConfirm: true }),
];
