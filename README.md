# Estètica Diana · Agenda i bot de WhatsApp

Panell de gestió del centre (calendari de sales, clientes, serveis, horaris i professionals)
amb un bot de WhatsApp (Twilio) que proposa hores lliures a les clientes.

Tecnologia: Next.js 16, React 19, Drizzle ORM, Postgres (Neon) i Twilio. Desplegat a Vercel.

## Variables d'entorn

Copia `.env.example` a `.env` (o `.env.local`) per treballar en local. A Vercel s'han de
configurar a **Settings → Environment Variables**.

| Variable | Per a què serveix |
| --- | --- |
| `DATABASE_URL` | Connexió a Postgres (Neon). **No la posis mai al codi**: el repositori és públic. |
| `ADMIN_PASSWORD` | Contrasenya per entrar al panell. |
| `STAFF_PASSWORD` | Contrasenya de l'equip: entra al panell però no veu imports ni anul·la xecs regal (opcional). |
| `SESSION_SECRET` | Cadena aleatòria llarga (mínim 16 caràcters) per signar la sessió. |
| `CRON_SECRET` | Clau que Vercel Cron envia a `/api/reminders`. Sense ella els recordatoris no s'envien. |
| `NEXT_PUBLIC_APP_URL` | URL pública de l'app (per validar la firma de Twilio). |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | Enviament i recepció de WhatsApp. |

## Desenvolupament

```bash
npm install
npm run db:push   # crea o actualitza les taules
npm run db:seed   # dades d'exemple (només si la base de dades és buida)
npm run dev
```

Altres ordres: `npm run typecheck`, `npm run lint`, `npm run build`.

## Com funciona

- **Accés**: totes les pàgines i APIs demanen sessió (`src/proxy.ts`), excepte el webhook de
  Twilio (`/api/bot/webhook`, que valida la firma), els recordatoris (`/api/reminders`,
  protegit amb `CRON_SECRET`) i `/api/health`.
- **Dates**: totes les dates són `YYYY-MM-DD` en hora de Barcelona (`src/lib/dates.ts`).
- **Disponibilitat**: una cita no pot coincidir amb una altra de la mateixa sala ni de la mateixa
  professional (`src/lib/availability.ts`).
- **Bot**: `src/lib/bot-engine.ts` detecta el servei, busca hores dins l'horari d'obertura amb
  una professional lliure i n'ofereix fins a tres. La professional les confirma des del panell.
- **Recordatoris**: Vercel Cron crida `/api/reminders` cada dia a les 9:00 UTC i envia un
  WhatsApp a les cites confirmades de l'endemà.
