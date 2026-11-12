// S'executa un cop quan arrenca el servidor: crea taules i columnes noves abans
// d'atendre cap petició (així cap consulta falla per una columna que encara no hi és).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DATABASE_URL) {
    const { ensureSchema } = await import("@/db/ensure-schema");
    await ensureSchema().catch(err => console.error("[ensureSchema]", err));
  }
}
