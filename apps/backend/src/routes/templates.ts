import type { FastifyInstance } from "fastify";
import axios from "axios";
import { prisma } from "../lib/prisma";
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
    `https://graph.facebook.com/v19.0/${wabaId}/message_templates`,
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
  const { data } = await axios.get(
    "https://api.msg91.com/api/v5/whatsapp/wa-template/",
    { headers: { authkey: authKey } }
  );

  const raw: unknown[] = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
    ? data
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
      const msg = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message ?? "Failed to fetch templates from MSG91";
      return reply.status(502).send({ error: msg });
    }
  });
}
