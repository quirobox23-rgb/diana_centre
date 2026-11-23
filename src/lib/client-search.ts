// Cerca ràpida de clientes: pel nom, pel telèfon o per les inicials.
// Ex.: "mg" troba "Maria Garcia"; "ma ga" també; "654" troba pel telèfon.

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const words = (name: string) => fold(name).split(/[^a-z0-9]+/).filter(Boolean);

/** Puntuació de coincidència (més alt, millor). 0 = no coincideix. */
export function clientMatchScore(client: { name: string; phone?: string | null }, query: string): number {
  const q = fold(query);
  if (!q) return 0;
  const name = fold(client.name);
  const ws = words(client.name);

  // Telèfon: quan s'escriuen sobretot xifres
  const qDigits = q.replace(/\D/g, "");
  if (qDigits.length >= 3 && qDigits.length >= q.replace(/\s/g, "").length - 1) {
    const phoneDigits = (client.phone || "").replace(/\D/g, "");
    return phoneDigits.includes(qDigits) ? 60 : 0;
  }

  const compact = q.replace(/\s+/g, "");
  const initials = ws.map((w) => w[0]).join("");

  // Inicials exactes o al principi ("mg", "mgl")
  if (compact.length >= 2 && !q.includes(" ")) {
    if (initials === compact) return 100;
    if (initials.startsWith(compact)) return 90;
    // Inicials en qualsevol ordre de paraules seguides ("gl" per "Maria Garcia Lopez")
    if (initials.includes(compact)) return 70;
  }

  // Cada tros escrit és el principi d'una paraula, en ordre ("ma ga")
  const parts = q.split(/\s+/).filter(Boolean);
  let from = 0;
  let allPrefix = true;
  for (const part of parts) {
    const idx = ws.findIndex((w, i) => i >= from && w.startsWith(part));
    if (idx === -1) {
      allPrefix = false;
      break;
    }
    from = idx + 1;
  }
  if (allPrefix) return name.startsWith(q) ? 85 : 80;

  if (name.includes(q)) return 50;
  return 0;
}

export function searchClients<T extends { name: string; phone?: string | null }>(list: T[], query: string, limit = 8): T[] {
  return list
    .map((c) => ({ c, score: clientMatchScore(c, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name, "ca"))
    .slice(0, limit)
    .map((r) => r.c);
}
