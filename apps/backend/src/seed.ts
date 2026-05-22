import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@demo.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "admin123";
const WORKSPACE_NAME = process.env.SEED_WORKSPACE_NAME || "Demo Workspace";

function generateLicenseKey(): string {
  const seg = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `LITE-${seg()}-${seg()}-${seg()}`;
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`[seed] Admin user already exists (${ADMIN_EMAIL}), skipping.`);
    return;
  }

  const workspace = await prisma.workspace.create({
    data: { name: WORKSPACE_NAME, plan: "lite", status: "active" },
  });

  const licenseKey = generateLicenseKey();
  await prisma.licenseKey.create({
    data: {
      key: licenseKey,
      plan: "lite",
      status: "active",
      workspaceId: workspace.id,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { licenseKey },
  });

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.create({
    data: {
      name: "Admin",
      email: ADMIN_EMAIL,
      passwordHash,
      role: "owner",
      workspaceId: workspace.id,
    },
  });

  console.log(`[seed] Created workspace: ${workspace.id}`);
  console.log(`[seed] License key: ${licenseKey}`);
  console.log(`[seed] Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => { console.error("[seed] Error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
