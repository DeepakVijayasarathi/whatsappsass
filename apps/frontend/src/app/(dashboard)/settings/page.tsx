"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, Key, Wifi, RefreshCw } from "lucide-react";
import clsx from "clsx";

const licenseSchema = z.object({
  key: z.string().regex(/^LITE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, "Invalid license key format"),
});
type LicenseForm = z.infer<typeof licenseSchema>;

const providerSchema = z.discriminatedUnion("whatsappProvider", [
  z.object({
    whatsappProvider: z.literal("meta"),
  }),
  z.object({
    whatsappProvider: z.literal("msg91"),
    msg91AuthKey: z.string().min(1, "Auth key required"),
    msg91IntegratedNumber: z.string().min(7, "Integrated number required"),
  }),
]);
type ProviderForm = z.infer<typeof providerSchema>;

interface ProviderConfig {
  whatsappProvider: "meta" | "msg91";
  msg91IntegratedNumber?: string | null;
}

export default function SettingsPage() {
  const [licenseStatus, setLicenseStatus] = useState<{
    status: string; plan?: string; expiryDate?: string;
  } | null>(null);
  const [metaEnabled, setMetaEnabled] = useState(false);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(null);
  const [toggling, setToggling] = useState(false);
  const [activeTab, setActiveTab] = useState<"provider" | "license">("provider");

  const {
    register: regLicense,
    handleSubmit: handleLicense,
    formState: { errors: licenseErrors, isSubmitting: licenseSubmitting },
  } = useForm<LicenseForm>({ resolver: zodResolver(licenseSchema) });

  const {
    register: regProvider,
    handleSubmit: handleProvider,
    watch,
    formState: { errors: providerErrors, isSubmitting: providerSubmitting },
  } = useForm<ProviderForm>({
    resolver: zodResolver(providerSchema),
    defaultValues: { whatsappProvider: "meta" },
  });

  const selectedProvider = watch("whatsappProvider");

  const loadStatus = () => {
    Promise.all([
      api.get("/license/status"),
      api.get("/meta/status"),
      api.get("/workspace/provider"),
    ]).then(([lic, meta, prov]) => {
      setLicenseStatus(lic.data);
      setMetaEnabled(meta.data.metaWhatsappEnabled);
      setProviderConfig(prov.data);
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
    { id: "provider", label: "WhatsApp Provider" },
    { id: "license", label: "License" },
  ] as const;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage workspace configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
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

            {/* Provider selection */}
            <div className="card">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Provider configuration</p>
                  <p className="text-xs text-gray-400">Choose Meta or MSG91 for sending</p>
                </div>
              </div>

              <form onSubmit={handleProvider(saveProvider)} className="space-y-4">
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

                {/* MSG91 fields */}
                {selectedProvider === "msg91" && (
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        MSG91 Auth Key
                      </label>
                      <input
                        {...regProvider("msg91AuthKey" as never)}
                        className="input font-mono text-xs"
                        placeholder="your_msg91_auth_key"
                      />
                      {"msg91AuthKey" in providerErrors && providerErrors.msg91AuthKey && (
                        <p className="text-red-500 text-xs mt-1">
                          {(providerErrors as { msg91AuthKey?: { message?: string } }).msg91AuthKey?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Integrated Number
                      </label>
                      <input
                        {...regProvider("msg91IntegratedNumber" as never)}
                        className="input"
                        placeholder="91XXXXXXXXXX"
                        defaultValue={providerConfig?.msg91IntegratedNumber ?? ""}
                      />
                      {"msg91IntegratedNumber" in providerErrors &&
                        providerErrors.msg91IntegratedNumber && (
                          <p className="text-red-500 text-xs mt-1">
                            {
                              (
                                providerErrors as {
                                  msg91IntegratedNumber?: { message?: string };
                                }
                              ).msg91IntegratedNumber?.message
                            }
                          </p>
                        )}
                    </div>
                    <p className="text-xs text-gray-400">
                      Auth key is stored securely and never returned to the client.
                    </p>
                  </div>
                )}

                {/* Meta note */}
                {selectedProvider === "meta" && (
                  <div className="p-4 bg-gray-50 rounded-lg text-xs text-gray-500">
                    Meta credentials are set via server environment variables{" "}
                    <code className="bg-gray-200 px-1 rounded">META_PHONE_NUMBER_ID</code> and{" "}
                    <code className="bg-gray-200 px-1 rounded">META_ACCESS_TOKEN</code>.
                  </div>
                )}

                <button type="submit" disabled={providerSubmitting} className="btn-primary">
                  {providerSubmitting ? "Saving..." : "Save Provider"}
                </button>
              </form>
            </div>
          </>
        )}

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
