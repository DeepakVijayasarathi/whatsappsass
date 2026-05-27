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

async function fetchMsg91Templates(authKey: string): Promise<NormalizedTemplate[]> {
  let data: unknown;
  try {
    const res = await axios.get(
      "https://api.msg91.com/api/v5/whatsapp/wa-template/",
      { headers: { authkey: authKey } }
    );
    data = res.data;
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number; data?: unknown } };
    if (axiosErr.response) {
      const d = axiosErr.response.data as Record<string, unknown> | undefined;
      const msg =
        (typeof d?.message === "string" && d.message) ||
        (typeof d?.error === "string" && d.error) ||
        `MSG91 API error (HTTP ${axiosErr.response.status})`;
      throw new Error(msg);
    }
    throw err;
  }

  const d = data as Record<string, unknown>;

  // MSG91 returns { type: "error", message: "..." } when auth fails
  if (d?.type === "error" || d?.status === "error") {
    const msg = typeof d.message === "string" ? d.message : "MSG91 authentication failed";
    throw new Error(msg);
  }

  const raw: unknown[] = Array.isArray(d?.data)
    ? (d.data as unknown[])
    : Array.isArray(data)
    ? (data as unknown[])
    : [];

  return raw.map((t): NormalizedTemplate => {
    const item = t as Record<string, unknown>;
    return {
      id: String(item.id ?? item.template_id ?? Math.random()),
      name: String(item.template_name ?? item.name ?? ""),
      status: String(item.status ?? "UNKNOWN").toUpperCase(),
      language: String(item.language ?? "en"),
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
      },
    });

    if (!workspace) return reply.status(404).send({ error: "Workspace not found" });

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
        const msg = (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ?? "Failed to fetch templates from Meta";
        return reply.status(502).send({ error: msg });
      }
    }

    // MSG91
    if (!workspace.msg91AuthKey) {
      return reply.status(422).send({
        error: "MSG91 Auth Key required. Configure it in Settings → WhatsApp Provider.",
      });
    }
    try {
      const templates = await fetchMsg91Templates(workspace.msg91AuthKey);
      return reply.send({ templates, provider: "msg91", total: templates.length });
    } catch (err: unknown) {
      const msg =
        (err instanceof Error && err.message) ||
        "Failed to fetch templates from MSG91";
      return reply.status(502).send({ error: msg });
    }
  });
}
