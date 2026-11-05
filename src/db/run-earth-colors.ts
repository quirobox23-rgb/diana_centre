import "dotenv/config";
import { db } from "./index";
import { professionals, rooms, services } from "./schema";
import { eq } from "drizzle-orm";
import { EARTH_COLOR_MAP } from "./earth-colors";

// Canvia els colors antics de sales, serveis i professionals pels de la paleta terra.
// Només toca els colors que encara són els originals; els que s'hagin personalitzat es mantenen.
async function main() {
  let changed = 0;
  for (const table of [rooms, services, professionals]) {
    for (const [oldColor, newColor] of Object.entries(EARTH_COLOR_MAP)) {
      const res = await db.update(table).set({ color: newColor }).where(eq(table.color, oldColor)).returning({ id: table.id });
      changed += res.length;
    }
  }
  console.log(`Colors actualitzats: ${changed}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
