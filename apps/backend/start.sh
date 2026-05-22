#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "[ERROR] DATABASE_URL is not set. Exiting."
  exit 1
fi

echo "[db] Resolving any failed migrations..."
node dist/resolve-migrations.js || true

echo "[db] Applying migrations..."
./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

echo "[db] Seeding default admin (skipped if already exists)..."
node dist/seed.js

echo "[db] Done. Starting server..."
exec node dist/server.js
