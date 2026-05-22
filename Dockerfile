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

RUN cd packages/database && npx prisma generate
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

# Backend
COPY --from=backend-builder /app/apps/backend/dist ./backend/dist
COPY --from=backend-builder /app/apps/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/packages/database/prisma ./backend/prisma
COPY --from=backend-builder /app/apps/backend/package.json ./backend/package.json

# Frontend (Next.js standalone)
COPY --from=frontend-builder /app/.next/standalone ./frontend
COPY --from=frontend-builder /app/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/public ./frontend/public

COPY supervisord.conf /etc/supervisord.conf

# Ports are set via BACKEND_PORT / FRONTEND_PORT env vars at runtime
EXPOSE ${BACKEND_PORT} ${FRONTEND_PORT}

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
