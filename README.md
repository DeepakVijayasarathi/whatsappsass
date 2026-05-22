# WhatsApp SaaS Lite

Multi-tenant WhatsApp marketing platform powered by Meta WhatsApp Cloud API.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | Node.js + Fastify |
| Database | PostgreSQL via Prisma ORM |
| Auth | JWT (stateless) |
| WhatsApp | Meta WhatsApp Cloud API |

## Project Structure

```
whatsapp-saas-lite/
├── apps/
│   ├── backend/          # Fastify API (port 4000)
│   └── frontend/         # Next.js app (port 3000)
├── packages/
│   └── database/         # Prisma schema + client
├── docker-compose.yml
└── package.json          # npm workspaces root
```

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 14+ (or Docker)

### 1. Clone & install

```bash
npm install
```

### 2. Configure environment

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local
cp packages/database/.env.example packages/database/.env
```

Edit `apps/backend/.env`:
- Set `DATABASE_URL` to your PostgreSQL connection string
- Set a strong `JWT_SECRET`
- Add your Meta WhatsApp credentials

### 3. Database setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Seed demo data
npm run db:seed
```

### 4. Run dev servers

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

---

## Docker (single-file deploy)

One Dockerfile builds and runs both frontend and backend. You supply a PostgreSQL URL (e.g. from Supabase, Railway, or your own server).

```bash
# Build the image
docker build -t whatsapp-saas .

# Run (replace env values)
docker run -d \
  -p 3000:3000 \
  -p 4000:4000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/whatsapp_saas" \
  -e JWT_SECRET="your-long-random-secret" \
  -e BACKEND_URL="http://127.0.0.1:4000" \
  --name whatsapp-saas \
  whatsapp-saas
```

- Frontend → http://localhost:3000
- Backend  → http://localhost:4000

> Migrations run automatically on container start via Prisma migrate deploy.

---

## API Reference

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Register + create workspace |
| POST | `/auth/login` | Get JWT token |

### Workspace
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/workspace/me` | Any | Get workspace info |
| PATCH | `/workspace/me` | Owner/Admin | Update workspace name |
| GET | `/workspace/members` | Any | List team members |
| POST | `/workspace/invite` | Owner/Admin | Invite member |

### License
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/license/activate` | Owner/Admin | Activate `LITE-XXXX-XXXX-XXXX` key |
| GET | `/license/status` | Any | Check license status |

### Meta WhatsApp Toggle
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/meta/toggle` | Owner/Admin | Enable/disable WhatsApp API |
| GET | `/meta/status` | Any | Get current toggle state |

### Contacts
| Method | Path | Auth |
|---|---|---|
| GET | `/contacts` | Any |
| POST | `/contacts` | Any |
| GET | `/contacts/:id` | Any |
| PATCH | `/contacts/:id` | Any |
| DELETE | `/contacts/:id` | Any |
| POST | `/contacts/bulk` | Any |

### Campaigns
| Method | Path | Auth |
|---|---|---|
| GET | `/campaigns` | Any |
| POST | `/campaigns` | Owner/Admin |
| GET | `/campaigns/:id` | Any |
| PATCH | `/campaigns/:id` | Owner/Admin |
| DELETE | `/campaigns/:id` | Owner/Admin |
| GET | `/campaigns/:id/stats` | Any |

### WhatsApp Sending
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/whatsapp/send` | Any* | Send single template message |
| POST | `/whatsapp/send-bulk` | Any* | Bulk send to opted-in contacts |
| GET | `/whatsapp/webhook` | Public | Meta webhook verification |
| POST | `/whatsapp/webhook` | Public | Meta delivery status updates |

*Requires `meta_whatsapp_enabled = true` on the workspace.

### Analytics
| Method | Path | Auth |
|---|---|---|
| GET | `/analytics/overview` | Any |
| GET | `/analytics/messages?days=7` | Any |
| GET | `/analytics/contacts` | Any |

---

## License Key Format

```
LITE-XXXX-XXXX-XXXX
```

Generate and insert keys directly into the `license_keys` table, or via the seed script. Keys are bound to a workspace on first activation.

## Roles

| Role | Permissions |
|---|---|
| `owner` | Full access |
| `admin` | All except owner-only ops |
| `marketer` | Read + send messages |

## Meta WhatsApp Setup

1. Create a Meta Developer App at developers.facebook.com
2. Add the WhatsApp product
3. Copy `Phone Number ID` and `Access Token` to `.env`
4. Set your webhook URL to `https://your-domain.com/whatsapp/webhook`
5. Set `META_WEBHOOK_VERIFY_TOKEN` to any random string (must match what you enter in Meta console)
6. Enable WhatsApp in workspace Settings page
"# whatsappsass" 
