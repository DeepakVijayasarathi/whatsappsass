#!/bin/sh
set -e

echo "[db] Applying migrations..."
./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

echo "[db] Seeding default admin (skipped if already exists)..."
node dist/seed.js

echo "[db] Done. Starting server..."
exec node dist/server.js
