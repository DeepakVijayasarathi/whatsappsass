import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const failed = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name
    FROM _prisma_migrations
    WHERE finished_at IS NULL
      AND applied_steps_count = 0
      AND started_at IS NOT NULL
  `;

  if (failed.length === 0) {
    console.log("[resolve] No failed migrations found.");
    return;
  }

  for (const row of failed) {
    const name = row.migration_name;
    console.log(`[resolve] Marking migration as applied: ${name}`);
    try {
      execSync(
        `./node_modules/.bin/prisma migrate resolve --applied "${name}" --schema=./prisma/schema.prisma`,
        { stdio: "inherit" }
      );
    } catch {
      console.warn(`[resolve] Could not resolve ${name} — continuing.`);
    }
  }
}

main()
  .catch((e) => { console.error("[resolve] Error:", e.message); process.exit(0); })
  .finally(() => prisma.$disconnect());
