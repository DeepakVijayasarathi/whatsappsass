# ─── Stage 1: Build Backend ───────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /app

RUN apk add --no-cache openssl

# Copy only package files first for better layer caching
COPY package.json ./
COPY packages/database/package.json ./packages/database/
COPY apps/backend/package.json ./apps/backend/

# npm workspaces hoists all packages into /app/node_modules
RUN npm install --workspace=packages/database --workspace=apps/backend

# Copy source after install so code changes don't bust the install cache
COPY packages/database ./packages/database
COPY apps/backend ./apps/backend

RUN cd packages/database && ./node_modules/.bin/prisma generate
RUN cd apps/backend && npm run build


# ─── Stage 2: Build Frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY apps/frontend/package.json ./
RUN npm install

COPY apps/frontend ./
RUN npm run build


# ─── Stage 3: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl supervisor

ENV NODE_ENV=production
ENV BACKEND_PORT=4000
ENV FRONTEND_PORT=3000

# Backend — copy hoisted node_modules, compiled dist, prisma schema + migrations
COPY --from=backend-builder /app/apps/backend/dist        ./backend/dist
COPY --from=backend-builder /app/node_modules             ./backend/node_modules
COPY --from=backend-builder /app/packages/database/prisma ./backend/prisma
COPY --from=backend-builder /app/apps/backend/package.json ./backend/package.json

# Frontend — standalone bundle already includes its own node_modules
COPY --from=frontend-builder /app/.next/standalone        ./frontend
COPY --from=frontend-builder /app/.next/static            ./frontend/.next/static

COPY supervisord.conf /etc/supervisord.conf

# Static ports — EXPOSE does not support env var expansion
EXPOSE 4000 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
