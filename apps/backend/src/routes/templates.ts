import type { FastifyInstance } from "fastify";
import axios from "axios";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v19.0";
import { authenticate, requireOwnerOrAdmin } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";

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

async function fetchMsg91Templates(authKey: string, integratedNumber: string): Promise<NormalizedTemplate[]> {
  let data: unknown;
  let lastErr: unknown;
  // "No integration found" means the number format doesn't match MSG91's stored format.
  // Try all common format variants automatically.
  const numberFormats = numberCandidates(integratedNumber);

  for (const host of MSG91_TEMPLATE_HOSTS) {
    for (const numFormat of numberFormats) {
      try {
        // MSG91 uses "authkey" (no underscore) as the header name — same as the send API.
        // "auth_key" (with underscore) returns HTTP 401 even with a valid key.
        const res = await axios.get(
          `https://${host}/api/v5/whatsapp/get-template-plugins/`,
          {
            params: { number: numFormat },
            headers: { authkey: authKey },
            timeout: 15_000,
          }
        );
        console.log(`[templates] MSG91 success with number format: ${numFormat}`);
        data = res.data;
        lastErr = null;
        break; // success — stop trying formats
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number; data?: unknown }; code?: string };
        if (axiosErr.response) {
          // Got an HTTP response — this host works, analyse the error
          const status = axiosErr.response.status;
          const d = axiosErr.response.data as Record<string, unknown> | undefined;

          // 400 + "No integration found" → wrong number format, try next variant
          const errText = JSON.stringify(d);
          if (status === 400 && errText.includes("No integration found")) {
            console.warn(`[templates] MSG91 number format rejected (${numFormat}): ${errText} — trying next format`);
            lastErr = new Error(`No integration found for any number format tried. Last: ${numFormat}`);
            continue; // try next format
          }

          console.error(`[templates] MSG91 HTTP error (${host}):`, status, errText);

          // MSG91 response shape: { status:"fail", errors:"Unauthorized", apiError:"201" }
          // 401 always means the auth key is wrong or expired
          if (status === 401) {
            throw new Error("MSG91 Auth Key is invalid or expired. Go to Settings → WhatsApp Provider and re-enter your Auth Key.");
          }
          const msg =
            (typeof d?.message === "string" && d.message) ||
            (typeof d?.errors === "string" && d.errors) ||
            (typeof d?.error === "string" && d.error) ||
            `MSG91 API error (HTTP ${status})`;
          throw new Error(msg);
        }
        // DNS / connection error — try next host
        console.warn(`[templates] MSG91 host unreachable (${host}): ${(err as Error).message} — trying next`);
        lastErr = err;
        break; // no point trying more number formats if host is down
      }
    }
    if (data !== undefined) break; // found data, stop host loop
  }

  if (lastErr !== null && data === undefined) {
    const errMsg = (lastErr as Error).message ?? "Network error";
    // Check if all failures were "no integration found" — give a targeted message
    if (errMsg.includes("No integration found")) {
      const tried = numberCandidates(integratedNumber).join(", ");
      console.error(`[templates] MSG91 number not found after trying: ${tried}`);
      throw new Error(
        `MSG91: "No integration found" for any number format tried (${tried}). ` +
        `Please verify the Integrated Number in your MSG91 dashboard ` +
        `(control.msg91.com → WhatsApp → Integrations) and update it in Settings → WhatsApp Provider.`
      );
    }
    // Network error
    console.error("[templates] MSG91 host unreachable:", errMsg);
    throw new Error(`Cannot reach MSG91 API (${MSG91_TEMPLATE_HOSTS[0]}). Ensure your container has outbound internet access (DNS + HTTPS on port 443). Error: ${errMsg}`);
  }

  const d = data as Record<string, unknown>;

  // MSG91 returns HTTP 200 with an error body in several shapes:
  //   { type: "error", message: "..." }
  //   { status: "error", message: "..." }
  //   { code: 0, message: "..." }   (code 0 = failure, non-zero = success)
  //   { success: false, message: "..." }
  const isErrorBody =
    d?.type === "error" ||
    d?.status === "error" ||
    d?.success === false ||
    (typeof d?.code === "number" && d.code === 0 && !Array.isArray(d?.data));

  if (isErrorBody) {
    const msg =
      (typeof d.message === "string" && d.message) ||
      (typeof d.error === "string" && d.error) ||
      "MSG91 authentication failed";
    console.error("[templates] MSG91 auth error response:", JSON.stringify(d));
    throw new Error(msg);
  }

  // Support multiple response shapes:
  //   { data: [...] }   — most common
  //   { templates: [...] }
  //   [...]             — bare array
  const raw: unknown[] = Array.isArray(d?.data)
    ? (d.data as unknown[])
    : Array.isArray((d as Record<string, unknown>)?.templates)
    ? ((d as Record<string, unknown>).templates as unknown[])
    : Array.isArray(data)
    ? (data as unknown[])
    : [];

  console.log(`[templates] MSG91 fetched ${raw.length} templates`);

  return raw.map((t): NormalizedTemplate => {
    const item = t as Record<string, unknown>;
    const content = item.content as Record<string, unknown> | undefined;
    return {
      id: String(item.template_id ?? item.id ?? item._id ?? `msg91_${Date.now()}`),
      name: String(item.template_name ?? item.name ?? ""),
      status: String(item.state ?? item.status ?? "UNKNOWN").toUpperCase(),
      language: String(item.language ?? item.lang ?? "en"),
      category: String(item.category_name ?? item.category ?? "UTILITY"),
      body: item.body != null ? String(item.body)
          : content?.body != null ? String(content.body)
          : item.data != null ? String(item.data)
          : null,
      provider: "msg91",
    };
  });
}

export async function templateRoutes(app: FastifyInstance) {
  // GET /templates — fetch all templates from the configured provider
  app.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;

    const workspace = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: {
        whatsappProvider: true,
        metaWabaId: true,
        metaAccessToken: true,
        msg91AuthKey: true,
        msg91IntegratedNumber: true,
      },
    });

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
    try {
      const templates = await fetchMsg91Templates(workspace.msg91AuthKey, workspace.msg91IntegratedNumber);
      return reply.send({ templates, provider: "msg91", total: templates.length });
    } catch (err: unknown) {
      const msg = (err instanceof Error && err.message) || "Failed to fetch templates from MSG91";
      console.warn("[templates] MSG91 API fetch failed, falling back to custom DB templates:", msg);
      // Fall back to manually added templates from DB
      const custom = await prisma.customTemplate.findMany({
        where: { workspaceId: user.workspaceId },
        orderBy: { createdAt: "desc" },
      });
      if (custom.length > 0) {
        const templates: NormalizedTemplate[] = custom.map((t) => ({
          id: t.id, name: t.name, status: t.status,
          language: t.language, category: t.category, body: t.body, provider: "msg91",
        }));
        return reply.send({ templates, provider: "msg91", total: templates.length });
      }
      return reply.status(502).send({ error: msg });
    }
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

  // ── PUT /templates/custom/:id — update a custom template (MSG91) ────────────
  app.put("/custom/:id", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const schema = z.object({
      category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).optional(),
      language: z.string().min(2).max(10).optional(),
      body:     z.string().min(1).max(1024).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.customTemplate.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) return reply.status(404).send({ error: "Template not found" });

    const updated = await prisma.customTemplate.update({
      where: { id },
      data: parsed.data,
    });
    return reply.send(updated);
  });

  // ── DELETE /templates/custom/:id — delete a custom template (MSG91) ─────────
  app.delete("/custom/:id", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const existing = await prisma.customTemplate.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) return reply.status(404).send({ error: "Template not found" });
    await prisma.customTemplate.delete({ where: { id } });
    return reply.send({ message: "Template deleted" });
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
      body: z.string().min(1).max(1024),
      footer: z.string().max(60).optional(),
      header: z
        .object({
          format: z.enum(["TEXT", "IMAGE", "VIDEO", "DOCUMENT"]),
          text: z.string().max(60).optional(),
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

    const workspace = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { whatsappProvider: true, metaWabaId: true, metaAccessToken: true },
    });

    if (!workspace) return reply.status(404).send({ error: "Workspace not found" });
    if (workspace.whatsappProvider !== "meta") {
      return reply.status(422).send({ error: "Template creation is only supported for Meta Cloud API. MSG91 templates must be created in the MSG91 dashboard." });
    }
    if (!workspace.metaWabaId || !workspace.metaAccessToken) {
      return reply.status(422).send({ error: "Meta WABA ID and Access Token required. Configure them in Settings → WhatsApp Provider." });
    }

    const { name, category, language, body, footer, header, buttons } = parsed.data;

    // Build components array for Meta API
    const components: object[] = [];
    if (header) {
      const hComp: Record<string, unknown> = { type: "HEADER", format: header.format };
      if (header.format === "TEXT" && header.text) hComp.text = header.text;
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

    const workspace = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { whatsappProvider: true, metaWabaId: true, metaAccessToken: true },
    });

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
