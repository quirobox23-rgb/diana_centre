import "dotenv/config";
import { seedDatabase } from "./seed";

async function main() {
  await seedDatabase();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error running seed:", err);
  process.exit(1);
});
