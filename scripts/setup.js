#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ENV_PATH = path.join(__dirname, "../apps/backend/.env");
const FRONTEND_ENV_PATH = path.join(__dirname, "../apps/frontend/.env.local");
const DB_ENV_PATH = path.join(__dirname, "../packages/database/.env");

function randomSecret(bytes = 48) {
  return crypto.randomBytes(bytes).toString("hex");
}

function generateLicenseKey() {
  const seg = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `LITE-${seg()}-${seg()}-${seg()}`;
}

function writeIfMissing(filePath, content) {
  if (fs.existsSync(filePath)) {
    console.log(`  ⚠  Already exists, skipped: ${filePath}`);
    return false;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  ✔  Created: ${filePath}`);
  return true;
}

const jwtSecret = randomSecret();
const licenseKey = generateLicenseKey();

const backendEnv = `# ── Database ─────────────────────────────────────────────────
DATABASE_URL="postgresql://postgres:password@localhost:5432/whatsapp_saas"

# ── Auth ──────────────────────────────────────────────────────
JWT_SECRET="${jwtSecret}"

# ── Server ────────────────────────────────────────────────────
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
BACKEND_PORT=4000
FRONTEND_PORT=3000

# ── Meta WhatsApp Cloud API ───────────────────────────────────
META_PHONE_NUMBER_ID=your_phone_number_id
META_ACCESS_TOKEN=your_permanent_access_token
META_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# ── MSG91 WhatsApp API (alternative provider) ─────────────────
MSG91_AUTH_KEY=your_msg91_auth_key
MSG91_INTEGRATED_NUMBER=91XXXXXXXXXX

# ── Demo License Key (generated for you) ─────────────────────
# Insert this into the license_keys table or use npm run db:seed
DEMO_LICENSE_KEY=${licenseKey}
`;

const frontendEnv = `NEXT_PUBLIC_API_URL=http://localhost:4000
`;

const dbEnv = `DATABASE_URL="postgresql://postgres:password@localhost:5432/whatsapp_saas"
`;

console.log("\n🔧  WhatsApp SaaS — Auto Setup\n");

writeIfMissing(ENV_PATH, backendEnv);
writeIfMissing(FRONTEND_ENV_PATH, frontendEnv);
writeIfMissing(DB_ENV_PATH, dbEnv);

console.log(`
✅  Environment files ready.

📋  Auto-generated values:
    JWT_SECRET   : ${jwtSecret.slice(0, 16)}... (full key written to .env)
    License Key  : ${licenseKey}

⚠   Still required (fill in apps/backend/.env):
    DATABASE_URL          → your PostgreSQL connection string
    META_PHONE_NUMBER_ID  → from Meta Developer Console
    META_ACCESS_TOKEN     → from Meta Developer Console

🚀  Next steps:
    1. Edit apps/backend/.env  (fill META credentials + DATABASE_URL)
    2. npm run db:migrate       (create tables)
    3. npm run db:seed          (create demo user + activate license)
    4. npm run dev              (start frontend + backend)

    OR for Docker:
    docker build -t whatsapp-saas .
    docker run -d -p 3000:3000 -p 4000:4000 --env-file apps/backend/.env --name whatsapp-saas whatsapp-saas
`);
