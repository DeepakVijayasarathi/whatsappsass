import Link from "next/link";
import {
  MessageSquare, Users, Megaphone, Mail, Bot, GitBranch,
  Kanban, BarChart2, Webhook, CheckCircle2, ArrowRight,
  Zap, Shield, Globe,
} from "lucide-react";
import { brand } from "@/lib/brand";

const features = [
  { icon: Megaphone,    title: "WhatsApp Campaigns",  desc: "Send bulk messages to thousands of opted-in contacts using approved templates." },
  { icon: Mail,         title: "Email Campaigns",      desc: "HTML email campaigns with SMTP — no third-party ESP required." },
  { icon: MessageSquare,title: "Two-Way Inbox",        desc: "Reply to customer messages in real time with a unified inbox." },
  { icon: Bot,          title: "Auto-Replies",         desc: "Keyword-triggered auto-responders that fire 24/7, no code needed." },
  { icon: GitBranch,    title: "Drip Sequences",       desc: "Multi-step WhatsApp drip campaigns with configurable delays between steps." },
  { icon: Kanban,       title: "CRM Pipeline",         desc: "Drag contacts through pipeline stages and close deals faster." },
  { icon: Users,        title: "Contact Management",   desc: "Import, tag, and segment your audience. Full opt-in/opt-out tracking." },
  { icon: BarChart2,    title: "Analytics",            desc: "Delivery, read, and failure rates for every campaign you run." },
  { icon: Webhook,      title: "Webhooks",             desc: "Push real-time events to your own systems — no polling required." },
];

const highlights = [
  { icon: Zap,    text: "Meta Cloud API & MSG91 supported" },
  { icon: Shield, text: "Multi-tenant — each client gets their own workspace" },
  { icon: Globe,  text: "Self-hosted — your data stays on your infrastructure" },
];

const plans = [
  {
    name: "Lite",
    price: "Free",
    sub: "to self-host",
    badge: null,
    features: [
      "1 workspace",
      "Unlimited contacts",
      "WhatsApp & Email campaigns",
      "Two-way inbox",
      "Auto-replies & drip sequences",
      "CRM pipeline",
      "Analytics & audit log",
    ],
    cta: "Get started free",
    href: "/register",
    primary: false,
  },
  {
    name: "Pro",
    price: "Contact us",
    sub: "for multi-tenant SaaS",
    badge: "Coming soon",
    features: [
      "Unlimited workspaces",
      "Billing & license management",
      "White-label branding",
      "Priority support",
      "Custom domain",
      "SLA guarantee",
    ],
    cta: "Talk to us",
    href: `mailto:${brand.contactEmail}`,
    primary: true,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-brand to-brand-dark rounded-xl flex items-center justify-center shadow-sm">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm tracking-tight">{brand.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-1.5">
              Sign in
            </Link>
            <Link
              href="/register"
              className="btn-primary text-sm"
            >
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-brand/10 text-brand text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Zap className="w-3 h-3" />
          Open source · Self-hosted · No per-message fees
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight max-w-3xl mx-auto">
          {brand.tagline.split(",")[0]},{" "}
          <span className="bg-gradient-to-r from-brand to-brand-dark bg-clip-text text-transparent">
            {brand.tagline.split(",")[1]?.trim()}
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
          {brand.subTagline}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="btn-primary text-base px-7 py-3 flex items-center gap-2"
          >
            Create free account <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="btn-secondary text-base px-7 py-3"
          >
            Sign in to dashboard
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {highlights.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-sm text-gray-400">
              <Icon className="w-4 h-4 text-brand" />
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">Everything your team needs</h2>
            <p className="text-gray-500 mt-3 text-base max-w-xl mx-auto">
              One platform for WhatsApp and email outreach, customer conversations, and pipeline management.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-brand/20 transition-all duration-200"
              >
                <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-brand" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1.5">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900">Up and running in minutes</h2>
          <p className="text-gray-500 mt-3 text-base">Three steps from zero to sending.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "Create your account",
              desc: "Register and your workspace is created instantly. No credit card, no waiting.",
            },
            {
              step: "02",
              title: "Connect WhatsApp",
              desc: "Add your Meta Cloud API credentials or MSG91 auth key in Settings. Takes two minutes.",
            },
            {
              step: "03",
              title: "Import and send",
              desc: "Upload your contacts, pick an approved template, and launch your first campaign.",
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="relative">
              <div className="text-5xl font-black text-gray-100 mb-3 select-none">{step}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">Simple pricing</h2>
            <p className="text-gray-500 mt-3 text-base">Self-host for free. Scale with Pro.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 border-2 relative ${
                  plan.primary
                    ? "border-brand bg-gradient-to-br from-brand/5 to-brand-dark/5"
                    : "border-gray-200 bg-white"
                }`}
              >
                {plan.badge && (
                  <span className="absolute top-5 right-5 text-xs font-semibold bg-brand/10 text-brand px-2.5 py-1 rounded-full">
                    {plan.badge}
                  </span>
                )}
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{plan.name}</p>
                <p className="text-3xl font-extrabold text-gray-900">{plan.price}</p>
                <p className="text-sm text-gray-400 mt-0.5">{plan.sub}</p>

                <ul className="mt-7 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`mt-8 w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.primary
                      ? "bg-brand text-white hover:bg-brand-dark"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                  }`}
                >
                  {plan.cta} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6 text-center">
        <div className="bg-gradient-to-br from-brand to-brand-dark rounded-3xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-3">Ready to start?</h2>
          <p className="text-white/80 text-base mb-8 max-w-lg mx-auto">
            Create your account in seconds. No credit card required. Your workspace is ready instantly.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-white text-brand font-bold px-8 py-3.5 rounded-xl hover:bg-gray-50 transition-colors text-sm"
          >
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-brand to-brand-dark rounded-lg flex items-center justify-center">
              <MessageSquare className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-700">{brand.name}</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-gray-400">
            <Link href="/login" className="hover:text-gray-700">Sign in</Link>
            <Link href="/register" className="hover:text-gray-700">Register</Link>
          </div>
          <p className="text-xs text-gray-400">Self-hosted. Your data, your rules.</p>
        </div>
      </footer>
    </div>
  );
}
