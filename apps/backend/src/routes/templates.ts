import type { FastifyInstance } from "fastify";
import axios from "axios";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { decryptNullable } from "../lib/encrypt";

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v19.0";
import { authenticate, requireOwnerOrAdmin } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";

/**
 * Returns true when the URL hostname is localhost/127.0.0.1/::1 — these cannot
 * be fetched by Meta or MSG91 servers during template review, so we reject them
 * early with a helpful message instead of surfacing a cryptic upstream error.
 */
function isLocalhostUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

/** Decrypt the at-rest credential fields on a workspace row in-place so
 *  downstream provider calls receive plaintext. Safe on partial selects
 *  (only touches fields that are present) and on legacy plaintext values. */
function decryptWsSecrets<
  T extends { metaAccessToken?: string | null; msg91AuthKey?: string | null }
>(ws: T | null): T | null {
  if (!ws) return ws;
  if ("metaAccessToken" in ws) ws.metaAccessToken = decryptNullable(ws.metaAccessToken);
  if ("msg91AuthKey" in ws) ws.msg91AuthKey = decryptNullable(ws.msg91AuthKey);
  return ws;
}

export interface NormalizedTemplate {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
  body: string | null;
  provider: "meta" | "msg91";
}

async function fetchMetaTemplates(wabaId: string, accessToken: string): Promise<NormalizedTemplate[]> {
  const { data } = await axios.get(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${wabaId}/message_templates`,
    {
      params: { fields: "id,name,status,language,category,components", limit: 200 },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return (data.data ?? []).map((t: {
    id: string;
    name: string;
    status: string;
    language: string;
    category: string;
    components?: Array<{ type: string; text?: string }>;
  }): NormalizedTemplate => ({
    id: t.id,
    name: t.name,
    status: t.status,          // "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED"
    language: t.language,
    category: t.category,
    body: t.components?.find((c) => c.type === "BODY")?.text ?? null,
    provider: "meta",
  }));
}

// MSG91 template endpoint.
// The canonical host is control.msg91.com (confirmed via live probe — returns 401 with auth).
// control.msg01.com is a non-existent domain (ECONNREFUSED); it has been removed.
// Override with MSG91_TEMPLATE_HOST env var if needed.
const MSG91_TEMPLATE_HOSTS = (() => {
  const envHost = process.env.MSG91_TEMPLATE_HOST;
  if (envHost) return [envHost];
  return ["control.msg91.com"];
})();

/**
 * Derive candidate number formats to try with MSG91.
 * MSG91 dashboard stores numbers in varied formats — we probe all common ones
 * so the user doesn't need to know which exact format MSG91 expects.
 * Priority order: stored value first, then derived variants.
 */
function numberCandidates(stored: string): string[] {
  const digits = stored.replace(/\D/g, "");
  const seen = new Set<string>();
  const candidates: string[] = [];
  const add = (v: string) => { if (v && !seen.has(v)) { seen.add(v); candidates.push(v); } };

  // Always try the stored value first
  add(stored.trim());

  // If it already starts with 91 (India), also try without country code and with leading 0
  if (digits.startsWith("91") && digits.length >= 12) {
    add(digits);             // 919942921478
    add(digits.slice(2));    // 9942921478
    add("0" + digits.slice(2)); // 09942921478
  } else if (digits.length === 10) {
    // Likely local number — add country code variants
    add(digits);             // 9942921478
    add("91" + digits);      // 919942921478
    add("+91" + digits);     // +919942921478
    add("091" + digits);     // 0919942921478
  } else {
    // Unknown format — try as-is digits and with leading 91
    add(digits);
    if (!digits.startsWith("91")) add("91" + digits);
  }

  return candidates;
}

// MSG91 status values vary by plan/endpoint — normalize to standard set
function normalizeMsg91Status(raw: unknown): string {
  const s = String(raw ?? "").toUpperCase().trim();
  if (s === "ENABLE" || s === "ENABLED" || s === "APPROVED" || s === "ACTIVE" || s === "1") return "APPROVED";
  if (s === "DISABLE" || s === "DISABLED" || s === "PAUSED")   return "PAUSED";
  if (s === "PENDING" || s === "IN_REVIEW" || s === "SUBMITTED") return "PENDING";
  if (s === "REJECTED" || s === "FAILED")  return "REJECTED";
  if (s === "") return "UNKNOWN";
  return s; // pass through anything else (e.g. already "APPROVED")
}

let _normalizeSeq = 0;
function normalizeMsg91Template(t: unknown): NormalizedTemplate {
  const item = t as Record<string, unknown>;

  // get-template-client response shape:
  // { name, category, languages: [{ id, language, status, code: [{ type, text }] }] }
  // Flatten the first languages[] entry into the item for unified field access.
  const langs = Array.isArray(item.languages) ? (item.languages as Array<Record<string, unknown>>) : [];
  const lang0 = langs[0] ?? {};

  // Body: from languages[0].code[] where type === "BODY", or legacy component fields
  const codeArr = Array.isArray(lang0.code) ? (lang0.code as Array<Record<string, unknown>>) : [];
  const bodyFromCode = codeArr.find((c) => String(c.type ?? "").toUpperCase() === "BODY");

  const components = Array.isArray(item.components) ? (item.components as Array<Record<string, unknown>>) : [];
  const bodyComp = components.find((c) => String(c.type ?? "").toUpperCase() === "BODY");

  const content = (item.content && typeof item.content === "object")
    ? (item.content as Record<string, unknown>)
    : undefined;

  const rawBody =
    bodyFromCode?.text   != null ? String(bodyFromCode.text)   :
    bodyComp?.text       != null ? String(bodyComp.text)       :
    lang0.body           != null ? String(lang0.body)           :
    item.body            != null ? String(item.body)            :
    item.template_body   != null ? String(item.template_body)   :
    item.message         != null ? String(item.message)         :
    content?.body        != null ? String(content.body)         :
    content?.text        != null ? String(content.text)         :
    null;

  // Strip surrounding quotes that MSG91 sometimes wraps text in (e.g. '"Hii"' → 'Hii')
  const body = rawBody != null ? rawBody.replace(/^"(.*)"$/, "$1") : null;

  // ID: languages[0].id is the real template variant ID
  const apiId = lang0.id ?? item.template_id ?? item.id ?? item._id ?? item.templateId;
  const stableId = apiId != null
    ? String(apiId)
    : `msg91_${String(item.template_name ?? item.name ?? "")}_${++_normalizeSeq}`;

  // Status: languages[0].status = "approved" | "pending" | "rejected"
  const rawStatus =
    lang0.status         ??
    lang0.approval_status ??
    item.approval_status  ??
    item.waba_status      ??
    item.template_status  ??
    item.state            ??
    item.status;

  return {
    id:       stableId,
    name:     String(item.template_name ?? item.name ?? ""),
    status:   normalizeMsg91Status(rawStatus),
    language: String(lang0.language ?? item.language ?? item.lang ?? item.template_language ?? "en"),
    category: String(item.category_name ?? item.category ?? item.template_category ?? "UTILITY"),
    body,
    provider: "msg91",
  };
}

async function fetchMsg91Templates(authKey: string, integratedNumber: string): Promise<NormalizedTemplate[]> {
  const headers = { authkey: authKey, accept: "application/json", "content-type": "text/plain" };
  const numberFormats = numberCandidates(integratedNumber);

  // Try the documented get-template-client/:number endpoint first, then fall back to get-template-plugins
  for (const numFormat of numberFormats) {
    try {
      const res = await axios.get(
        `https://control.msg91.com/api/v5/whatsapp/get-template-client/${encodeURIComponent(numFormat)}`,
        { headers, timeout: 15_000 }
      );
      const d = res.data as Record<string, unknown>;
      const raw: unknown[] = Array.isArray(d?.data)
        ? (d.data as unknown[])
        : Array.isArray(res.data)
        ? (res.data as unknown[])
        : [];
      console.log(`[templates] MSG91 get-template-client success (${numFormat}): ${raw.length} templates`);
      return raw.map(normalizeMsg91Template);
    } catch (err: unknown) {
      const axErr = err as { response?: { status?: number; data?: unknown } };
      if (axErr.response?.status === 401) {
        throw new Error("MSG91 Auth Key is invalid or expired. Go to Settings → WhatsApp Provider and re-enter your Auth Key.");
      }
      // Any other error — fall through to legacy endpoint
      console.warn(`[templates] get-template-client failed for ${numFormat}, trying legacy endpoint`);
    }
  }

  // Legacy fallback: get-template-plugins with number as query param
  let data: unknown;
  let lastErr: unknown;

  for (const host of MSG91_TEMPLATE_HOSTS) {
    for (const numFormat of numberFormats) {
      try {
        const res = await axios.get(
          `https://${host}/api/v5/whatsapp/get-template-plugins/`,
          { params: { number: numFormat }, headers: { authkey: authKey }, timeout: 15_000 }
        );
        console.log(`[templates] MSG91 get-template-plugins success (${numFormat})`);
        data = res.data;
        lastErr = null;
        break;
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number; data?: unknown }; code?: string };
        if (axiosErr.response) {
          const status = axiosErr.response.status;
          const d = axiosErr.response.data as Record<string, unknown> | undefined;
          const errText = JSON.stringify(d);
          if (status === 400 && errText.includes("No integration found")) {
            lastErr = new Error(`No integration found for any number format tried. Last: ${numFormat}`);
            continue;
          }
          if (status === 401) {
            throw new Error("MSG91 Auth Key is invalid or expired. Go to Settings → WhatsApp Provider and re-enter your Auth Key.");
          }
          const msg =
            (typeof d?.message === "string" && d.message) ||
            (typeof d?.errors  === "string" && d.errors)  ||
            (typeof d?.error   === "string" && d.error)   ||
            `MSG91 API error (HTTP ${status})`;
          throw new Error(msg);
        }
        console.warn(`[templates] MSG91 host unreachable (${host}): ${(err as Error).message}`);
        lastErr = err;
        break;
      }
    }
    if (data !== undefined) break;
  }

  if (lastErr !== null && data === undefined) {
    const errMsg = (lastErr as Error).message ?? "Network error";
    if (errMsg.includes("No integration found")) {
      const tried = numberCandidates(integratedNumber).join(", ");
      throw new Error(
        `MSG91: "No integration found" for any number format tried (${tried}). ` +
        `Please verify the Integrated Number in your MSG91 dashboard and update it in Settings → WhatsApp Provider.`
      );
    }
    throw new Error(`Cannot reach MSG91 API. Ensure outbound internet access (HTTPS port 443). Error: ${errMsg}`);
  }

  const d = data as Record<string, unknown>;
  const isErrorBody =
    d?.type === "error" || d?.status === "error" || d?.success === false ||
    (typeof d?.code === "number" && d.code === 0 && !Array.isArray(d?.data));

  if (isErrorBody) {
    const msg = (typeof d.message === "string" && d.message) || (typeof d.error === "string" && d.error) || "MSG91 authentication failed";
    throw new Error(msg);
  }

  const raw: unknown[] = Array.isArray(d?.data)
    ? (d.data as unknown[])
    : Array.isArray((d as Record<string, unknown>)?.templates)
    ? ((d as Record<string, unknown>).templates as unknown[])
    : Array.isArray(data) ? (data as unknown[]) : [];

  console.log(`[templates] MSG91 fetched ${raw.length} templates via legacy endpoint`);
  return raw.map(normalizeMsg91Template);
}

export async function templateRoutes(app: FastifyInstance) {
  // GET /templates — fetch all templates from the configured provider
  app.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;

    const workspace = decryptWsSecrets(await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: {
        whatsappProvider: true,
        metaWabaId: true,
        metaAccessToken: true,
        msg91AuthKey: true,
        msg91IntegratedNumber: true,
      },
    }));

    if (!workspace) return reply.status(404).send({ error: "Workspace not found" });

    // No provider selected yet
    if (!workspace.whatsappProvider) {
      return reply.status(422).send({
        error: "No WhatsApp provider configured. Go to Settings → WhatsApp Provider and select Meta Cloud API or MSG91.",
      });
    }

    if (workspace.whatsappProvider === "meta") {
      if (!workspace.metaWabaId || !workspace.metaAccessToken) {
        return reply.status(422).send({
          error: "Meta WABA ID and Access Token required. Configure them in Settings → WhatsApp Provider.",
        });
      }
      try {
        const templates = await fetchMetaTemplates(workspace.metaWabaId, workspace.metaAccessToken);
        return reply.send({ templates, provider: "meta", total: templates.length });
      } catch (err: unknown) {
        const rawMsg = (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ?? "Failed to fetch templates from Meta";
        // Provide a more actionable message for common Meta API errors
        const msg = rawMsg.includes("not found on the server") || rawMsg.includes("GraphInvalidID")
          ? "Invalid WABA ID — please verify your Meta WABA ID in Settings → WhatsApp Provider."
          : rawMsg;
        return reply.status(502).send({ error: msg });
      }
    }

    // MSG91 — try API first (requires Hello plan), fall back to DB custom templates
    if (!workspace.msg91AuthKey) {
      return reply.status(422).send({
        error: "MSG91 Auth Key required. Configure it in Settings → WhatsApp Provider.",
      });
    }
    if (!workspace.msg91IntegratedNumber) {
      return reply.status(422).send({
        error: "MSG91 Integrated Number required. Configure it in Settings → WhatsApp Provider.",
      });
    }
    // Always fetch DB custom templates (includes PENDING submitted via our UI)
    const dbTemplates = await prisma.customTemplate.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: "desc" },
    });

    try {
      const apiTemplates = await fetchMsg91Templates(workspace.msg91AuthKey, workspace.msg91IntegratedNumber);

      // Build a lookup of DB entries by name so we can fill in missing status/body
      const dbByName = new Map(dbTemplates.map((t) => [t.name, t]));

      // API is authoritative, but if it returns UNKNOWN status or null body,
      // fall back to the DB entry for those fields (which we set on creation)
      const merged: NormalizedTemplate[] = apiTemplates.map((t) => {
        const db = dbByName.get(t.name);
        return {
          ...t,
          status: t.status === "UNKNOWN" && db?.status ? db.status : t.status,
          body:   t.body ?? db?.body ?? null,
        };
      });

      // Append DB entries whose name is not in the API response (still PENDING / not yet approved)
      const apiNames = new Set(apiTemplates.map((t) => t.name));
      const pendingFromDb: NormalizedTemplate[] = dbTemplates
        .filter((t) => !apiNames.has(t.name))
        .map((t) => ({
          id: t.id, name: t.name, status: t.status,
          language: t.language, category: t.category, body: t.body, provider: "msg91" as const,
        }));

      const templates = [...merged, ...pendingFromDb];
      return reply.send({ templates, provider: "msg91", total: templates.length });
    } catch (err: unknown) {
      const msg = (err instanceof Error && err.message) || "Failed to fetch templates from MSG91";
      console.warn("[templates] MSG91 API fetch failed, falling back to custom DB templates:", msg);
      if (dbTemplates.length > 0) {
        const templates: NormalizedTemplate[] = dbTemplates.map((t) => ({
          id: t.id, name: t.name, status: t.status,
          language: t.language, category: t.category, body: t.body, provider: "msg91" as const,
        }));
        return reply.send({ templates, provider: "msg91", total: templates.length });
      }
      return reply.status(502).send({ error: msg });
    }
  });

  // ── POST /templates/sync — sync MSG91 API statuses into local DB ────────────
  app.post("/sync", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;

    const workspace = decryptWsSecrets(await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { whatsappProvider: true, msg91AuthKey: true, msg91IntegratedNumber: true },
    }));

    if (!workspace) return reply.status(404).send({ error: "Workspace not found" });
    if (workspace.whatsappProvider !== "msg91") {
      return reply.status(422).send({ error: "Sync is only available for MSG91 provider." });
    }
    if (!workspace.msg91AuthKey || !workspace.msg91IntegratedNumber) {
      return reply.status(422).send({ error: "MSG91 credentials required." });
    }

    let apiTemplates: NormalizedTemplate[];
    try {
      apiTemplates = await fetchMsg91Templates(workspace.msg91AuthKey, workspace.msg91IntegratedNumber);
    } catch (err: unknown) {
      return reply.status(502).send({ error: (err instanceof Error && err.message) || "Failed to fetch from MSG91" });
    }

    // Upsert each API template into custom_templates so status/body are current
    let synced = 0;
    for (const t of apiTemplates) {
      if (!t.name || t.status === "UNKNOWN") continue;
      await prisma.customTemplate.upsert({
        where:  { workspaceId_name: { workspaceId: user.workspaceId, name: t.name } },
        create: {
          workspaceId: user.workspaceId,
          name:     t.name,
          category: t.category ?? "UTILITY",
          language: t.language ?? "en_US",
          body:     t.body ?? "",
          status:   t.status,
        },
        update: {
          status:   t.status,
          ...(t.body ? { body: t.body } : {}),
          ...(t.category ? { category: t.category } : {}),
          ...(t.language ? { language: t.language } : {}),
        },
      });
      synced++;
    }

    return reply.send({ message: `Synced ${synced} template${synced !== 1 ? "s" : ""} from MSG91.`, synced, total: apiTemplates.length });
  });

  // ── POST /templates/custom — create a custom template (MSG91) ───────────────
  app.post("/custom", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const schema = z.object({
      name:     z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, "Name must be lowercase letters, numbers, underscores only"),
      category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).default("UTILITY"),
      language: z.string().min(2).max(10).default("en_US"),
      body:     z.string().min(1).max(1024),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.customTemplate.findUnique({
      where: { workspaceId_name: { workspaceId: user.workspaceId, name: parsed.data.name } },
    });
    if (existing) return reply.status(409).send({ error: `Template "${parsed.data.name}" already exists.` });

    const template = await prisma.customTemplate.create({
      data: { workspaceId: user.workspaceId, ...parsed.data },
    });
    return reply.status(201).send(template);
  });

  // ── PUT /templates/custom/:id — update template in MSG91 API + DB ───────────
  app.put("/custom/:id", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const schema = z.object({
      body:     z.string().min(1).max(1024).optional(),
      buttons:  z.array(z.union([
        z.object({ type: z.literal("QUICK_REPLY"),  text: z.string().min(1).max(25) }),
        z.object({ type: z.literal("URL"),          text: z.string().min(1).max(25), url: z.string().url() }),
        z.object({ type: z.literal("PHONE_NUMBER"), text: z.string().min(1).max(25), phone_number: z.string().min(7) }),
      ])).max(3).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.customTemplate.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) return reply.status(404).send({ error: "Template not found" });

    const workspace = decryptWsSecrets(await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { msg91AuthKey: true, msg91IntegratedNumber: true },
    }));

    // Call MSG91 edit API if credentials are present
    if (workspace?.msg91AuthKey && workspace.msg91IntegratedNumber && parsed.data.body) {
      const components: Record<string, unknown>[] = [];
      const bodyVars = [...parsed.data.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => `sample_${m[1]}`);
      const bodyComp: Record<string, unknown> = { type: "BODY", text: parsed.data.body };
      if (bodyVars.length > 0) bodyComp.example = { body_text: [bodyVars] };
      components.push(bodyComp);

      if (parsed.data.buttons && parsed.data.buttons.length > 0) {
        components.push({
          type: "BUTTONS",
          buttons: parsed.data.buttons.map((btn) => {
            if (btn.type === "URL") return { type: "URL", text: btn.text, url: btn.url };
            if (btn.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: btn.text, phone_number: btn.phone_number };
            return { type: "QUICK_REPLY", text: btn.text };
          }),
        });
      }

      try {
        await axios.put(
          `https://control.msg91.com/api/v5/whatsapp/client-panel-template/${existing.name}/`,
          {
            integrated_number: workspace.msg91IntegratedNumber.replace(/^\+/, ""),
            components,
            button_url: parsed.data.buttons?.some((b) => b.type === "URL") ?? false,
          },
          { headers: { authkey: workspace.msg91AuthKey, "Content-Type": "application/json" } }
        );
      } catch (err: unknown) {
        console.warn("[templates] MSG91 edit warning:", (err as Error).message);
      }
    }

    const updated = await prisma.customTemplate.update({
      where: { id },
      data: { body: parsed.data.body },
    });
    return reply.send(updated);
  });

  // ── DELETE /templates/custom/:id — delete template from MSG91 API + DB ──────
  app.delete("/custom/:id", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const existing = await prisma.customTemplate.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) return reply.status(404).send({ error: "Template not found" });

    const workspace = decryptWsSecrets(await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { msg91AuthKey: true, msg91IntegratedNumber: true },
    }));

    // Best-effort delete from MSG91 API (only if credentials present)
    if (workspace?.msg91AuthKey && workspace.msg91IntegratedNumber) {
      try {
        await axios.delete(
          "https://control.msg91.com/api/v5/whatsapp/client-panel-template/",
          {
            params: {
              integrated_number: workspace.msg91IntegratedNumber.replace(/^\+/, ""),
              template_name:     existing.name,
            },
            headers: { authkey: workspace.msg91AuthKey, "Content-Type": "application/json" },
          }
        );
      } catch (err: unknown) {
        // Log but don't fail — template may not exist on MSG91 side if it was only local
        console.warn("[templates] MSG91 delete warning:", (err as Error).message);
      }
    }

    await prisma.customTemplate.delete({ where: { id } });
    return reply.send({ message: "Template deleted" });
  });

  // ── POST /templates/msg91 — create a template via MSG91 API ─────────────────
  app.post("/msg91", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;

    const buttonSchema = z.union([
      z.object({ type: z.literal("QUICK_REPLY"),  text: z.string().min(1).max(25) }),
      z.object({ type: z.literal("URL"),          text: z.string().min(1).max(25), url: z.string().url() }),
      z.object({ type: z.literal("PHONE_NUMBER"), text: z.string().min(1).max(25), phone_number: z.string().min(7) }),
    ]);
    const schema = z.object({
      name:     z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, "Name must be lowercase letters, numbers, underscores only"),
      category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).default("UTILITY"),
      language: z.string().min(2).max(10).default("en_US"),
      body:     z.string().min(20, "Body must be at least 20 characters — WhatsApp rejects short or test-like content").max(1024),
      header:   z.object({ format: z.enum(["TEXT", "IMAGE", "VIDEO", "DOCUMENT"]), text: z.string().max(60).optional(), mediaUrl: z.string().url().optional() }).optional(),
      footer:   z.string().max(60).optional(),
      buttons:  z.array(buttonSchema).max(3).optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const workspace = decryptWsSecrets(await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { whatsappProvider: true, msg91AuthKey: true, msg91IntegratedNumber: true },
    }));

    if (!workspace) return reply.status(404).send({ error: "Workspace not found" });
    if (workspace.whatsappProvider !== "msg91") {
      return reply.status(422).send({ error: "This endpoint is for MSG91 provider only." });
    }
    if (!workspace.msg91AuthKey) {
      return reply.status(422).send({ error: "MSG91 Auth Key required. Configure it in Settings → WhatsApp Provider." });
    }
    if (!workspace.msg91IntegratedNumber) {
      return reply.status(422).send({ error: "MSG91 Integrated Number required. Configure it in Settings → WhatsApp Provider." });
    }

    const { name, category, language, body, header, footer, buttons } = parsed.data;

    // Reject early if the name already exists in our DB (avoids wasting a MSG91 API call)
    const existing = await prisma.customTemplate.findUnique({
      where: { workspaceId_name: { workspaceId: user.workspaceId, name } },
    });
    if (existing) {
      return reply.status(409).send({ error: `Template "${name}" already exists. Choose a different name.` });
    }

    // MSG91 (and Meta behind it) require an example for every media header component.
    if (header && header.format !== "TEXT") {
      if (!header.mediaUrl) {
        return reply.status(400).send({
          error: `A sample ${header.format.toLowerCase()} URL is required for media header templates. Upload a file or enter a publicly accessible URL in the Header section.`,
        });
      }
      if (isLocalhostUrl(header.mediaUrl)) {
        return reply.status(400).send({
          error: `The sample media URL must be publicly accessible — "localhost" cannot be reached by MSG91/Meta servers. Set BACKEND_PUBLIC_URL to a real public domain, or paste a URL from a public CDN/S3/Imgur in the "Enter URL" tab.`,
        });
      }
    }

    // Build MSG91 components array
    const components: Record<string, unknown>[] = [];

    if (header) {
      const hComp: Record<string, unknown> = { type: "HEADER", format: header.format };
      if (header.format === "TEXT" && header.text) {
        hComp.text = header.text;
        hComp.example = { header_text: [header.text] };
      } else if (header.format !== "TEXT" && header.mediaUrl) {
        // MSG91 does not use Meta's example.header_url nested format.
        // Pass the media URL as a flat example string — the format MSG91's
        // client-panel-template API actually accepts for media header samples.
        hComp.example = header.mediaUrl;
      }
      components.push(hComp);
    }

    const bodyVars = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => `sample_${m[1]}`);
    const bodyComp: Record<string, unknown> = { type: "BODY", text: body };
    if (bodyVars.length > 0) bodyComp.example = { body_text: [bodyVars] };
    components.push(bodyComp);

    if (footer) components.push({ type: "FOOTER", text: footer });

    const hasUrlButton = buttons?.some((b) => b.type === "URL") ?? false;
    if (buttons && buttons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: buttons.map((btn) => {
          if (btn.type === "URL") {
            const urlVars = [...btn.url.matchAll(/\{\{(\d+)\}\}/g)].map(() => btn.url.replace(/\{\{(\d+)\}\}/g, "sample"));
            return { type: "URL", text: btn.text, url: btn.url, ...(urlVars.length ? { example: urlVars } : {}) };
          }
          if (btn.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: btn.text, phone_number: btn.phone_number };
          return { type: "QUICK_REPLY", text: btn.text };
        }),
      });
    }

    const msg91Payload = {
      integrated_number: workspace.msg91IntegratedNumber.replace(/^\+/, ""),
      template_name:     name,
      language,
      category,
      ...(hasUrlButton ? { button_url: true } : {}),
      components,
    };
    console.log("[templates] MSG91 create payload:", JSON.stringify(msg91Payload, null, 2));

    try {
      const msg91Res = await axios.post(
        "https://control.msg91.com/api/v5/whatsapp/client-panel-template/",
        msg91Payload,
        { headers: { authkey: workspace.msg91AuthKey, "content-type": "application/json" }, timeout: 15_000 }
      );
      console.log("[templates] MSG91 create success:", JSON.stringify(msg91Res.data));
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: unknown; status?: number } };
      const d = axErr.response?.data as Record<string, unknown> | undefined;

      // Log the full raw response so we can see the real WhatsApp error
      console.error("[templates] MSG91 create error — HTTP", axErr.response?.status, "— full body:", JSON.stringify(d ?? {}));

      // Surface nested error strings (MSG91 wraps WhatsApp errors in various shapes)
      const rawMsg =
        (typeof d?.message === "string" && d.message) ||
        (typeof d?.error   === "string" && d.error)   ||
        (typeof d?.errors  === "string" && d.errors)  ||
        (typeof (d?.data as Record<string,unknown>)?.message === "string" && (d?.data as Record<string,unknown>).message as string) ||
        (typeof (d?.error as Record<string,unknown>)?.message === "string" && (d?.error as Record<string,unknown>).message as string) ||
        (d ? JSON.stringify(d) : null) ||
        `MSG91 API error (HTTP ${axErr.response?.status ?? "network error"})`;

      // MSG91 returns this generic string when WhatsApp itself rejected the template.
      // Give the user actionable guidance since MSG91 does not forward the real WhatsApp error.
      const msg = rawMsg === "invalid response from vendor"
        ? "WhatsApp rejected the template (MSG91 error: \"invalid response from vendor\"). Common causes: " +
          "(1) Template name already exists — try a different name. " +
          "(2) Body text is too short or low quality — use a real message (not \"test\"). " +
          "(3) The sample media URL is not publicly accessible — ensure the image/video link can be opened by anyone without login."
        : rawMsg;

      return reply.status(502).send({ error: msg });
    }

    // Save locally as PENDING so it appears in the list immediately while awaiting approval
    await prisma.customTemplate.upsert({
      where:  { workspaceId_name: { workspaceId: user.workspaceId, name } },
      create: { workspaceId: user.workspaceId, name, category, language, body, status: "PENDING" },
      update: { status: "PENDING", category, language, body },
    });

    return reply.status(201).send({
      message: "Template submitted to MSG91 for WhatsApp review. It will show as Pending until approved.",
    });
  });

  // ── POST /templates — create a new template (Meta only) ─────────────────────
  app.post("/", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;

    const schema = z.object({
      name: z
        .string()
        .min(1)
        .max(512)
        .regex(/^[a-z0-9_]+$/, "Template name may only contain lowercase letters, digits, and underscores"),
      category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
      language: z.string().min(2).max(10).default("en_US"),
      body: z.string().min(20, "Body must be at least 20 characters — Meta rejects short or test-like content").max(1024),
      footer: z.string().max(60).optional(),
      header: z
        .object({
          format: z.enum(["TEXT", "IMAGE", "VIDEO", "DOCUMENT"]),
          text: z.string().max(60).optional(),
          mediaUrl: z.string().url().optional(),
        })
        .optional(),
      buttons: z
        .array(
          z.union([
            z.object({ type: z.literal("QUICK_REPLY"), text: z.string().min(1).max(25) }),
            z.object({ type: z.literal("URL"), text: z.string().min(1).max(25), url: z.string().url() }),
            z.object({ type: z.literal("PHONE_NUMBER"), text: z.string().min(1).max(25), phone_number: z.string().min(7) }),
          ])
        )
        .max(10)
        .optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const workspace = decryptWsSecrets(await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { whatsappProvider: true, metaWabaId: true, metaAccessToken: true },
    }));

    if (!workspace) return reply.status(404).send({ error: "Workspace not found" });
    if (workspace.whatsappProvider !== "meta") {
      return reply.status(422).send({ error: "Template creation is only supported for Meta Cloud API. MSG91 templates must be created in the MSG91 dashboard." });
    }
    if (!workspace.metaWabaId || !workspace.metaAccessToken) {
      return reply.status(422).send({ error: "Meta WABA ID and Access Token required. Configure them in Settings → WhatsApp Provider." });
    }

    const { name, category, language, body, footer, header, buttons } = parsed.data;

    // Meta requires an example for every media header component.
    if (header && header.format !== "TEXT") {
      if (!header.mediaUrl) {
        return reply.status(400).send({
          error: `A sample ${header.format.toLowerCase()} URL is required for media header templates. Upload a file or enter a publicly accessible URL in the Header section.`,
        });
      }
      if (isLocalhostUrl(header.mediaUrl)) {
        return reply.status(400).send({
          error: `The sample media URL must be publicly accessible — "localhost" cannot be reached by Meta servers. Set BACKEND_PUBLIC_URL to a real public domain, or paste a URL from a public CDN/S3/Imgur in the "Enter URL" tab.`,
        });
      }
    }

    // Build components array for Meta API
    const components: object[] = [];
    if (header) {
      const hComp: Record<string, unknown> = { type: "HEADER", format: header.format };
      if (header.format === "TEXT" && header.text) {
        hComp.text = header.text;
      } else if (header.format !== "TEXT" && header.mediaUrl) {
        hComp.example = { header_handle: [header.mediaUrl] };
      }
      components.push(hComp);
    }
    components.push({ type: "BODY", text: body });
    if (footer) components.push({ type: "FOOTER", text: footer });
    if (buttons && buttons.length > 0) {
      components.push({ type: "BUTTONS", buttons });
    }

    try {
      const { data } = await axios.post(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${workspace.metaWabaId}/message_templates`,
        { name, category, language, components },
        { headers: { Authorization: `Bearer ${workspace.metaAccessToken}`, "Content-Type": "application/json" } }
      );

      return reply.status(201).send({
        message: "Template submitted for review. It will appear as PENDING until Meta approves it.",
        id: (data as { id?: string }).id,
        status: (data as { status?: string }).status ?? "PENDING",
        name,
        language,
        category,
      });
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { error?: { message?: string; error_user_msg?: string } } } };
      const msg =
        axErr.response?.data?.error?.error_user_msg ||
        axErr.response?.data?.error?.message ||
        "Failed to create template via Meta API";
      console.error("[templates] Meta create error:", msg);
      return reply.status(502).send({ error: msg });
    }
  });

  // ── DELETE /templates/:id — delete a template (Meta only) ──────────────────
  app.delete("/:name", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { name } = request.params as { name: string };

    const workspace = decryptWsSecrets(await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { whatsappProvider: true, metaWabaId: true, metaAccessToken: true },
    }));

    if (!workspace) return reply.status(404).send({ error: "Workspace not found" });
    if (workspace.whatsappProvider !== "meta") {
      return reply.status(422).send({ error: "Template deletion is only supported for Meta Cloud API." });
    }
    if (!workspace.metaWabaId || !workspace.metaAccessToken) {
      return reply.status(422).send({ error: "Meta WABA ID and Access Token required." });
    }

    try {
      await axios.delete(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${workspace.metaWabaId}/message_templates`,
        {
          params: { name },
          headers: { Authorization: `Bearer ${workspace.metaAccessToken}` },
        }
      );
      return reply.send({ message: "Template deleted" });
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { error?: { message?: string; error_user_msg?: string } } } };
      const msg =
        axErr.response?.data?.error?.error_user_msg ||
        axErr.response?.data?.error?.message ||
        "Failed to delete template via Meta API";
      console.error("[templates] Meta delete error:", msg);
      return reply.status(502).send({ error: msg });
    }
  });
}
