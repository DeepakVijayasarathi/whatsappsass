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
  const phoneNumberId = config.metaPhoneNumberId || process.env.META_PHONE_NUMBER_ID;
  const accessToken = config.metaAccessToken || process.env.META_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("Meta credentials not configured (META_PHONE_NUMBER_ID, META_ACCESS_TOKEN)");
  }

  const { data } = await axios.post(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
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
        Authorization: `Bearer ${accessToken}`,
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
  const authKey = config.msg91AuthKey || process.env.MSG91_AUTH_KEY;
  const integratedNumber =
    config.msg91IntegratedNumber || process.env.MSG91_INTEGRATED_NUMBER;

  if (!authKey || !integratedNumber) {
    throw new Error(
      "MSG91 credentials not configured (MSG91_AUTH_KEY, MSG91_INTEGRATED_NUMBER)"
    );
  }

  const { data } = await axios.post(
    "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
    {
      integrated_number: integratedNumber,
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
        authkey: authKey,
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
