import Link from "next/link";
import {
  MessageSquare, Users, Megaphone, Mail, Bot, GitBranch,
  Kanban, BarChart2, Webhook, CheckCircle2, ArrowRight,
  Zap, Shield, Globe, Send, Inbox, Star, FileText,
  UserCheck, ClipboardList, LayoutDashboard,
} from "lucide-react";
import { brand } from "@/lib/brand";

// ── Content data ─────────────────────────────────────────────────────────────
const features = [
  { icon: Megaphone,       title: "WhatsApp Campaigns",  desc: "Bulk-send to thousands of opted-in contacts using Meta-approved templates. Track delivery and read rates.",      iconColor: "text-emerald-600", bg: "bg-emerald-50"  },
  { icon: Mail,            title: "Email Campaigns",      desc: "Full HTML email blasts via SMTP — no per-email fees, no third-party ESP needed. Schedule or send now.",         iconColor: "text-blue-600",    bg: "bg-blue-50"     },
  { icon: Inbox,           title: "Two-Way Inbox",        desc: "Real-time customer conversations with unread badges, thread history, read receipts, and template replies.",     iconColor: "text-violet-600",  bg: "bg-violet-50"   },
  { icon: Bot,             title: "Auto-Replies",         desc: "Keyword-triggered responders: exact match, contains, or starts-with. Fire 24/7. Zero code, instant setup.",     iconColor: "text-orange-600",  bg: "bg-orange-50"   },
  { icon: GitBranch,       title: "Drip Sequences",       desc: "Multi-step WhatsApp drip campaigns with configurable delays. Enroll contacts and track progress automatically.", iconColor: "text-rose-600",    bg: "bg-rose-50"     },
  { icon: Kanban,          title: "CRM Pipeline",         desc: "5-stage Kanban board — New → Prospect → Qualified → Customer → Churned. Notes, lead score, contact timeline.",  iconColor: "text-cyan-600",    bg: "bg-cyan-50"     },
  { icon: Users,           title: "Contact Management",   desc: "Import CSV, tag, segment, bulk-delete. Per-contact timeline shows every message ever sent or received.",         iconColor: "text-indigo-600",  bg: "bg-indigo-50"   },
  { icon: BarChart2,       title: "Analytics",            desc: "Delivery, read, and failure rates. Daily trend charts, opt-in rate, engagement metrics, CSV export.",            iconColor: "text-amber-600",   bg: "bg-amber-50"    },
  { icon: FileText,        title: "Template Browser",     desc: "Browse all Meta-approved templates with status filters (Approved/Pending/Rejected). Live WhatsApp preview.",     iconColor: "text-teal-600",    bg: "bg-teal-50"     },
  { icon: Send,            title: "1-to-1 Send",          desc: "Send a single WhatsApp message to any number. Pick a template, fill variables, preview before sending.",         iconColor: "text-sky-600",     bg: "bg-sky-50"      },
  { icon: Webhook,         title: "Webhooks",             desc: "Push real-time events to your systems. Signing secrets, per-event toggles, test-fire button. No polling.",       iconColor: "text-slate-600",   bg: "bg-slate-100"   },
  { icon: UserCheck,       title: "Team & Roles",         desc: "Invite teammates with Owner, Admin, or Marketer roles. Fine-grained permissions per section of the app.",        iconColor: "text-pink-600",    bg: "bg-pink-50"     },
  { icon: ClipboardList,   title: "Audit Log",            desc: "Full audit trail of every action — who did what, when. Color-coded action badges for quick scanning.",           iconColor: "text-gray-600",    bg: "bg-gray-100"    },
  { icon: LayoutDashboard, title: "Super Admin Panel",    desc: "Multi-tenant workspace manager: suspend/activate workspaces, view per-tenant metrics, impersonate any user.",     iconColor: "text-purple-600",  bg: "bg-purple-50"   },
];

const stats = [
  { value: "∞",  label: "Contacts",         sub: "no hard limits" },
  { value: "14", label: "Built-in features", sub: "out of the box" },
  { value: "2",  label: "WA providers",      sub: "Meta & MSG91"   },
  { value: "0₹", label: "Per-message cost",  sub: "you own the API"},
];

const steps = [
  { n: "01", icon: Send,      title: "Create your account",  desc: "Register free — your workspace is ready in under 30 seconds. No credit card, no lock-in." },
  { n: "02", icon: Shield,    title: "Connect WhatsApp",     desc: "Paste your Meta Cloud API or MSG91 credentials in Settings → WhatsApp Provider. Done." },
  { n: "03", icon: Megaphone, title: "Launch campaigns",     desc: "Import contacts, pick an approved template, preview it live, and send to thousands instantly." },
];

const plans = [
  {
    name: "Lite",
    price: "Free",
    sub: "forever · self-host",
    badge: null,
    features: [
      "1 workspace",
      "Unlimited contacts",
      "WhatsApp & Email campaigns",
      "Two-way inbox + auto-replies",
      "Drip sequences",
      "CRM pipeline (5 stages)",
      "Analytics & audit log",
      "Team roles (Owner / Admin / Marketer)",
      "Webhooks & template browser",
    ],
    cta: "Get started free",
    href: "/register",
    primary: false,
  },
  {
    name: "Pro",
    price: "Talk to us",
    sub: "multi-tenant · white-label",
    badge: "Coming soon",
    features: [
      "Unlimited workspaces",
      "Super admin panel",
      "Billing & license management",
      "White-label branding",
      "Priority support",
      "Custom domain",
      "SLA guarantee",
    ],
    cta: "Contact us",
    href: `mailto:${brand.contactEmail}`,
    primary: true,
  },
];

const trustedBy = [
  "Campaigns sent in minutes, not days",
  "All data stays on your server",
  "No vendor lock-in, ever",
  "Works with existing Meta business accounts",
];

// ── Reusable button styles for the marketing page ────────────────────────────
const BTN_PRIMARY =
  "inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-bold text-base px-8 py-3.5 " +
  "rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 " +
  "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 " +
  "transition-all duration-200";

const BTN_SECONDARY =
  "inline-flex items-center gap-2 bg-white text-gray-700 font-semibold text-base px-8 py-3.5 " +
  "rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:-translate-y-0.5 " +
  "focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 " +
  "transition-all duration-200";

// ── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Skip link for keyboard users ── */}
      <a
        href="#main"
        className="
          sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200]
          focus:bg-white focus:text-brand focus:font-semibold focus:text-sm
          focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-md
          focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-all
        "
      >
        Skip to content
      </a>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-xl" aria-label="Primary">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-lg" aria-label={`${brand.name} home`}>
            <div className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center shadow-sm">
              <MessageSquare className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <span className="font-black text-gray-900 tracking-tight text-sm">{brand.name}</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 transition-all"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-lg shadow-sm focus-visible:ring-2 focus-visible:ring-gray-700 focus-visible:ring-offset-1 transition-all"
            >
              Get started →
            </Link>
          </div>
        </div>
      </nav>

      <main id="main" tabIndex={-1}>

        {/* ── Hero ── */}
        <section className="pt-20 pb-24 px-5 sm:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/20 text-brand-dark text-xs font-bold px-4 py-2 rounded-full mb-10">
              <Zap className="w-3 h-3 fill-brand text-brand" aria-hidden="true" />
              Open source · Self-hosted · Zero per-message fees
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-[4.5rem] font-black text-gray-900 leading-[1.05] tracking-tight">
              WhatsApp marketing
              <br />
              <span className="text-brand">on your own terms</span>
            </h1>

            <p className="mt-7 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Send campaigns, manage contacts, automate replies, and close deals — all from one dashboard.
              Connect <strong className="text-gray-800 font-semibold">Meta Cloud API</strong> or{" "}
              <strong className="text-gray-800 font-semibold">MSG91</strong>. No SaaS markup.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register" className={BTN_PRIMARY}>
                Create free account <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link href="/login" className={BTN_SECONDARY}>
                Sign in to dashboard
              </Link>
            </div>

            {/* Trust chips */}
            <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
              {[
                { icon: Globe,  text: "Self-hosted"      },
                { icon: Shield, text: "Multi-tenant"     },
                { icon: Zap,    text: "Meta Cloud API"   },
                { icon: Star,   text: "MSG91 supported"  },
              ].map(({ icon: Icon, text }) => (
                <span
                  key={text}
                  className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full"
                >
                  <Icon className="w-3 h-3 text-brand" aria-hidden="true" />
                  {text}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats bar ── */}
        <section className="border-y border-gray-100 bg-gray-50" aria-label="Product statistics">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map(({ value, label, sub }) => (
              <div key={label} className="text-center">
                <p className="text-4xl font-black text-gray-900 tabular-nums">{value}</p>
                <p className="text-sm font-bold text-gray-800 mt-1">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section className="py-24 px-5 sm:px-8" aria-labelledby="features-heading">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">Everything included</p>
              <h2 id="features-heading" className="text-4xl font-black text-gray-900">
                14 features, one dashboard
              </h2>
              <p className="text-gray-500 mt-4 text-lg max-w-xl mx-auto">
                WhatsApp + email outreach, CRM, automation, analytics, and admin tools — all shipped together. No plugins needed.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {features.map(({ icon: Icon, title, desc, bg, iconColor }) => (
                <div
                  key={title}
                  className="group bg-white rounded-2xl p-5 border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200"
                >
                  <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3.5`}>
                    <Icon className={`w-[18px] h-[18px] ${iconColor}`} aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1 text-sm">{title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why self-host strip ── */}
        <section className="border-y border-gray-100 bg-gray-50 py-12 px-5 sm:px-8" aria-label="Trust points">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {trustedBy.map((text) => (
                <div key={text} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-sm font-medium text-gray-700">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="py-24 px-5 sm:px-8 bg-gray-950" aria-labelledby="quickstart-heading">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">Quick start</p>
              <h2 id="quickstart-heading" className="text-4xl font-black text-white">
                Up and running in minutes
              </h2>
              <p className="text-gray-400 mt-4 text-lg">Three steps from zero to sending.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map(({ n, icon: Icon, title, desc }) => (
                <div key={n} className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center mb-5 shadow-lg shadow-brand/30">
                    <Icon className="w-6 h-6 text-white" aria-hidden="true" />
                  </div>
                  <span className="text-2xs font-black text-brand tracking-widest mb-2">{n}</span>
                  <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed max-w-xs">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="py-24 px-5 sm:px-8" aria-labelledby="pricing-heading">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">Pricing</p>
              <h2 id="pricing-heading" className="text-4xl font-black text-gray-900">
                Simple, honest pricing
              </h2>
              <p className="text-gray-500 mt-4 text-lg">Self-host for free. No usage fees. Ever.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl p-8 border transition-all duration-200 ${
                    plan.primary
                      ? "border-gray-800 bg-gray-950 text-white"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg"
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute top-5 right-5 text-2xs font-black bg-brand/10 text-brand-dark border border-brand/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {plan.badge}
                    </span>
                  )}
                  <p className={`text-2xs font-black uppercase tracking-widest mb-3 ${plan.primary ? "text-brand" : "text-gray-400"}`}>
                    {plan.name}
                  </p>
                  <p className={`text-4xl font-black ${plan.primary ? "text-white" : "text-gray-900"}`}>
                    {plan.price}
                  </p>
                  <p className="text-sm mt-1 text-gray-400">{plan.sub}</p>
                  <ul className="mt-7 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className={`flex items-start gap-2.5 text-sm font-medium ${plan.primary ? "text-gray-300" : "text-gray-700"}`}>
                        <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${plan.primary ? "text-brand" : "text-brand"}`} aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    className={`mt-7 w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 ${
                      plan.primary
                        ? "bg-brand text-white hover:bg-brand-dark hover:-translate-y-0.5 focus-visible:ring-brand focus-visible:ring-offset-gray-950"
                        : "bg-gray-900 text-white hover:bg-gray-800 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-gray-700"
                    }`}
                  >
                    {plan.cta} <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="py-24 px-5 sm:px-8 bg-gray-50 border-t border-gray-100" aria-label="Final call to action">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-brand text-xs font-black uppercase tracking-widest mb-5">Start today</p>
            <h2 className="text-4xl sm:text-5xl font-black text-gray-900 leading-tight">
              Your WhatsApp stack,<br />your infrastructure
            </h2>
            <p className="text-gray-500 text-lg mt-5 max-w-lg mx-auto leading-relaxed">
              Create your workspace in 30 seconds. No credit card. No lock-in. Your data stays on your server.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register" className={BTN_PRIMARY}>
                Get started free <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link href="/login" className={BTN_SECONDARY}>
                Sign in →
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-10 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-lg" aria-label={`${brand.name} home`}>
            <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center shadow-sm">
              <MessageSquare className="w-3.5 h-3.5 text-white" aria-hidden="true" />
            </div>
            <span className="font-black text-gray-900 text-sm">{brand.name}</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-gray-500" aria-label="Footer">
            <Link href="/login"    className="hover:text-gray-900 focus-visible:text-gray-900 transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-gray-900 focus-visible:text-gray-900 transition-colors">Register</Link>
            <a href={`mailto:${brand.contactEmail}`} className="hover:text-gray-900 focus-visible:text-gray-900 transition-colors">Contact</a>
          </nav>
          <p className="text-xs text-gray-500">Self-hosted · Your data, your rules.</p>
        </div>
      </footer>

    </div>
  );
}
