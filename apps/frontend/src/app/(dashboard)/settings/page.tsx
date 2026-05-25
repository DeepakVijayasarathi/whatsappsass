"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, Key, Wifi, RefreshCw, Building2, Mail, CheckCircle2, UserCog, Eye, EyeOff } from "lucide-react";
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
  msg91IntegratedNumber?: string | null;
  hasMetaAccessToken?: boolean;
  hasMsg91AuthKey?: boolean;
}

export default function SettingsPage() {
  const [licenseStatus, setLicenseStatus] = useState<{
    status: string; plan?: string; expiryDate?: string;
  } | null>(null);
  const [metaEnabled, setMetaEnabled] = useState(false);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(null);
  const [toggling, setToggling] = useState(false);
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
      toast.error(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
          "Activation failed"
      );
    }
  };

  const saveProvider = async (data: ProviderForm) => {
    // Manual validation — runs only on submit, never on load or reset
    const errs: Partial<Record<keyof ProviderForm, string>> = {};
    if (data.whatsappProvider === "meta") {
      if (!data.metaPhoneNumberId.trim()) errs.metaPhoneNumberId = "Phone Number ID required";
      if (!data.metaWabaId.trim()) errs.metaWabaId = "WABA ID required";
      const hasToken = (data.metaAccessToken.trim().length > 0) || !!(providerConfig?.hasMetaAccessToken);
      if (!hasToken) errs.metaAccessToken = "Access Token required";
      const hasVerifyToken = (data.metaWebhookVerifyToken.trim().length > 0) || !!(providerConfig?.metaWebhookVerifyToken);
      if (!hasVerifyToken) errs.metaWebhookVerifyToken = "Webhook Verify Token required";
    } else {
      const hasAuthKey = (data.msg91AuthKey.trim().length > 0) || !!(providerConfig?.hasMsg91AuthKey);
      if (!hasAuthKey) errs.msg91AuthKey = "MSG91 Auth Key required";
      const hasNumber = (data.msg91IntegratedNumber.trim().length >= 7) || !!(providerConfig?.msg91IntegratedNumber);
      if (!hasNumber) errs.msg91IntegratedNumber = "Integrated number required (min 7 digits)";
    }
    if (Object.keys(errs).length > 0) { setProviderErrors(errs); return; }
    setProviderErrors({});
    try {
      await api.patch("/workspace/provider", data);
      toast.success("Provider saved");
      loadStatus();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
          "Failed to save provider"
      );
    }
  };

  const toggleWhatsApp = async () => {
    setToggling(true);
    try {
      const res = await api.post("/meta/toggle", { enabled: !metaEnabled });
      setMetaEnabled(res.data.metaWhatsappEnabled);
      toast.success(res.data.message);
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
          "Toggle failed"
      );
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
            {/* Enable / disable toggle */}
            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">WhatsApp API toggle</p>
                  <p className="text-xs text-gray-400">
                    Current provider:{" "}
                    <span className="font-medium capitalize">
                      {providerConfig?.whatsappProvider ?? "—"}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Send messages</p>
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
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      metaEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
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
                      error={providerErrors.metaPhoneNumberId}
                    />
                    <Field
                      label="WhatsApp Business Account (WABA) ID"
                      placeholder="102290129340823"
                      mono
                      {...regProvider("metaWabaId")}
                      error={providerErrors.metaWabaId}
                    />
                    <Field
                      label={providerConfig?.hasMetaAccessToken
                        ? "Access Token (stored ✓ — leave blank to keep)"
                        : "Access Token"}
                      placeholder={providerConfig?.hasMetaAccessToken
                        ? "••••••••  (only fill to change)"
                        : "EAAxxxxxxxx…"}
                      mono
                      type="password"
                      autoComplete="new-password"
                      {...regProvider("metaAccessToken")}
                      error={providerErrors.metaAccessToken}
                    />
                    <Field
                      label="Webhook Verify Token (leave blank to keep existing)"
                      placeholder="my_random_verify_token  (only fill to change)"
                      mono
                      {...regProvider("metaWebhookVerifyToken")}
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
                      label={providerConfig?.hasMsg91AuthKey
                        ? "MSG91 Auth Key (stored ✓ — leave blank to keep)"
                        : "MSG91 Auth Key"}
                      placeholder={providerConfig?.hasMsg91AuthKey
                        ? "••••••••  (only fill to change)"
                        : "Enter your MSG91 auth key"}
                      mono
                      type="password"
                      autoComplete="new-password"
                      {...regProvider("msg91AuthKey")}
                      error={providerErrors.msg91AuthKey}
                    />
                    <Field
                      label="Integrated Number"
                      placeholder="91XXXXXXXXXX"
                      autoComplete="off"
                      {...regProvider("msg91IntegratedNumber")}
                      error={providerErrors.msg91IntegratedNumber}
                    />
                    <p className="text-xs text-gray-400">
                      Auth key is write-only — never returned by the server. Leave blank to keep the stored key.
                    </p>
                  </div>
                )}

                <button type="submit" disabled={providerSubmitting} className="btn-primary">
                  {providerSubmitting ? "Saving..." : "Save Provider"}
                </button>
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
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; mono?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input className={clsx("input", mono && "font-mono text-xs")} {...props} />
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

  const schema = z.object({
    name:            z.string().min(1, "Name is required"),
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword:     z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  }).refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
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
      await api.patch("/workspace/profile", {
        name: data.name.trim(),
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success("Password changed successfully");
      reset({ name: data.name.trim(), currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
          "Failed to update account"
      );
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

  const schema = z.object({
    smtpHost:      z.string().min(1, "Host required"),
    smtpPort:      z.coerce.number().int().min(1).max(65535).default(587),
    smtpUser:      z.string().min(1, "Username required"),
    smtpPass:      z.string().min(1, "Password required"),
    smtpFromEmail: z.string().email("Invalid from email"),
    smtpFromName:  z.string().optional(),
  });
  type SmtpForm = z.infer<typeof schema>;

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<SmtpForm>({
    resolver: zodResolver(schema),
    defaultValues: async () => {
      try {
        const res = await api.get("/workspace/smtp");
        return { smtpPort: 587, ...res.data };
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
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error || "SMTP test failed");
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
            <input {...register("smtpPass")} type="password" className="input" placeholder="••••••••" />
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
