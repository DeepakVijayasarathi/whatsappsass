import axios from "axios";

export type WhatsappProvider = "meta" | "msg91";

export interface SendTemplateOptions {
  to: string;
  templateName: string;
  languageCode: string;
  components?: unknown[];
}

export interface ProviderConfig {
  provider: WhatsappProvider;
  // Meta
  metaPhoneNumberId?: string;
  metaAccessToken?: string;
  // MSG91
  msg91AuthKey?: string;
  msg91IntegratedNumber?: string;
}

export interface SendResult {
  provider: WhatsappProvider;
  raw: unknown;
}

// ── Meta WhatsApp Cloud API ──────────────────────────────────────────────────
async function sendViaMeta(
  opts: SendTemplateOptions,
  config: ProviderConfig
): Promise<SendResult> {
  const { metaPhoneNumberId, metaAccessToken } = config;

  if (!metaPhoneNumberId || !metaAccessToken) {
    throw new Error("Meta credentials not configured for this workspace");
  }

  const { data } = await axios.post(
    `https://graph.facebook.com/v19.0/${metaPhoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      to: opts.to,
      type: "template",
      template: {
        name: opts.templateName,
        language: { code: opts.languageCode },
        components: opts.components ?? [],
      },
    },
    {
      headers: {
        Authorization: `Bearer ${metaAccessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  return { provider: "meta", raw: data };
}

// ── MSG91 WhatsApp API ───────────────────────────────────────────────────────
async function sendViaMsg91(
  opts: SendTemplateOptions,
  config: ProviderConfig
): Promise<SendResult> {
  const { msg91AuthKey, msg91IntegratedNumber } = config;

  if (!msg91AuthKey || !msg91IntegratedNumber) {
    throw new Error("MSG91 credentials not configured for this workspace");
  }

  const { data } = await axios.post(
    "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
    {
      integrated_number: msg91IntegratedNumber,
      content_type: "template",
      payload: {
        to: opts.to,
        type: "template",
        template: {
          name: opts.templateName,
          language: { code: opts.languageCode },
          components: opts.components ?? [],
        },
      },
    },
    {
      headers: {
        authkey: msg91AuthKey,
        "Content-Type": "application/json",
      },
    }
  );

  return { provider: "msg91", raw: data };
}

// ── Unified send function ────────────────────────────────────────────────────
export async function sendWhatsAppTemplate(
  opts: SendTemplateOptions,
  config: ProviderConfig
): Promise<SendResult> {
  if (config.provider === "msg91") {
    return sendViaMsg91(opts, config);
  }
  return sendViaMeta(opts, config);
}
