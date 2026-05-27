# ─── Stage 1: Build Backend ───────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json ./
COPY packages/database/package.json ./packages/database/
COPY apps/backend/package.json ./apps/backend/

RUN npm install --workspace=packages/database --workspace=apps/backend

COPY packages/database ./packages/database
COPY apps/backend ./apps/backend
COPY scripts ./scripts

# Generate Prisma client (uses committed schema, no DB needed)
RUN node_modules/.bin/prisma generate \
      --schema=packages/database/prisma/schema.prisma

RUN cd apps/backend && npm run build


# ─── Stage 2: Build Frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# APP_URL is optional at build time — the app reads it at runtime via /api/config
# Pass it here only if you want it baked into the static build (e.g. for meta tags)
ARG NEXT_PUBLIC_APP_URL=""

COPY apps/frontend/package.json ./
RUN npm install

COPY apps/frontend ./
RUN NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL npm run build


# ─── Stage 3: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl supervisor

ENV NODE_ENV=production
ENV BACKEND_PORT=4000
ENV FRONTEND_PORT=3000
ENV BACKEND_URL=http://127.0.0.1:4000

# Backend
COPY --from=backend-builder /app/apps/backend/dist         ./backend/dist
COPY --from=backend-builder /app/node_modules              ./backend/node_modules
COPY --from=backend-builder /app/packages/database/prisma  ./backend/prisma
COPY --from=backend-builder /app/apps/backend/package.json ./backend/package.json
COPY --from=backend-builder /app/apps/backend/start.sh     ./backend/start.sh
RUN chmod +x /app/backend/start.sh

# Frontend (standalone already includes its own node_modules)
COPY --from=frontend-builder /app/.next/standalone         ./frontend
COPY --from=frontend-builder /app/.next/static             ./frontend/.next/static

COPY supervisord.conf /etc/supervisord.conf

EXPOSE 4000 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
