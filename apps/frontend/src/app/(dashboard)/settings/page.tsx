"use client";

import { useEffect, useRef, useState } from "react";
import { api, getErrMsg } from "@/lib/api";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, Key, Wifi, RefreshCw, Building2, Mail, CheckCircle2, UserCog, Eye, EyeOff, AlertTriangle, Clipboard, FlaskConical } from "lucide-react";
import clsx from "clsx";

const licenseSchema = z.object({
  key: z.string().regex(/^LITE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, "Invalid license key format"),
});
type LicenseForm = z.infer<typeof licenseSchema>;

// Plain type — no Zod schema for the provider form (validation done manually in saveProvider)
type ProviderForm = {
  whatsappProvider: "meta" | "msg91";
  metaPhoneNumberId: string;
  metaWabaId: string;
  metaAccessToken: string;
  metaWebhookVerifyToken: string;
  msg91AuthKey: string;
  msg91IntegratedNumber: string;
};

interface ProviderConfig {
  whatsappProvider: "meta" | "msg91";
  metaPhoneNumberId?: string | null;
  metaWabaId?: string | null;
  metaWebhookVerifyToken?: string | null;
  metaWebhookVerifyTokenHint?: string | null;
  msg91IntegratedNumber?: string | null;
  hasMetaAccessToken?: boolean;
  hasMsg91AuthKey?: boolean;
  metaAccessTokenHint?: string | null;
  msg91AuthKeyHint?: string | null;
  credentialDecryptError?: string | null;
}

export default function SettingsPage() {
  const [licenseStatus, setLicenseStatus] = useState<{
    status: string; plan?: string; expiryDate?: string;
  } | null>(null);
  const [metaEnabled, setMetaEnabled] = useState(false);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(null);
  const [toggling, setToggling] = useState(false);
  const [testingProvider, setTestingProvider] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"provider" | "email" | "workspace" | "account" | "license">("provider");

  const {
    register: regLicense,
    handleSubmit: handleLicense,
    formState: { errors: licenseErrors, isSubmitting: licenseSubmitting },
  } = useForm<LicenseForm>({ resolver: zodResolver(licenseSchema) });

  // Manual field errors — avoids any Zod/RHF validation running at page load or on reset()
  const [providerErrors, setProviderErrors] = useState<Partial<Record<keyof ProviderForm, string>>>({});

  const {
    register: regProvider,
    handleSubmit: handleProvider,
    watch,
    reset: resetProvider,
    formState: { isSubmitting: providerSubmitting },
  } = useForm<ProviderForm>({
    // No resolver — validation is done manually in saveProvider
    defaultValues: {
      whatsappProvider: "meta",
      metaPhoneNumberId: "",
      metaWabaId: "",
      metaAccessToken: "",
      metaWebhookVerifyToken: "",
      msg91AuthKey: "",
      msg91IntegratedNumber: "",
    },
  });

  const selectedProvider = watch("whatsappProvider");

  // DOM refs — read actual DOM values at submit time to bypass RHF reset() race and autofill gaps
  const metaAccessTokenRef = useRef<HTMLInputElement | null>(null);
  const msg91AuthKeyRef = useRef<HTMLInputElement | null>(null);
  const msg91IntegratedNumberRef = useRef<HTMLInputElement | null>(null);

  const loadStatus = () => {
    // Clear any stale errors immediately (before API resolves) so they never
    // show on page load or re-navigation within the dashboard layout.
    setProviderErrors({});
    Promise.all([
      api.get("/license/status"),
      api.get("/meta/status"),
      api.get("/workspace/provider"),
    ]).then(([lic, meta, prov]) => {
      setLicenseStatus(lic.data);
      setMetaEnabled(meta.data.metaWhatsappEnabled);
      setProviderConfig(prov.data);

      // Pre-fill non-secret fields
      const cfg: ProviderConfig = prov.data;

      // Reset form with server values and clear any stale errors atomically
      resetProvider({
        whatsappProvider: cfg.whatsappProvider,
        metaPhoneNumberId: cfg.metaPhoneNumberId ?? "",
        metaWabaId: cfg.metaWabaId ?? "",
        metaWebhookVerifyToken: cfg.metaWebhookVerifyToken ?? "",
        metaAccessToken: "",
        msg91IntegratedNumber: cfg.msg91IntegratedNumber ?? "",
        msg91AuthKey: "",
      });
      setProviderErrors({});
    }).catch(() => {
      toast.error("Failed to load settings — please refresh the page");
    });
  };

  useEffect(loadStatus, []);

  const activateLicense = async (data: LicenseForm) => {
    try {
      const res = await api.post("/license/activate", data);
      toast.success(`License activated! Plan: ${res.data.plan}`);
      loadStatus();
    } catch (err: unknown) {
      toast.error(getErrMsg(err, "Activation failed"));
    }
  };

  const saveProvider = async (data: ProviderForm) => {
    // Browser autofill sets DOM value without firing React onChange, so RHF may have stale
    // empty strings for secret fields. Read directly from DOM to get the real value.
    // Fields from unmounted conditional sections return undefined from RHF — normalise to ""
    const str = (v: string | undefined) => (v ?? "").trim();

    const domAccessToken = metaAccessTokenRef.current?.value ?? "";
    const domMsg91AuthKey = msg91AuthKeyRef.current?.value ?? "";
    const domMsg91Number = msg91IntegratedNumberRef.current?.value ?? "";
    const resolvedAccessToken = domAccessToken.trim() || str(data.metaAccessToken);
    const resolvedMsg91AuthKey = domMsg91AuthKey.trim() || str(data.msg91AuthKey);
    const resolvedMsg91Number = domMsg91Number.trim() || str(data.msg91IntegratedNumber);

    const payload: ProviderForm = {
      ...data,
      metaPhoneNumberId: data.metaPhoneNumberId ?? "",
      metaWabaId: data.metaWabaId ?? "",
      metaWebhookVerifyToken: data.metaWebhookVerifyToken ?? "",
      msg91IntegratedNumber: resolvedMsg91Number,
      metaAccessToken: resolvedAccessToken,
      msg91AuthKey: resolvedMsg91AuthKey,
    };

    // Manual validation — runs only on submit, never on load or reset
    const errs: Partial<Record<keyof ProviderForm, string>> = {};
    if (payload.whatsappProvider === "meta") {
      if (!str(payload.metaPhoneNumberId)) errs.metaPhoneNumberId = "Phone Number ID required";
      if (!str(payload.metaWabaId)) errs.metaWabaId = "WABA ID required";
      const hasToken = (str(payload.metaAccessToken).length > 0) || !!(providerConfig?.hasMetaAccessToken);
      if (!hasToken) errs.metaAccessToken = "Access Token required";
    } else {
      const hasAuthKey = (str(payload.msg91AuthKey).length > 0) || !!(providerConfig?.hasMsg91AuthKey);
      if (!hasAuthKey) errs.msg91AuthKey = "MSG91 Auth Key required";
      const hasNumber = (str(payload.msg91IntegratedNumber).length >= 7) || !!(providerConfig?.msg91IntegratedNumber);
      if (!hasNumber) errs.msg91IntegratedNumber = "Integrated number required (min 7 digits)";
    }
    if (Object.keys(errs).length > 0) { setProviderErrors(errs); return; }
    setProviderErrors({});
    try {
      await api.patch("/workspace/provider", payload);
      toast.success("Provider saved");
      setTestResult(null);
      loadStatus();
    } catch (err: unknown) {
      // Surface backend field-level validation errors when present
      const errData = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      if (errData && typeof errData === "object" && "fieldErrors" in errData) {
        const fieldErrors = (errData as { fieldErrors: Record<string, string[]> }).fieldErrors;
        const first = Object.values(fieldErrors).flat()[0];
        toast.error(first ?? "Validation failed — check your inputs");
      } else {
        toast.error(getErrMsg(err, "Failed to save provider"));
      }
    }
  };

  const testProviderCredentials = async () => {
    setTestingProvider(true);
    setTestResult(null);
    try {
      const r = await api.get("/templates");
      const count = r.data.total ?? (r.data.templates?.length ?? 0);
      const note = r.data.msg91Note;
      setTestResult({ ok: true, msg: note ? `Connected ✓ — ${note}` : `Connected ✓ — ${count} template${count !== 1 ? "s" : ""} found` });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Credentials test failed";
      setTestResult({ ok: false, msg });
    } finally {
      setTestingProvider(false);
    }
  };

  const toggleWhatsApp = async () => {
    setToggling(true);
    try {
      const res = await api.post("/meta/toggle", { enabled: !metaEnabled });
      setMetaEnabled(res.data.metaWhatsappEnabled);
      toast.success(res.data.message);
    } catch (err: unknown) {
      toast.error(getErrMsg(err, "Toggle failed"));
    } finally {
      setToggling(false);
    }
  };

  const tabs = [
    { id: "provider",  label: "WhatsApp Provider" },
    { id: "email",     label: "Email (SMTP)" },
    { id: "workspace", label: "Workspace" },
    { id: "account",   label: "Account" },
    { id: "license",   label: "License" },
  ] as const;

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage workspace configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "border-brand text-brand"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-xl space-y-6">
        {/* ── Provider tab ── */}
        {activeTab === "provider" && (
          <>
            {/* Enable / disable toggle + status */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
                    <Wifi className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">WhatsApp sending</p>
                    <p className="text-xs text-gray-400">
                      Provider:{" "}
                      <span className="font-medium capitalize">
                        {providerConfig?.whatsappProvider ?? "—"}
                      </span>
                    </p>
                  </div>
                </div>
                {/* Configuration completeness badge */}
                {providerConfig && (() => {
                  const isConfigured = providerConfig.whatsappProvider === "meta"
                    ? !!(providerConfig.hasMetaAccessToken && providerConfig.metaPhoneNumberId && providerConfig.metaWabaId)
                    : !!(providerConfig.hasMsg91AuthKey && providerConfig.msg91IntegratedNumber);
                  return isConfigured ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                      <CheckCircle2 className="w-3 h-3" /> Configured
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                      <AlertTriangle className="w-3 h-3" /> Credentials missing
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Enable sending</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {metaEnabled ? "Enabled — messages can be sent" : "Disabled — all sends are blocked"}
                  </p>
                </div>
                <button
                  onClick={toggleWhatsApp}
                  disabled={toggling}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                    metaEnabled ? "bg-brand" : "bg-gray-300"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${metaEnabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {providerConfig?.credentialDecryptError && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 mt-2">
                  ⚠ {providerConfig.credentialDecryptError}
                </p>
              )}
              {!metaEnabled && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  ⚠ WhatsApp sending is disabled. Configure your provider credentials below, then toggle this on.
                </p>
              )}
            </div>

            {/* Provider selection + credentials */}
            <div className="card">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Provider configuration</p>
                  <p className="text-xs text-gray-400">All credentials are stored per workspace</p>
                </div>
              </div>

              <form onSubmit={handleProvider(saveProvider)} className="space-y-4" autoComplete="off">
                {/* Provider toggle buttons */}
                <div className="grid grid-cols-2 gap-3">
                  {(["meta", "msg91"] as const).map((p) => (
                    <label
                      key={p}
                      className={clsx(
                        "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors",
                        selectedProvider === p
                          ? "border-brand bg-brand/5"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <input
                        {...regProvider("whatsappProvider")}
                        type="radio"
                        value={p}
                        className="accent-brand"
                        onChange={(e) => {
                          regProvider("whatsappProvider").onChange(e);
                          setProviderErrors({});
                          setTestResult(null);
                        }}
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 uppercase">{p}</p>
                        <p className="text-xs text-gray-400">
                          {p === "meta" ? "Meta WhatsApp Cloud API" : "MSG91 WhatsApp API"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Meta fields */}
                {selectedProvider === "meta" && (
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                    <Field
                      label="Phone Number ID"
                      placeholder="1234567890"
                      mono
                      {...regProvider("metaPhoneNumberId")}
                      onChange={(e) => { regProvider("metaPhoneNumberId").onChange(e); setProviderErrors((prev) => ({ ...prev, metaPhoneNumberId: undefined })); }}
                      error={providerErrors.metaPhoneNumberId}
                    />
                    <Field
                      label="WhatsApp Business Account (WABA) ID"
                      placeholder="102290129340823"
                      mono
                      {...regProvider("metaWabaId")}
                      onChange={(e) => { regProvider("metaWabaId").onChange(e); setProviderErrors((prev) => ({ ...prev, metaWabaId: undefined })); }}
                      error={providerErrors.metaWabaId}
                    />
                    <Field
                      label="Access Token"
                      placeholder={providerConfig?.hasMetaAccessToken ? "Leave blank to keep current token" : "EAAxxxxxxxx…"}
                      mono
                      type="password"
                      autoComplete="new-password"
                      {...regProvider("metaAccessToken")}
                      domRef={metaAccessTokenRef}
                      hint={providerConfig?.metaAccessTokenHint}
                      error={providerErrors.metaAccessToken}
                    />
                    <Field
                      label="Webhook Verify Token"
                      placeholder={providerConfig?.metaWebhookVerifyTokenHint ? "Leave blank to keep current token" : "my_random_verify_token"}
                      mono
                      type="password"
                      {...regProvider("metaWebhookVerifyToken")}
                      hint={providerConfig?.metaWebhookVerifyTokenHint}
                      error={providerErrors.metaWebhookVerifyToken}
                    />
                    <p className="text-xs text-gray-400">
                      Access Token is write-only. Leave blank to keep the stored token.
                    </p>
                  </div>
                )}

                {/* MSG91 fields */}
                {selectedProvider === "msg91" && (
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                    <Field
                      label="MSG91 Auth Key"
                      placeholder={providerConfig?.hasMsg91AuthKey ? "Leave blank to keep current key" : "Enter your MSG91 auth key"}
                      mono
                      type="password"
                      autoComplete="new-password"
                      {...regProvider("msg91AuthKey")}
                      domRef={msg91AuthKeyRef}
                      hint={providerConfig?.msg91AuthKeyHint}
                      error={providerErrors.msg91AuthKey}
                    />
                    <Field
                      label="Integrated Number"
                      placeholder="91XXXXXXXXXX"
                      autoComplete="off"
                      {...regProvider("msg91IntegratedNumber")}
                      domRef={msg91IntegratedNumberRef}
                      error={providerErrors.msg91IntegratedNumber}
                    />
                    <p className="text-xs text-gray-400">
                      Auth key is write-only — never returned by the server. Leave blank to keep the stored key.
                    </p>
                  </div>
                )}

                {/* Webhook URL hints */}
                {selectedProvider === "meta" && (
                  <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 space-y-2">
                    <p className="font-semibold">Meta Business Manager setup</p>
                    <p>In your <strong>Meta App → WhatsApp → Configuration</strong>, set:</p>
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-blue-100">
                      <code className="flex-1 font-mono text-[11px] text-blue-900 break-all">
                        {typeof window !== "undefined" ? window.location.origin : "https://yourdomain.com"}/api/whatsapp/webhook
                      </code>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/whatsapp/webhook`); toast.success("Copied!"); }}
                        className="shrink-0 text-blue-400 hover:text-blue-700"
                        title="Copy URL"
                      >
                        <Clipboard className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p>Use your <strong>Webhook Verify Token</strong> value above as the "Verify token" in Meta.</p>
                    <p>Subscribe to <code className="bg-blue-100 px-1 rounded">messages</code> and <code className="bg-blue-100 px-1 rounded">message_status_updates</code> fields.</p>
                  </div>
                )}

                {selectedProvider === "msg91" && (
                  <div className="p-3 bg-purple-50 rounded-xl text-xs text-purple-700 space-y-2">
                    <p className="font-semibold">MSG91 dashboard setup</p>
                    <p>In <strong>MSG91 → WhatsApp → Webhooks</strong>, set your delivery/inbound webhook to:</p>
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-purple-100">
                      <code className="flex-1 font-mono text-[11px] text-purple-900 break-all">
                        {typeof window !== "undefined" ? window.location.origin : "https://yourdomain.com"}/api/whatsapp/msg91-webhook
                      </code>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/whatsapp/msg91-webhook`); toast.success("Copied!"); }}
                        className="shrink-0 text-purple-400 hover:text-purple-700"
                        title="Copy URL"
                      >
                        <Clipboard className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p>This URL receives delivery receipts and inbound messages from MSG91.</p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button type="submit" disabled={providerSubmitting} className="btn-primary">
                    {providerSubmitting ? "Saving..." : "Save Provider"}
                  </button>
                  <button
                    type="button"
                    onClick={testProviderCredentials}
                    disabled={testingProvider || providerSubmitting}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <FlaskConical className="w-4 h-4" />
                    {testingProvider ? "Testing..." : "Test credentials"}
                  </button>
                </div>

                {/* Test result */}
                {testResult && (
                  <div className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2 ${testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {testResult.ok
                      ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                      : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span>{testResult.msg}</span>
                  </div>
                )}
              </form>
            </div>
          </>
        )}

        {/* ── Email tab ── */}
        {activeTab === "email" && <EmailSettings />}

        {/* ── Workspace tab ── */}
        {activeTab === "workspace" && (
          <WorkspaceSettings />
        )}

        {/* ── Account tab ── */}
        {activeTab === "account" && <AccountSettings />}

        {/* ── License tab ── */}
        {activeTab === "license" && (
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                <Key className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">License Key</p>
                <p className="text-xs text-gray-400">Format: LITE-XXXX-XXXX-XXXX</p>
              </div>
            </div>

            {licenseStatus && licenseStatus.status !== "no_license" && (
              <div className="p-3 bg-green-50 rounded-lg mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    Active — {licenseStatus.plan ?? "lite"} plan
                  </p>
                  {licenseStatus.expiryDate && (
                    <p className="text-xs text-green-600">
                      Expires: {new Date(licenseStatus.expiryDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleLicense(activateLicense)} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  License key
                </label>
                <input
                  {...regLicense("key")}
                  className="input font-mono"
                  placeholder="LITE-XXXX-XXXX-XXXX"
                />
                {licenseErrors.key && (
                  <p className="text-red-500 text-xs mt-1">{licenseErrors.key.message}</p>
                )}
              </div>
              <button type="submit" disabled={licenseSubmitting} className="btn-primary">
                {licenseSubmitting ? "Activating..." : "Activate License"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reusable field component ───────────────────────────────────────────────────
function Field({
  label,
  error,
  mono,
  domRef,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  mono?: boolean;
  hint?: string | null;
  // Extra DOM ref for reading autofilled values that bypass React onChange
  domRef?: React.MutableRefObject<HTMLInputElement | null>;
}) {
  const [showSecret, setShowSecret] = useState(false);
  const isSecret = props.type === "password";
  const { ref: rhfRef, type, ...restProps } = props as typeof props & { ref?: React.Ref<HTMLInputElement> };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          className={clsx("input pr-9", mono && "font-mono text-xs")}
          type={isSecret && !showSecret ? "password" : "text"}
          {...restProps}
          ref={(el: HTMLInputElement | null) => {
            if (typeof rhfRef === "function") rhfRef(el);
            else if (rhfRef && "current" in rhfRef) (rhfRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
            if (domRef) domRef.current = el;
          }}
        />
        {isSecret && (
          <button
            type="button"
            onClick={() => setShowSecret((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
            title={showSecret ? "Hide" : "Show"}
          >
            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {hint && (
        <p className="text-[11px] text-gray-400 mt-1 font-mono flex items-center gap-1">
          <span className="text-green-600">✓ Stored:</span> {hint}
        </p>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ── Workspace settings sub-component ──────────────────────────────────────────
function WorkspaceSettings() {
  const [workspace, setWorkspace] = useState<{
    id: string; name: string; plan: string; status: string; createdAt: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    api.get("/workspace/me").then((r) => {
      setWorkspace(r.data);
      setName(r.data.name);
    });
  }, []);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.patch("/workspace/me", { name: name.trim() });
      toast.success("Workspace name updated");
      setWorkspace((w) => w ? { ...w, name: name.trim() } : w);
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  if (!workspace) return <p className="text-gray-400 text-sm">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Workspace</p>
            <p className="text-xs text-gray-400">Manage your workspace details</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Workspace name</label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input flex-1"
                placeholder="My Business"
              />
              <button onClick={save} disabled={saving || name === workspace.name} className="btn-primary shrink-0">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            {[
              { label: "Workspace ID", value: workspace.id, mono: true },
              { label: "Plan", value: workspace.plan.toUpperCase() },
              { label: "Status", value: workspace.status },
              { label: "Created", value: new Date(workspace.createdAt).toLocaleDateString() },
            ].map(({ label, value, mono }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className={clsx("text-sm text-gray-700 truncate", mono && "font-mono text-xs")}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Account / password settings sub-component ─────────────────────────────────
function AccountSettings() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Password fields are optional — user can rename without changing password.
  // If newPassword is provided, currentPassword is required.
  const schema = z.object({
    name:            z.string().min(1, "Name is required"),
    currentPassword: z.string().optional(),
    newPassword:     z.string().optional(),
    confirmPassword: z.string().optional(),
  }).superRefine((d, ctx) => {
    if (d.newPassword) {
      if (d.newPassword.length < 8) {
        ctx.addIssue({ code: "custom", path: ["newPassword"], message: "At least 8 characters" });
      }
      if (!d.currentPassword) {
        ctx.addIssue({ code: "custom", path: ["currentPassword"], message: "Enter your current password" });
      }
      if (d.newPassword !== d.confirmPassword) {
        ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
      }
    }
  });
  type AccountForm = z.infer<typeof schema>;

  // Load current user name
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AccountForm>({
    resolver: zodResolver(schema),
    defaultValues: async () => {
      try {
        const r = await api.get("/workspace/profile");
        return { name: r.data.name ?? "", currentPassword: "", newPassword: "", confirmPassword: "" };
      } catch {
        return { name: "", currentPassword: "", newPassword: "", confirmPassword: "" };
      }
    },
  });

  const save = async (data: AccountForm) => {
    try {
      const payload: Record<string, string> = { name: data.name.trim() };
      // Only include password fields when the user is intentionally changing their password
      if (data.newPassword) {
        payload.currentPassword = data.currentPassword ?? "";
        payload.newPassword = data.newPassword;
      }
      await api.patch("/workspace/profile", payload);
      toast.success(data.newPassword ? "Profile and password updated" : "Display name updated");
      reset({ name: data.name.trim(), currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: unknown) {
      toast.error(getErrMsg(err, "Failed to update account"));
    }
  };

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
          <UserCog className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">Account</p>
          <p className="text-xs text-gray-400">Update your display name and password</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(save)} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
          <input {...register("name")} className="input" placeholder="Your name" />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Change password</p>

          {/* Current password */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
              <div className="relative">
                <input
                  {...register("currentPassword")}
                  type={showCurrent ? "text" : "password"}
                  className="input pr-10"
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.currentPassword && <p className="text-red-500 text-xs mt-1">{errors.currentPassword.message}</p>}
            </div>

            {/* New password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <div className="relative">
                <input
                  {...register("newPassword")}
                  type={showNew ? "text" : "password"}
                  className="input pr-10"
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.newPassword && <p className="text-red-500 text-xs mt-1">{errors.newPassword.message}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <div className="relative">
                <input
                  {...register("confirmPassword")}
                  type={showConfirm ? "text" : "password"}
                  className="input pr-10"
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
            </div>
          </div>
        </div>

        <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
          Default credentials are <span className="font-mono font-semibold">admin@demo.com / admin123</span> — change your password immediately after first login.
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}

// ── Email / SMTP settings sub-component ───────────────────────────────────────
function EmailSettings() {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [smtpPassHint, setSmtpPassHint] = useState<string | null>(null);

  const schema = z.object({
    smtpHost:      z.string().min(1, "Host required"),
    smtpPort:      z.coerce.number().int().min(1).max(65535).default(587),
    smtpUser:      z.string().min(1, "Username required"),
    smtpPass:      z.string().optional(),
    smtpFromEmail: z.string().email("Invalid from email"),
    smtpFromName:  z.string().optional(),
  });
  type SmtpForm = z.infer<typeof schema>;

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<SmtpForm>({
    resolver: zodResolver(schema),
    defaultValues: async () => {
      try {
        const res = await api.get("/workspace/smtp");
        setSmtpPassHint(res.data.smtpPassHint ?? null);
        return { smtpPort: 587, ...res.data, smtpPass: "" };
      } catch {
        return { smtpPort: 587, smtpHost: "", smtpUser: "", smtpPass: "", smtpFromEmail: "", smtpFromName: "" };
      }
    },
  });

  const save = async (data: SmtpForm) => {
    setSaving(true);
    setTestOk(null);
    try {
      await api.patch("/workspace/smtp", data);
      toast.success("Email config saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    const data = getValues();
    setSaving(true);
    try {
      await api.patch("/workspace/smtp", data);
    } catch { /* save first silently */ }
    setTesting(true);
    setSaving(false);
    try {
      await api.post("/email/smtp/test", {});
      setTestOk(true);
      toast.success("SMTP connection verified");
    } catch (err: unknown) {
      setTestOk(false);
      toast.error(getErrMsg(err, "SMTP test failed"));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
          <Mail className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">Email / SMTP Configuration</p>
          <p className="text-xs text-gray-400">Used for email campaigns and transactional emails</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(save)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
            <input {...register("smtpHost")} className="input font-mono" placeholder="smtp.gmail.com" />
            {errors.smtpHost && <p className="text-red-500 text-xs mt-1">{errors.smtpHost.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
            <input {...register("smtpPort")} type="number" className="input font-mono" placeholder="587" />
            {errors.smtpPort && <p className="text-red-500 text-xs mt-1">{errors.smtpPort.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username / Email</label>
            <input {...register("smtpUser")} className="input" placeholder="you@gmail.com" />
            {errors.smtpUser && <p className="text-red-500 text-xs mt-1">{errors.smtpUser.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password / App Password</label>
            <div className="relative">
              <input
                {...register("smtpPass")}
                type={showSmtpPass ? "text" : "password"}
                className="input pr-9"
                placeholder={smtpPassHint ? "Leave blank to keep current password" : "App password"}
              />
              <button type="button" onClick={() => setShowSmtpPass((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {smtpPassHint && (
              <p className="text-[11px] text-gray-400 mt-1 font-mono flex items-center gap-1">
                <span className="text-green-600">✓ Stored:</span> {smtpPassHint}
              </p>
            )}
            {errors.smtpPass && <p className="text-red-500 text-xs mt-1">{errors.smtpPass.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
            <input {...register("smtpFromEmail")} className="input" placeholder="noreply@yourbrand.com" />
            {errors.smtpFromEmail && <p className="text-red-500 text-xs mt-1">{errors.smtpFromEmail.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Name (optional)</label>
            <input {...register("smtpFromName")} className="input" placeholder="Your Brand" />
          </div>
        </div>

        <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
          For Gmail, use an <strong>App Password</strong> (not your main password). Enable 2FA first, then generate at Google Account → Security → App passwords.
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save Config"}
          </button>
          <button type="button" onClick={testConnection} disabled={testing || saving} className="btn-secondary flex items-center gap-2">
            {testing ? "Testing..." : "Test Connection"}
          </button>
          {testOk === true && <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle2 className="w-4 h-4" />Connected</span>}
          {testOk === false && <span className="text-sm text-red-500">Connection failed</span>}
        </div>
      </form>
    </div>
  );
}
