import Link from "next/link";
import {
  MessageSquare, Users, Megaphone, Mail, Bot, GitBranch,
  Kanban, BarChart2, Webhook, CheckCircle2, ArrowRight,
  Zap, Shield, Globe, Send, Inbox, Star, Play,
} from "lucide-react";
import { brand } from "@/lib/brand";

const features = [
  { icon: Megaphone,     title: "WhatsApp Campaigns",  desc: "Bulk-send to thousands of opted-in contacts using Meta-approved templates.", color: "from-green-400 to-emerald-600",  bg: "bg-emerald-50",  iconColor: "text-emerald-600" },
  { icon: Mail,          title: "Email Campaigns",      desc: "HTML email blasts via SMTP — no per-email fees, no third-party ESP needed.", color: "from-blue-400 to-blue-600",      bg: "bg-blue-50",     iconColor: "text-blue-600" },
  { icon: Inbox,         title: "Two-Way Inbox",        desc: "Reply to customer messages in real time. Threads, read receipts, templates.", color: "from-purple-400 to-purple-600",  bg: "bg-purple-50",   iconColor: "text-purple-600" },
  { icon: Bot,           title: "Auto-Replies",         desc: "Keyword-triggered responders that fire 24/7. Zero code, instant setup.",     color: "from-orange-400 to-orange-600",  bg: "bg-orange-50",   iconColor: "text-orange-600" },
  { icon: GitBranch,     title: "Drip Sequences",       desc: "Multi-step WhatsApp drip campaigns with configurable delays between steps.",  color: "from-pink-400 to-rose-600",      bg: "bg-rose-50",     iconColor: "text-rose-600" },
  { icon: Kanban,        title: "CRM Pipeline",         desc: "Drag contacts through pipeline stages. Notes, lead status, engagement score.", color: "from-cyan-400 to-cyan-600",      bg: "bg-cyan-50",     iconColor: "text-cyan-600" },
  { icon: Users,         title: "Contact Management",   desc: "Import, tag, segment. Full opt-in/opt-out with bulk operations.",            color: "from-indigo-400 to-indigo-600",  bg: "bg-indigo-50",   iconColor: "text-indigo-600" },
  { icon: BarChart2,     title: "Analytics",            desc: "Delivery, read, and failure rates. Date-range charts with CSV export.",       color: "from-amber-400 to-yellow-600",   bg: "bg-amber-50",    iconColor: "text-amber-600" },
  { icon: Webhook,       title: "Webhooks",             desc: "Push real-time events to your own systems. No polling, instant delivery.",    color: "from-slate-400 to-slate-600",    bg: "bg-slate-50",    iconColor: "text-slate-600" },
];

const stats = [
  { value: "∞",    label: "Contacts",          sub: "no limits" },
  { value: "2",    label: "Providers",         sub: "Meta & MSG91" },
  { value: "9+",   label: "Features",          sub: "out of the box" },
  { value: "0₹",   label: "Per-message cost",  sub: "you own the API" },
];

const steps = [
  { n: "01", icon: Send,         title: "Create your account",  desc: "Register free — your workspace is ready in seconds. No credit card." },
  { n: "02", icon: Shield,       title: "Connect WhatsApp",     desc: "Paste your Meta Cloud API or MSG91 credentials in Settings. Done." },
  { n: "03", icon: Megaphone,    title: "Launch campaigns",     desc: "Import contacts, pick an approved template, and send to thousands." },
];

const plans = [
  {
    name: "Lite",
    price: "Free",
    sub: "forever · self-host",
    badge: null,
    features: ["1 workspace", "Unlimited contacts", "WhatsApp & Email campaigns", "Two-way inbox", "Auto-replies & drip sequences", "CRM pipeline", "Analytics & audit log"],
    cta: "Get started free",
    href: "/register",
    primary: false,
  },
  {
    name: "Pro",
    price: "Talk to us",
    sub: "multi-tenant · white-label",
    badge: "Coming soon",
    features: ["Unlimited workspaces", "Billing & license management", "White-label branding", "Priority support", "Custom domain", "SLA guarantee"],
    cta: "Contact us",
    href: `mailto:${brand.contactEmail}`,
    primary: true,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Sticky nav ───────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-brand to-brand-dark rounded-xl flex items-center justify-center shadow-sm shadow-brand/30">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-gray-900 tracking-tight">{brand.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 font-medium px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary text-sm shadow-sm shadow-brand/30">
              Start free →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-32 overflow-hidden">
        {/* Background mesh */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(37,211,102,0.12),transparent)]" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(18,140,126,0.08),transparent_70%)]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(37,211,102,0.06),transparent_70%)]" />
          {/* Subtle grid */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 border border-brand/30 bg-brand/5 text-brand text-xs font-bold px-4 py-2 rounded-full mb-8 shadow-sm">
            <Zap className="w-3.5 h-3.5 fill-brand" />
            Open source · Self-hosted · Zero per-message fees
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-gray-900 leading-[1.05] tracking-tight">
            WhatsApp marketing<br />
            <span className="relative inline-block mt-2">
              <span className="bg-gradient-to-r from-brand via-emerald-500 to-brand-dark bg-clip-text text-transparent">
                on your own terms
              </span>
              {/* Underline accent */}
              <span className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-brand to-brand-dark rounded-full opacity-30" />
            </span>
          </h1>

          <p className="mt-8 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed font-medium">
            Send campaigns, manage contacts, automate replies, and close deals —<br className="hidden sm:block" />
            all from one dashboard. Connect <strong className="text-gray-700">Meta Cloud API</strong> or <strong className="text-gray-700">MSG91</strong>. No SaaS markup.
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 bg-gradient-to-r from-brand to-brand-dark text-white font-bold text-base px-8 py-4 rounded-2xl shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-brand/30 hover:-translate-y-0.5 transition-all duration-200"
            >
              <Play className="w-4 h-4 fill-white" />
              Create free account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-white text-gray-700 font-semibold text-base px-8 py-4 rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              Sign in to dashboard
            </Link>
          </div>

          {/* Trust chips */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {[
              { icon: Globe,  text: "Self-hosted" },
              { icon: Shield, text: "Multi-tenant" },
              { icon: Zap,    text: "Meta Cloud API" },
              { icon: Star,   text: "MSG91 supported" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 text-gray-500 text-xs font-semibold px-3 py-1.5 rounded-full">
                <Icon className="w-3.5 h-3.5 text-brand" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <section className="border-y border-gray-100 bg-gray-50/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map(({ value, label, sub }) => (
            <div key={label} className="text-center">
              <p className="text-4xl font-black text-gray-900 tabular-nums">{value}</p>
              <p className="text-sm font-bold text-gray-700 mt-1">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">Everything included</p>
            <h2 className="text-4xl font-black text-gray-900">One platform, every tool</h2>
            <p className="text-gray-500 mt-4 text-lg max-w-xl mx-auto">
              WhatsApp + email outreach, CRM, automation, and analytics — shipped together, zero plugins.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, title, desc, bg, iconColor }) => (
              <div
                key={title}
                className="group relative bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden"
              >
                {/* Hover glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-brand/0 to-brand/0 group-hover:from-brand/[0.02] group-hover:to-brand/[0.06] transition-all duration-300 rounded-2xl" />
                <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-base">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="py-24 bg-gray-950 text-white relative overflow-hidden">
        {/* bg decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(37,211,102,0.08),transparent)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative">
          <div className="text-center mb-16">
            <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">Quick start</p>
            <h2 className="text-4xl font-black">Up and running in minutes</h2>
            <p className="text-gray-400 mt-4 text-lg">Three steps from zero to sending.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-8 left-[calc(16.66%+1.5rem)] right-[calc(16.66%+1.5rem)] h-px bg-gradient-to-r from-brand/20 via-brand/40 to-brand/20" />

            {steps.map(({ n, icon: Icon, title, desc }) => (
              <div key={n} className="relative flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center mb-5 shadow-lg shadow-brand/30 z-10">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <span className="text-xs font-black text-brand/60 tracking-widest mb-2">{n}</span>
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed max-w-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-4xl font-black text-gray-900">Simple, honest pricing</h2>
            <p className="text-gray-500 mt-4 text-lg">Self-host for free. No usage fees. Ever.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-3xl p-8 border-2 overflow-hidden transition-all duration-300 ${
                  plan.primary
                    ? "border-brand bg-gradient-to-br from-gray-950 to-gray-900 text-white"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-xl"
                }`}
              >
                {/* Pro glow */}
                {plan.primary && (
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(37,211,102,0.15),transparent)]" />
                )}
                {plan.badge && (
                  <span className="absolute top-5 right-5 text-[10px] font-black bg-brand/20 text-brand px-2.5 py-1 rounded-full uppercase tracking-wider border border-brand/30">
                    {plan.badge}
                  </span>
                )}

                <div className="relative">
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${plan.primary ? "text-brand" : "text-gray-400"}`}>
                    {plan.name}
                  </p>
                  <p className={`text-4xl font-black ${plan.primary ? "text-white" : "text-gray-900"}`}>
                    {plan.price}
                  </p>
                  <p className={`text-sm mt-1 ${plan.primary ? "text-gray-400" : "text-gray-400"}`}>{plan.sub}</p>

                  <ul className="mt-8 space-y-3.5">
                    {plan.features.map((f) => (
                      <li key={f} className={`flex items-center gap-3 text-sm font-medium ${plan.primary ? "text-gray-300" : "text-gray-700"}`}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${plan.primary ? "bg-brand/20" : "bg-emerald-50"}`}>
                          <CheckCircle2 className={`w-3.5 h-3.5 ${plan.primary ? "text-brand" : "text-emerald-600"}`} />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.href}
                    className={`mt-8 w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 ${
                      plan.primary
                        ? "bg-gradient-to-r from-brand to-brand-dark text-white hover:shadow-lg hover:shadow-brand/30 hover:-translate-y-0.5"
                        : "bg-gray-900 text-white hover:bg-gray-800 hover:-translate-y-0.5 hover:shadow-lg"
                    }`}
                  >
                    {plan.cta} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-brand via-emerald-500 to-brand-dark p-1 shadow-2xl shadow-brand/20">
            <div className="bg-gradient-to-br from-gray-950 to-gray-900 rounded-[22px] px-8 py-16 sm:px-16 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(37,211,102,0.15),transparent)]" />
              <div className="relative">
                <p className="text-brand text-xs font-black uppercase tracking-widest mb-4">Start today</p>
                <h2 className="text-4xl sm:text-5xl font-black text-white leading-tight">
                  Your WhatsApp stack,<br />your infrastructure
                </h2>
                <p className="text-gray-400 text-lg mt-5 max-w-lg mx-auto leading-relaxed">
                  Create your workspace in 30 seconds. No credit card. No lock-in. Your data stays on your server.
                </p>
                <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    href="/register"
                    className="group inline-flex items-center gap-2 bg-gradient-to-r from-brand to-brand-dark text-white font-bold text-base px-8 py-4 rounded-2xl shadow-lg shadow-brand/30 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Get started free
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 border border-white/20 text-white font-semibold text-base px-8 py-4 rounded-2xl hover:bg-white/5 transition-all duration-200"
                  >
                    Sign in →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-gradient-to-br from-brand to-brand-dark rounded-lg flex items-center justify-center shadow-sm">
                <MessageSquare className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-black text-gray-800">{brand.name}</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link href="/login"    className="hover:text-gray-700 transition-colors">Sign in</Link>
              <Link href="/register" className="hover:text-gray-700 transition-colors">Register</Link>
              <a href={`mailto:${brand.contactEmail}`} className="hover:text-gray-700 transition-colors">Contact</a>
            </div>
            <p className="text-xs text-gray-400">Self-hosted. Your data, your rules.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
