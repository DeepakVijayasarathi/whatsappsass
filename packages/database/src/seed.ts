import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function generateLicenseKey(): string {
  const segment = () =>
    crypto.randomBytes(2).toString("hex").toUpperCase();
  return `LITE-${segment()}-${segment()}-${segment()}`;
}

async function main() {
  const workspace = await prisma.workspace.create({
    data: {
      name: "Demo Workspace",
      plan: "lite",
      status: "active",
    },
  });

  const licenseKey = generateLicenseKey();
  await prisma.licenseKey.create({
    data: {
      key: licenseKey,
      plan: "lite",
      status: "active",
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@demo.com",
      passwordHash,
      role: "owner",
      workspaceId: workspace.id,
    },
  });

  console.log(`Seeded workspace: ${workspace.id}`);
  console.log(`Demo license key: ${licenseKey}`);
  console.log("Demo login: admin@demo.com / admin123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
