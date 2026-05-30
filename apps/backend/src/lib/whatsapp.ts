import axios from "axios";

export type WhatsappProvider = "meta" | "msg91";

// Configurable via META_GRAPH_VERSION env var — update when Meta deprecates old versions
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v19.0";

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
  /** Provider-assigned message ID — used to match delivery receipts back to MessageLog rows */
  wamid: string | null;
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
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${metaPhoneNumberId}/messages`,
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

  // Meta response: { messages: [{ id: "wamid.xxx" }] }
  const wamid = (data as { messages?: Array<{ id: string }> })?.messages?.[0]?.id ?? null;
  return { provider: "meta", wamid, raw: data };
}

// ── MSG91 phone helper ────────────────────────────────────────────────────────
// MSG91's API requires phone numbers WITHOUT the leading '+'.
// E.g. "+919876543210" → "919876543210"
function stripPlusForMsg91(phone: string): string {
  return phone.startsWith("+") ? phone.slice(1) : phone;
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

  // MSG91 requires phone numbers WITHOUT a leading '+'.
  const toPhone = stripPlusForMsg91(opts.to);

  // MSG91 bulk template API:
  // https://docs.msg91.com/whatsapp/template-bulk
  // The recipient phone and per-recipient components go inside
  // payload.template.to_and_components[], NOT at the top level of payload.
  const toAndComponents: { to: string[]; components: Record<string, unknown> } = {
    to: [toPhone],
    components: {},
  };

  // If caller supplies Meta-style components array, convert to MSG91's
  // { body_1: { type, value }, button_1: { ... } } keyed object.
  // For simple sends with no variable components this stays empty ({}).
  if (opts.components && opts.components.length > 0) {
    let bodyIdx = 1;
    let buttonIdx = 1;
    for (const comp of opts.components as Array<Record<string, unknown>>) {
      if (comp.type === "body") {
        const params = (comp.parameters as Array<Record<string, unknown>>) ?? [];
        for (const p of params) {
          toAndComponents.components[`body_${bodyIdx}`] = {
            type: p.type ?? "text",
            value: p.text ?? p.payload ?? "",
          };
          bodyIdx++;
        }
      } else if (comp.type === "button") {
        const params = (comp.parameters as Array<Record<string, unknown>>) ?? [];
        for (const p of params) {
          toAndComponents.components[`button_${buttonIdx}`] = {
            subtype: comp.sub_type ?? "url",
            type: p.type ?? "text",
            value: p.text ?? p.payload ?? "",
          };
          buttonIdx++;
        }
      }
    }
  }

  let data: unknown;
  try {
    const res = await axios.post(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        // MSG91 integrated_number must also have no '+' prefix
        integrated_number: stripPlusForMsg91(msg91IntegratedNumber),
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: opts.templateName,
            language: { code: opts.languageCode, policy: "deterministic" },
            to_and_components: [toAndComponents],
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
    data = res.data;
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number; data?: unknown } };
    if (axiosErr.response) {
      const status = axiosErr.response.status;
      const d = axiosErr.response.data as Record<string, unknown> | undefined;
      console.error("[whatsapp] MSG91 send HTTP error:", status, JSON.stringify(d));
      if (status === 401) {
        throw new Error("MSG91 Auth Key is invalid or expired. Go to Settings → WhatsApp Provider and re-enter your Auth Key.");
      }
      const msg =
        (typeof d?.message === "string" && d.message) ||
        (typeof d?.errors === "string" && d.errors) ||
        (typeof d?.error === "string" && d.error) ||
        `MSG91 send error (HTTP ${status})`;
      throw new Error(msg);
    }
    throw err;
  }

  // MSG91 sometimes returns HTTP 200 with an error body:
  //   { type: "error", message: "..." }
  //   { status: "error", message: "..." }
  //   { success: false, message: "..." }
  //   { code: 0, message: "..." }  (code 0 = failure)
  type Msg91Response = { type?: string; status?: string; success?: boolean; code?: number; request_id?: string; msgid?: string; message?: string; error?: string; data?: { request_id?: string } };
  const d = data as Msg91Response;

  const isErrorBody =
    d?.type === "error" ||
    d?.status === "error" ||
    d?.success === false ||
    (typeof d?.code === "number" && d.code === 0);

  if (isErrorBody) {
    const msg =
      (typeof d.message === "string" && d.message) ||
      (typeof d.error === "string" && d.error) ||
      "MSG91 rejected the send request";
    console.error("[whatsapp] MSG91 send error body:", JSON.stringify(d));
    throw new Error(msg);
  }

  // MSG91 response: { type: "success", request_id: "...", message: "..." }
  // or nested: { data: { request_id: "..." } }
  const wamid = d?.request_id ?? d?.data?.request_id ?? d?.msgid ?? null;
  return { provider: "msg91", wamid, raw: data };
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

// ── MSG91 session message (free-form text, after user has messaged first) ────
export interface SessionMessageOptions {
  to: string;
  text: string;
}

export async function sendMsg91Session(
  opts: SessionMessageOptions,
  config: ProviderConfig
): Promise<SendResult> {
  const { msg91AuthKey, msg91IntegratedNumber } = config;
  if (!msg91AuthKey || !msg91IntegratedNumber) {
    throw new Error("MSG91 credentials not configured");
  }
  const { data } = await axios.get(
    "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/",
    {
      params: {
        integrated_number: stripPlusForMsg91(msg91IntegratedNumber),
        recipient_number:  stripPlusForMsg91(opts.to),
        content_type:      "text",
        text:              opts.text,
      },
      headers: { authkey: msg91AuthKey, accept: "application/json" },
    }
  );
  const d = data as { request_id?: string; msgid?: string };
  return { provider: "msg91", wamid: d?.request_id ?? d?.msgid ?? null, raw: data };
}

// ── MSG91 interactive message (buttons / list / location / payment) ──────────
export interface InteractiveOptions {
  to: string;
  interactive: Record<string, unknown>;
}

export async function sendMsg91Interactive(
  opts: InteractiveOptions,
  config: ProviderConfig
): Promise<SendResult> {
  const { msg91AuthKey, msg91IntegratedNumber } = config;
  if (!msg91AuthKey || !msg91IntegratedNumber) {
    throw new Error("MSG91 credentials not configured");
  }
  const { data } = await axios.post(
    "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/",
    {
      integrated_number: stripPlusForMsg91(msg91IntegratedNumber),
      recipient_number:  stripPlusForMsg91(opts.to),
      content_type:      "interactive",
      interactive:       opts.interactive,
    },
    { headers: { authkey: msg91AuthKey, "Content-Type": "application/json" } }
  );
  const d = data as { request_id?: string; msgid?: string };
  return { provider: "msg91", wamid: d?.request_id ?? d?.msgid ?? null, raw: data };
}
