import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const MIGRATIONS_DIR = path.join(__dirname, "../prisma/migrations");
const SCHEMA = path.join(__dirname, "../prisma/schema.prisma");

function getMigrationDirs(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => {
      const full = path.join(MIGRATIONS_DIR, name);
      return (
        fs.statSync(full).isDirectory() &&
        fs.existsSync(path.join(full, "migration.sql"))
      );
    })
    .sort();
}

function resolveAsApplied(name: string): void {
  try {
    execSync(
      `./node_modules/.bin/prisma migrate resolve --applied "${name}" --schema="${SCHEMA}"`,
      { stdio: "pipe" }
    );
    console.log(`[resolve] Marked as applied: ${name}`);
  } catch (err: unknown) {
    const out = err as { stdout?: Buffer; stderr?: Buffer };
    const msg = (out.stderr?.toString() ?? "") + (out.stdout?.toString() ?? "");
    if (msg.includes("P3008") || msg.includes("already recorded as applied")) {
      // Already applied cleanly — no action needed
    } else {
      console.warn(`[resolve] Could not resolve ${name}: ${msg.slice(0, 300)}`);
    }
  }
}

async function main() {
  const prisma = new PrismaClient();

  let brokenRows: { migration_name: string }[] = [];
  try {
    brokenRows = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations
      WHERE started_at IS NOT NULL
        AND finished_at IS NULL
        AND rolled_back_at IS NULL
    `;
  } catch {
    // Table may not exist on first ever run
    console.log("[resolve] _prisma_migrations not found — skipping resolve step.");
    await prisma.$disconnect();
    return;
  }
  await prisma.$disconnect();

  if (brokenRows.length === 0) {
    console.log("[resolve] No broken migrations — nothing to resolve.");
    return;
  }

  const brokenNames = new Set(brokenRows.map((r) => r.migration_name));
  console.log(`[resolve] Broken migrations: ${[...brokenNames].join(", ")}`);

  const allDirs = getMigrationDirs();

  // Find the last broken migration's position in the sorted disk list.
  // Resolve everything up to and including it (earlier ones may have already
  // applied their schema, P3008 will be silenced silently).
  const lastBrokenIdx = allDirs.reduce(
    (max, dir, idx) => (brokenNames.has(dir) ? idx : max),
    -1
  );

  if (lastBrokenIdx === -1) {
    // Broken name not on disk — resolve it directly
    for (const name of brokenNames) {
      resolveAsApplied(name);
    }
    return;
  }

  for (let i = 0; i <= lastBrokenIdx; i++) {
    resolveAsApplied(allDirs[i]);
  }
}

main().catch((e) => {
  // Non-fatal — always let migrate deploy run
  console.error("[resolve] Error:", (e as Error).message);
});
