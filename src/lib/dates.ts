// Utilitats de dates. Totes les dates de l'app són cadenes "YYYY-MM-DD" en hora de Barcelona.
// Abans es feia servir toISOString(), que retorna l'hora UTC: entre les 00:00 i les 02:00
// (i en navegar pel calendari) el dia sortia desplaçat.

export const CENTER_TIMEZONE = "Europe/Madrid";

/** Data d'avui a Barcelona, en format YYYY-MM-DD (funciona igual al servidor i al navegador). */
export function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CENTER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Hora actual a Barcelona, en format HH:MM. */
export function nowTimeStr(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CENTER_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

/** Suma (o resta) dies a una data YYYY-MM-DD sense problemes de fus horari. */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Dia de la setmana d'una data YYYY-MM-DD (0 = diumenge ... 6 = dissabte). */
export function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
