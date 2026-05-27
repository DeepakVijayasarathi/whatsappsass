import type { FastifyInstance } from "fastify";
import axios from "axios";
import { prisma } from "../lib/prisma";

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v19.0";
import { authenticate } from "../middleware/authenticate";
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

async function fetchMsg91Templates(authKey: string, integratedNumber: string): Promise<NormalizedTemplate[]> {
  let data: unknown;
  try {
    // Correct endpoint: control.msg01.com (not api.msg91.com)
    // Requires ?number=<integrated_number> and auth_key header
    const res = await axios.get(
      "https://control.msg01.com/api/v5/whatsapp/get-template-plugins/",
      {
        params: { number: integratedNumber },
        headers: { auth_key: authKey },
      }
    );
    data = res.data;
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number; data?: unknown } };
    if (axiosErr.response) {
      const d = axiosErr.response.data as Record<string, unknown> | undefined;
      // MSG91 often returns HTTP 401/403 with { type: "error", message: "..." }
      const msg =
        (typeof d?.message === "string" && d.message) ||
        (typeof d?.error === "string" && d.error) ||
        `MSG91 API error (HTTP ${axiosErr.response.status})`;
      console.error("[templates] MSG91 HTTP error (control.msg01.com):", axiosErr.response.status, JSON.stringify(d));
      throw new Error(msg);
    }
    throw err;
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
    return {
      id: String(item.id ?? item.template_id ?? item._id ?? Math.random()),
      name: String(item.template_name ?? item.name ?? ""),
      status: String(item.status ?? "UNKNOWN").toUpperCase(),
      language: String(item.language ?? item.lang ?? "en"),
      category: String(item.category ?? "UTILITY"),
      body: item.body != null ? String(item.body) : item.data != null ? String(item.data) : null,
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

    // MSG91
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
      const msg =
        (err instanceof Error && err.message) ||
        "Failed to fetch templates from MSG91";
      // Log the full error so it appears in container logs for debugging
      console.error("[templates] MSG91 fetch failed:", msg);
      return reply.status(502).send({ error: msg });
    }
  });
}
