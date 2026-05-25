"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, X,
  Settings, ToggleRight, Users, FileText, Rocket,
} from "lucide-react";
import clsx from "clsx";

interface Steps {
  providerConfigured: boolean;
  whatsappEnabled: boolean;
  hasContacts: boolean;
  hasTemplates: boolean;
}

interface Step {
  key: keyof Steps;
  icon: React.ElementType;
  title: string;
  desc: string;
  href: string;
  cta: string;
}

const STEPS: Step[] = [
  {
    key:   "providerConfigured",
    icon:  Settings,
    title: "Connect your WhatsApp provider",
    desc:  "Add your Meta Cloud API or MSG91 credentials in Settings.",
    href:  "/settings",
    cta:   "Open Settings →",
  },
  {
    key:   "whatsappEnabled",
    icon:  ToggleRight,
    title: "Enable the WhatsApp API",
    desc:  "Flip the toggle in Settings → Provider to start sending.",
    href:  "/settings",
    cta:   "Open Settings →",
  },
  {
    key:   "hasContacts",
    icon:  Users,
    title: "Add your first contact",
    desc:  "Import a CSV or add contacts manually to build your audience.",
    href:  "/contacts",
    cta:   "Go to Contacts →",
  },
  {
    key:   "hasTemplates",
    icon:  FileText,
    title: "Sync your approved templates",
    desc:  "Pull your Meta-approved message templates so you can start sending.",
    href:  "/templates",
    cta:   "Go to Templates →",
  },
];

const DISMISSED_KEY = "onboarding_dismissed";

export default function OnboardingChecklist() {
  const [steps, setSteps]         = useState<Steps | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(DISMISSED_KEY) === "1") {
      setDismissed(true);
      return;
    }
    api.get("/workspace/onboarding-status")
      .then((r) => setSteps(r.data.steps))
      .catch(() => {});
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const completedCount = steps ? STEPS.filter((s) => steps[s.key]).length : 0;
  const allDone = !!steps && completedCount === STEPS.length;

  // Auto-dismiss once everything is done — must be in useEffect, not render body
  useEffect(() => {
    if (allDone) dismiss();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  if (dismissed || !steps || allDone) return null;

  const pct = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div className="card border-2 border-brand/20 bg-gradient-to-br from-white to-brand/5 mb-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand/10 rounded-xl flex items-center justify-center shrink-0">
            <Rocket className="w-4.5 h-4.5 text-brand" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">
              Get started — {completedCount} of {STEPS.length} done
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Complete setup to send your first message</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="icon-btn"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button onClick={dismiss} className="icon-btn" title="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 mb-1">
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-brand h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      {!collapsed && (
        <div className="mt-4 space-y-2">
          {STEPS.map(({ key, icon: Icon, title, desc, href, cta }) => {
            const done = steps[key];
            return (
              <div
                key={key}
                className={clsx(
                  "flex items-start gap-3 p-3 rounded-xl border transition-colors",
                  done
                    ? "border-emerald-100 bg-emerald-50/60"
                    : "border-gray-100 bg-white hover:border-brand/20"
                )}
              >
                {done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Icon className={clsx("w-3.5 h-3.5 shrink-0", done ? "text-emerald-500" : "text-gray-400")} />
                      <p className={clsx("text-sm font-semibold", done ? "text-gray-400 line-through" : "text-gray-800")}>
                        {title}
                      </p>
                    </div>
                    {!done && (
                      <Link
                        href={href}
                        className="text-xs font-semibold text-brand hover:underline shrink-0"
                      >
                        {cta}
                      </Link>
                    )}
                  </div>
                  {!done && (
                    <p className="text-xs text-gray-400 mt-0.5 ml-5">{desc}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
