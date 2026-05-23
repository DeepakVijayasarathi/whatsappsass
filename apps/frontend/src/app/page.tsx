import Link from "next/link";
import {
  MessageSquare, Users, Megaphone, Mail, Bot, GitBranch,
  Kanban, BarChart2, Webhook, CheckCircle2, ArrowRight,
  Zap, Shield, Globe, Send, Inbox, Star,
} from "lucide-react";
import { brand } from "@/lib/brand";

const features = [
  { icon: Megaphone,  title: "WhatsApp Campaigns",  desc: "Bulk-send to thousands of opted-in contacts using Meta-approved templates.", iconColor: "text-emerald-600", bg: "bg-emerald-50" },
  { icon: Mail,       title: "Email Campaigns",      desc: "HTML email blasts via SMTP — no per-email fees, no third-party ESP needed.", iconColor: "text-blue-600",    bg: "bg-blue-50" },
  { icon: Inbox,      title: "Two-Way Inbox",        desc: "Reply to customer messages in real time. Threads, read receipts, templates.", iconColor: "text-violet-600",  bg: "bg-violet-50" },
  { icon: Bot,        title: "Auto-Replies",         desc: "Keyword-triggered responders that fire 24/7. Zero code, instant setup.",     iconColor: "text-orange-600",  bg: "bg-orange-50" },
  { icon: GitBranch,  title: "Drip Sequences",       desc: "Multi-step WhatsApp drip campaigns with configurable delays between steps.",  iconColor: "text-rose-600",    bg: "bg-rose-50" },
  { icon: Kanban,     title: "CRM Pipeline",         desc: "Drag contacts through pipeline stages. Notes, lead status, engagement score.", iconColor: "text-cyan-600",    bg: "bg-cyan-50" },
  { icon: Users,      title: "Contact Management",   desc: "Import, tag, segment. Full opt-in/opt-out with bulk operations.",            iconColor: "text-indigo-600",  bg: "bg-indigo-50" },
  { icon: BarChart2,  title: "Analytics",            desc: "Delivery, read, and failure rates. Date-range charts with CSV export.",       iconColor: "text-amber-600",   bg: "bg-amber-50" },
  { icon: Webhook,    title: "Webhooks",              desc: "Push real-time events to your own systems. No polling, instant delivery.",    iconColor: "text-slate-600",   bg: "bg-slate-100" },
];

const stats = [
  { value: "∞",   label: "Contacts",         sub: "no limits" },
  { value: "2",   label: "Providers",        sub: "Meta & MSG91" },
  { value: "9+",  label: "Features",         sub: "out of the box" },
  { value: "0₹",  label: "Per-message cost", sub: "you own the API" },
];

const steps = [
  { n: "01", icon: Send,      title: "Create your account",  desc: "Register free — your workspace is ready in seconds. No credit card." },
  { n: "02", icon: Shield,    title: "Connect WhatsApp",     desc: "Paste your Meta Cloud API or MSG91 credentials in Settings. Done." },
  { n: "03", icon: Megaphone, title: "Launch campaigns",     desc: "Import contacts, pick an approved template, and send to thousands." },
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

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow shadow-emerald-200">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-gray-900 tracking-tight text-sm">{brand.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-50 transition-all">
              Sign in
            </Link>
            <Link href="/register" className="text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-lg transition-all shadow-sm">
              Get started →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-20 pb-28 px-5 sm:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-4 py-2 rounded-full mb-10">
            <Zap className="w-3 h-3 fill-emerald-600 text-emerald-600" />
            Open source · Self-hosted · Zero per-message fees
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-[4.5rem] font-black text-gray-900 leading-[1.05] tracking-tight">
            WhatsApp marketing
            <br />
            <span className="text-emerald-600">on your own terms</span>
          </h1>

          <p className="mt-7 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Send campaigns, manage contacts, automate replies, and close deals —
            all from one dashboard. Connect <strong className="text-gray-800 font-semibold">Meta Cloud API</strong> or{" "}
            <strong className="text-gray-800 font-semibold">MSG91</strong>. No SaaS markup.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base px-8 py-3.5 rounded-xl shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-200 hover:-translate-y-0.5 transition-all duration-200"
            >
              Create free account
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-gray-700 font-semibold text-base px-8 py-3.5 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:-translate-y-0.5 transition-all duration-200"
            >
              Sign in to dashboard
            </Link>
          </div>

          {/* Trust chips */}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
            {[
              { icon: Globe,  text: "Self-hosted" },
              { icon: Shield, text: "Multi-tenant" },
              { icon: Zap,    text: "Meta Cloud API" },
              { icon: Star,   text: "MSG91 supported" },
            ].map(({ icon: Icon, text }) => (
              <span key={text} className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 text-gray-500 text-xs font-medium px-3 py-1.5 rounded-full">
                <Icon className="w-3 h-3 text-emerald-500" />
                {text}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map(({ value, label, sub }) => (
            <div key={label} className="text-center">
              <p className="text-4xl font-black text-gray-900 tabular-nums">{value}</p>
              <p className="text-sm font-bold text-gray-800 mt-1">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-emerald-600 text-xs font-bold uppercase tracking-widest mb-3">Everything included</p>
            <h2 className="text-4xl font-black text-gray-900">One platform, every tool</h2>
            <p className="text-gray-500 mt-4 text-lg max-w-xl mx-auto">
              WhatsApp + email outreach, CRM, automation, and analytics — shipped together, zero plugins.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, title, desc, bg, iconColor }) => (
              <div
                key={title}
                className="group bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200"
              >
                <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <h3 className="font-bold text-gray-900 mb-1.5 text-sm">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24 px-5 sm:px-8 bg-gray-950">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-emerald-500 text-xs font-bold uppercase tracking-widest mb-3">Quick start</p>
            <h2 className="text-4xl font-black text-white">Up and running in minutes</h2>
            <p className="text-gray-400 mt-4 text-lg">Three steps from zero to sending.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map(({ n, icon: Icon, title, desc }) => (
              <div key={n} className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center mb-5 shadow-lg shadow-emerald-900/40">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-[11px] font-black text-emerald-500 tracking-widest mb-2">{n}</span>
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed max-w-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-24 px-5 sm:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-emerald-600 text-xs font-bold uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-4xl font-black text-gray-900">Simple, honest pricing</h2>
            <p className="text-gray-500 mt-4 text-lg">Self-host for free. No usage fees. Ever.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 border transition-all duration-200 ${
                  plan.primary
                    ? "border-gray-900 bg-gray-950 text-white"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg"
                }`}
              >
                {plan.badge && (
                  <span className="absolute top-5 right-5 text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {plan.badge}
                  </span>
                )}
                <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${plan.primary ? "text-emerald-400" : "text-gray-400"}`}>
                  {plan.name}
                </p>
                <p className={`text-4xl font-black ${plan.primary ? "text-white" : "text-gray-900"}`}>
                  {plan.price}
                </p>
                <p className="text-sm mt-1 text-gray-400">{plan.sub}</p>
                <ul className="mt-7 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-center gap-2.5 text-sm font-medium ${plan.primary ? "text-gray-300" : "text-gray-700"}`}>
                      <CheckCircle2 className={`w-4 h-4 shrink-0 ${plan.primary ? "text-emerald-400" : "text-emerald-600"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`mt-7 w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                    plan.primary
                      ? "bg-emerald-600 text-white hover:bg-emerald-500 hover:-translate-y-0.5"
                      : "bg-gray-900 text-white hover:bg-gray-800 hover:-translate-y-0.5 hover:shadow-md"
                  }`}
                >
                  {plan.cta} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-5 sm:px-8 bg-gray-50 border-t border-gray-100">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-emerald-600 text-xs font-black uppercase tracking-widest mb-5">Start today</p>
          <h2 className="text-4xl sm:text-5xl font-black text-gray-900 leading-tight">
            Your WhatsApp stack,<br />your infrastructure
          </h2>
          <p className="text-gray-500 text-lg mt-5 max-w-lg mx-auto leading-relaxed">
            Create your workspace in 30 seconds. No credit card. No lock-in. Your data stays on your server.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base px-8 py-3.5 rounded-xl shadow-md shadow-emerald-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              Get started free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-white text-gray-700 font-semibold text-base px-8 py-3.5 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:-translate-y-0.5 transition-all duration-200"
            >
              Sign in →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-10 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center shadow-sm">
              <MessageSquare className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-black text-gray-900 text-sm">{brand.name}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/login"    className="hover:text-gray-700 transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-gray-700 transition-colors">Register</Link>
            <a href={`mailto:${brand.contactEmail}`} className="hover:text-gray-700 transition-colors">Contact</a>
          </div>
          <p className="text-xs text-gray-400">Self-hosted · Your data, your rules.</p>
        </div>
      </footer>

    </div>
  );
}
