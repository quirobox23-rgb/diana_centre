import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// La URL de la base de dades es llegeix de la variable d'entorn DATABASE_URL
// (fitxer .env.local en local, o les variables del projecte a Vercel).
// No posis mai la contrasenya directament en aquest fitxer: el repositori és públic.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
