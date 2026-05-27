"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen, Settings, Users, Megaphone, Send, Inbox,
  BarChart2, GitBranch, Bot, Webhook, Kanban, FileText,
  ChevronRight, CheckCircle2, AlertCircle, Mail, Key,
  ExternalLink, Play, Tag, GitMerge, History,
} from "lucide-react";
import clsx from "clsx";

interface Section {
  id: string;
  icon: React.ElementType;
  title: string;
  color: string;
  bg: string;
}

const SECTIONS: Section[] = [
  { id: "getting-started", icon: Play,       title: "Getting Started",   color: "text-brand",      bg: "bg-brand/10" },
  { id: "settings",        icon: Settings,   title: "Settings",          color: "text-gray-600",   bg: "bg-gray-100" },
  { id: "contacts",        icon: Users,      title: "Contacts",          color: "text-blue-500",   bg: "bg-blue-50" },
  { id: "templates",       icon: FileText,   title: "Templates",         color: "text-purple-500", bg: "bg-purple-50" },
  { id: "send",            icon: Send,       title: "Send Message",      color: "text-emerald-500",bg: "bg-emerald-50" },
  { id: "campaigns",       icon: Megaphone,  title: "WA Campaigns",      color: "text-orange-500", bg: "bg-orange-50" },
  { id: "email",           icon: Mail,       title: "Email Campaigns",   color: "text-pink-500",   bg: "bg-pink-50" },
  { id: "inbox",           icon: Inbox,      title: "Inbox",             color: "text-cyan-500",   bg: "bg-cyan-50" },
  { id: "sequences",       icon: GitBranch,  title: "Drip Sequences",    color: "text-violet-500", bg: "bg-violet-50" },
  { id: "crm",             icon: Kanban,     title: "CRM Pipeline",      color: "text-amber-500",  bg: "bg-amber-50" },
  { id: "auto-replies",    icon: Bot,        title: "Auto-Replies",      color: "text-teal-500",   bg: "bg-teal-50" },
  { id: "analytics",       icon: BarChart2,  title: "Analytics",         color: "text-indigo-500", bg: "bg-indigo-50" },
  { id: "webhooks",        icon: Webhook,    title: "Webhooks",          color: "text-rose-500",   bg: "bg-rose-50" },
];

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <p className="text-sm text-gray-700 leading-relaxed">{children}</p>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 text-xs text-amber-800">
      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
      <span>{children}</span>
    </div>
  );
}

function Good({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 text-xs text-emerald-800">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-500" />
      <span>{children}</span>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-gray-100 text-gray-800 text-xs px-1.5 py-0.5 rounded font-mono">
      {children}
    </code>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-brand text-xs font-semibold hover:underline"
    >
      {label} <ExternalLink className="w-3 h-3" />
    </Link>
  );
}

function FeatureBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 bg-brand/10 text-brand text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
      {label}
    </span>
  );
}

export default function GuidePage() {
  const [active, setActive] = useState("getting-started");

  const scrollTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex gap-6 items-start">
      {/* ── Sticky sidebar nav ── */}
      <aside className="hidden lg:block w-56 shrink-0 sticky top-4">
        <div className="card p-3 space-y-0.5">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
            <BookOpen className="w-4 h-4 text-brand" />
            <span className="text-sm font-bold text-gray-900">User Guide</span>
          </div>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={clsx(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-left transition-colors",
                  active === s.id
                    ? "bg-brand/10 text-brand"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {s.title}
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="flex-1 min-w-0 space-y-8">

        {/* Header */}
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-brand" />
            How to Use This Platform
          </h1>
          <p className="page-subtitle">
            A complete guide to every feature — follow in order or jump to any section.
          </p>
        </div>

        {/* ── Getting Started ── */}
        <section id="getting-started" className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand/10 rounded-xl flex items-center justify-center shrink-0">
              <Play className="w-4.5 h-4.5 text-brand" style={{ width: 18, height: 18 }} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Getting Started</h2>
          </div>

          <p className="text-sm text-gray-600">
            Follow these steps in order on your first login to get the platform fully operational.
          </p>

          <div className="space-y-3">
            <Step n={1}>
              <strong>Activate your license.</strong> Go to{" "}
              <NavLink href="/settings" label="Settings → License" /> and enter your{" "}
              <Code>LITE-XXXX-XXXX-XXXX</Code> key. Without an active license the WhatsApp API
              features are locked.
            </Step>
            <Step n={2}>
              <strong>Connect your WhatsApp provider.</strong> In{" "}
              <NavLink href="/settings" label="Settings → Provider" />, choose{" "}
              <strong>Meta (Cloud API)</strong> or <strong>MSG91</strong> and fill in your
              credentials. See the Settings section below for the exact fields needed.
            </Step>
            <Step n={3}>
              <strong>Enable the API.</strong> On the Dashboard, the badge will show{" "}
              <Code>● API Active</Code> once your credentials are saved and verified.
            </Step>
            <Step n={4}>
              <strong>Import your contacts.</strong> Go to{" "}
              <NavLink href="/contacts" label="Contacts → Import CSV" /> and upload a spreadsheet.
              Make sure contacts have <Code>optIn = true</Code> to receive messages.
            </Step>
            <Step n={5}>
              <strong>Send a test message.</strong> Use{" "}
              <NavLink href="/send" label="Send Message" /> to send one message to your own number
              and confirm delivery.
            </Step>
          </div>

          <Good>
            Default login after first deploy: <Code>admin@demo.com</Code> / <Code>admin123</Code>.
            Change this immediately in <NavLink href="/profile" label="Profile" />.
          </Good>
        </section>

        {/* ── Settings ── */}
        <section id="settings" className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
              <Settings className="w-4.5 h-4.5 text-gray-600" style={{ width: 18, height: 18 }} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Settings</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Provider */}
            <div className="rounded-xl border border-gray-100 p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-brand" /> WhatsApp Provider
              </p>
              <div className="space-y-1 text-xs text-gray-600">
                <p><strong>Meta Cloud API</strong></p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-500 ml-1">
                  <li>Phone Number ID — from Meta Business Manager</li>
                  <li>WABA ID — WhatsApp Business Account ID</li>
                  <li>Access Token — permanent system user token</li>
                  <li>Webhook Verify Token — any secret string you choose</li>
                </ul>
                <p className="mt-2"><strong>MSG91</strong></p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-500 ml-1">
                  <li>Auth Key — from MSG91 dashboard → Settings → Auth Key</li>
                  <li>Integrated Number — your registered WhatsApp number (with country code, e.g. <Code>919876543210</Code>)</li>
                  <li className="text-amber-600 font-medium">Set your MSG91 webhook callback URL to: <Code>https://your-domain/api/whatsapp/msg91-webhook</Code> to receive delivery receipts and inbound messages</li>
                </ul>
              </div>
            </div>

            {/* Email / SMTP */}
            <div className="rounded-xl border border-gray-100 p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-pink-500" /> Email / SMTP
              </p>
              <div className="text-xs text-gray-600 space-y-1">
                <p>Required for password reset emails and email campaigns.</p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-500 ml-1">
                  <li>SMTP Host, Port (587 for TLS)</li>
                  <li>Username &amp; Password</li>
                  <li>From Email &amp; From Name</li>
                </ul>
                <p className="text-gray-400 mt-1">Works with Gmail, SendGrid, Mailgun, Postmark, etc.</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-800">Password Reset without SMTP</p>
            <p className="text-xs text-gray-600">
              If SMTP is not configured, clicking <strong>Forgot Password</strong> on the login page
              will still generate a one-time reset link — but instead of emailing it, the link is
              displayed on screen for an admin to copy and share with the user manually. The link
              expires in 1 hour.
            </p>
          </div>

          <Tip>Settings are per-workspace. Each workspace has its own provider credentials — different teams can use different WhatsApp numbers.</Tip>
        </section>

        {/* ── Contacts ── */}
        <section id="contacts" className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <Users className="w-4.5 h-4.5 text-blue-500" style={{ width: 18, height: 18 }} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Contacts</h2>
          </div>

          <div className="space-y-3">
            <Step n={1}><strong>Add manually</strong> — click Add Contact, fill name + phone (with country code, e.g. <Code>+919876543210</Code>) + optional email and tags.</Step>
            <Step n={2}><strong>Import CSV</strong> — download the template, fill it in, upload. Max 500 contacts per import. Required columns: <Code>name</Code>, <Code>phone</Code>. Optional: <Code>tags</Code> (pipe-separated), <Code>optIn</Code>.</Step>
            <Step n={3}><strong>Export CSV</strong> — downloads all contacts in your workspace including tags, lead status, and opt-in status.</Step>
            <Step n={4}><strong>Bulk delete</strong> — check multiple contacts then click Delete selected.</Step>
            <Step n={5}><strong>Contact detail</strong> — click a name to open the full profile with message timeline, CRM notes, and engagement score.</Step>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 text-xs font-mono text-gray-600 space-y-0.5">
            <p className="text-gray-400 font-sans font-semibold text-[10px] uppercase tracking-widest mb-1">CSV format</p>
            <p>name,phone,tags,optIn</p>
            <p>Alice,+441234567890,vip|customer,true</p>
            <p>Bob,+14155550100,,false</p>
          </div>

          {/* Bulk tag */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-blue-500" />
              Bulk Tag Assignment <FeatureBadge label="New" />
            </p>
            <div className="space-y-1.5">
              <Step n={1}>Select one or more contacts using the checkboxes.</Step>
              <Step n={2}>Click the <strong>Tag</strong> button that appears in the bulk action bar.</Step>
              <Step n={3}>Enter comma-separated tags (e.g. <Code>vip, summer-sale</Code>).</Step>
              <Step n={4}><strong>Add tags</strong> merges with existing tags. <strong>Replace tags</strong> overwrites all existing tags on the selected contacts.</Step>
            </div>
          </div>

          {/* Deduplication */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <GitMerge className="w-3.5 h-3.5 text-blue-500" />
              Contact Deduplication <FeatureBadge label="New" />
            </p>
            <p className="text-xs text-gray-600">
              Click the <strong>Deduplicate</strong> button at the top of the Contacts page to
              automatically find and merge contacts with the same phone number. The oldest record is
              kept, tags are merged, opt-in is set to <Code>true</Code> if any duplicate had it, and
              all message history and notes are re-parented to the surviving contact.
            </p>
          </div>

          <Tip>Contacts without <Code>optIn=true</Code> will not receive bulk campaign messages. Always get explicit opt-in consent.</Tip>
        </section>

        {/* ── Templates ── */}
        <section id="templates" className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
              <FileText className="w-4.5 h-4.5 text-purple-500" style={{ width: 18, height: 18 }} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Templates</h2>
          </div>

          <p className="text-sm text-gray-600">
            Templates are pre-approved WhatsApp message formats created in your Meta Business
            Manager or MSG91 dashboard. This platform does not create templates — it fetches and
            displays them.
          </p>

          <div className="space-y-3">
            <Step n={1}>Create and get approval for your templates in <strong>Meta Business Manager → WhatsApp Manager → Message Templates</strong>.</Step>
            <Step n={2}>Once approved, come to <NavLink href="/templates" label="Templates" /> and click <strong>Refresh</strong> to sync them.</Step>
            <Step n={3}>Templates with status <strong>APPROVED</strong> can be used in campaigns and direct sends. <strong>REJECTED</strong> or <strong>PAUSED</strong> templates cannot be sent.</Step>
            <Step n={4}>Templates can contain variables: <Code>{"{{1}}"}</Code>, <Code>{"{{2}}"}</Code> etc. You fill in the values when sending.</Step>
          </div>

          <Good>Filter by status using the pill buttons at the top. Search by template name using the search bar.</Good>
        </section>

        {/* ── Send Message ── */}
        <section id="send" className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
              <Send className="w-4.5 h-4.5 text-emerald-500" style={{ width: 18, height: 18 }} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Send Message</h2>
          </div>

          <p className="text-sm text-gray-600">
            Send a single WhatsApp template message to any phone number instantly.
          </p>

          <div className="space-y-3">
            <Step n={1}>Enter the recipient's phone number with full country code: <Code>+1</Code> for USA, <Code>+91</Code> for India, <Code>+44</Code> for UK, etc.</Step>
            <Step n={2}>Click <strong>Browse templates</strong> to pick from your approved templates, or type the template name directly.</Step>
            <Step n={3}>If the template has variables (<Code>{"{{1}}"}</Code>), input fields appear — fill them all before sending.</Step>
            <Step n={4}>The live preview on the right shows the final message text with your variable values substituted.</Step>
            <Step n={5}>Click <strong>Send Message</strong>. A toast confirms success or shows the error from the provider.</Step>
          </div>

          <Tip>For sending to many contacts at once, use Campaigns instead. Send Message is for one-off individual messages only.</Tip>
        </section>

        {/* ── Campaigns ── */}
        <section id="campaigns" className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
              <Megaphone className="w-4.5 h-4.5 text-orange-500" style={{ width: 18, height: 18 }} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">WA Campaigns</h2>
          </div>

          <p className="text-sm text-gray-600">
            Send a WhatsApp template message to many opted-in contacts at once.
          </p>

          <div className="space-y-3">
            <Step n={1}><strong>Create</strong> — click New Campaign, give it a name and select a template. Optionally set a scheduled date for reference.</Step>
            <Step n={2}><strong>Run</strong> — click the <Play className="w-3 h-3 inline" /> play button. A modal opens showing all opted-in contacts.</Step>
            <Step n={3}>
              <strong>Filter recipients</strong> — use the two dropdowns at the top of the contact
              list to narrow the audience: <FeatureBadge label="Updated" />
              <ul className="list-disc list-inside mt-1 ml-2 space-y-0.5 text-gray-500">
                <li><strong>Tag filter</strong> — show only contacts that have a specific tag (e.g. <Code>vip</Code>)</li>
                <li><strong>Lead status filter</strong> — show only contacts in a specific CRM stage (e.g. <Code>qualified</Code>)</li>
              </ul>
            </Step>
            <Step n={4}><strong>Fill variables</strong> — if the template has <Code>{"{{1}}"}</Code> etc., fill them in the yellow section. The same value is sent to all recipients.</Step>
            <Step n={5}><strong>Send Now</strong> — messages are sent in parallel. A results card shows delivered / failed counts when done.</Step>
            <Step n={6}><strong>View stats</strong> — click the <BarChart2 className="w-3 h-3 inline" /> chart icon on any campaign to see delivery, read, and failure breakdown.</Step>
            <Step n={7}><strong>Duplicate</strong> — clone an existing campaign to reuse the same template with a different name or schedule.</Step>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { status: "Draft",     badge: "badge-gray",   desc: "Not yet sent" },
              { status: "Running",   badge: "badge-green",  desc: "Currently sending" },
              { status: "Paused",    badge: "badge-yellow", desc: "Temporarily stopped" },
              { status: "Completed", badge: "badge-blue",   desc: "Finished sending" },
            ].map((s) => (
              <div key={s.status} className="rounded-xl border border-gray-100 p-3 text-center space-y-1">
                <span className={`badge ${s.badge}`}>{s.status}</span>
                <p className="text-[10px] text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>

          <Tip>Only contacts with <Code>optIn = true</Code> appear in the run modal. A campaign cannot be deleted while it is Running.</Tip>
        </section>

        {/* ── Email Campaigns ── */}
        <section id="email" className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-pink-50 rounded-xl flex items-center justify-center shrink-0">
              <Mail className="w-4.5 h-4.5 text-pink-500" style={{ width: 18, height: 18 }} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Email Campaigns</h2>
          </div>

          <div className="space-y-3">
            <Step n={1}>Configure SMTP first in <NavLink href="/settings" label="Settings → Email" />. Without SMTP, email campaigns cannot be sent.</Step>
            <Step n={2}>Create a campaign with a subject and HTML/text body.</Step>
            <Step n={3}>Select recipients from your contacts (those with email addresses).</Step>
            <Step n={4}>Send immediately or schedule for later.</Step>
          </div>

          <Tip>Contacts need a valid email address to receive email campaigns. Phone-only contacts are excluded automatically.</Tip>
        </section>

        {/* ── Inbox ── */}
        <section id="inbox" className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-cyan-50 rounded-xl flex items-center justify-center shrink-0">
              <Inbox className="w-4.5 h-4.5 text-cyan-500" style={{ width: 18, height: 18 }} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Inbox</h2>
          </div>

          <p className="text-sm text-gray-600">
            View and reply to incoming WhatsApp messages from your contacts. Messages arrive here
            when contacts reply to your campaigns or send you a message directly.
          </p>

          <div className="space-y-3">
            <Step n={1}>The left panel lists all conversations sorted by most recent. Unread conversations appear <strong>bold</strong> with a green badge showing the unread count.</Step>
            <Step n={2}>Click a conversation to open the full message thread on the right. Sent messages (your templates) appear on the right in green; received messages appear on the left in white.</Step>
            <Step n={3}>To reply, type the template name (e.g. <Code>hello_world</Code>) in the compose bar, select the language, and click <strong>Send</strong>. You can also click the <Bot className="w-3 h-3 inline" /> bot icon to browse templates.</Step>
            <Step n={4}>Click <strong>Profile</strong> in the thread header to jump directly to the contact's full profile page.</Step>
          </div>

          <Tip>WhatsApp only allows template messages outside the 24-hour customer service window. If a contact messaged you within the last 24 hours you can reply freely; otherwise only approved templates work.</Tip>
        </section>

        {/* ── Sequences ── */}
        <section id="sequences" className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center shrink-0">
              <GitBranch className="w-4.5 h-4.5 text-violet-500" style={{ width: 18, height: 18 }} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Drip Sequences</h2>
          </div>

          <p className="text-sm text-gray-600">
            Automatically send a series of WhatsApp template messages to contacts over multiple
            days — perfect for onboarding, follow-ups, or nurture campaigns.
          </p>

          <div className="space-y-3">
            <Step n={1}><strong>Create</strong> — click New Sequence, give it a name, then add steps. Each step has a template name, language, and delay in days after the previous step.</Step>
            <Step n={2}><strong>Activate</strong> — click the <Play className="w-3 h-3 inline" /> play button on the sequence card. Only active sequences can enroll contacts.</Step>
            <Step n={3}><strong>Enroll contacts</strong> — click the <Users className="w-3 h-3 inline" /> users button. Search and select contacts, then click Enroll. Each contact can only be enrolled once per sequence.</Step>
            <Step n={4}><strong>Scheduler runs automatically</strong> — the backend job checks every hour and sends the next step when the delay has elapsed.</Step>
            <Step n={5}><strong>Pause</strong> — pausing a sequence stops new sends but does not cancel enrollments. Re-activate to resume.</Step>
          </div>

          {/* Enrollment progress */}
          <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              Enrollment Progress <FeatureBadge label="New" />
            </p>
            <p className="text-xs text-gray-600">
              Click the <ChevronRight className="w-3 h-3 inline" /> expand arrow on a sequence card
              to reveal the step list and — if contacts are enrolled — an enrollment progress panel.
              Each contact shows a row of coloured dots representing sequence steps:
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-gray-600 pl-1">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand inline-block" /> Completed step</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand/40 ring-2 ring-brand/30 inline-block" /> Current step (in progress)</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" /> Upcoming step</div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Example: 3-step onboarding</p>
            <div className="space-y-2">
              {[
                { step: 1, template: "welcome_message",  delay: "Immediately" },
                { step: 2, template: "feature_highlight", delay: "After 2 days" },
                { step: 3, template: "feedback_request",  delay: "After 5 days" },
              ].map((s) => (
                <div key={s.step} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center shrink-0">{s.step}</span>
                  <code className="text-xs text-gray-700 flex-1">{s.template}</code>
                  <span className="text-[10px] text-gray-400">{s.delay}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CRM ── */}
        <section id="crm" className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
              <Kanban className="w-4.5 h-4.5 text-amber-500" style={{ width: 18, height: 18 }} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">CRM Pipeline</h2>
          </div>

          <p className="text-sm text-gray-600">
            Visualize your contacts as leads moving through a sales pipeline using a Kanban board.
          </p>

          <div className="flex gap-2 flex-wrap">
            {["New", "Prospect", "Qualified", "Customer", "Churned"].map((s, i) => (
              <div key={s} className="flex items-center gap-1.5 text-xs">
                <ChevronRight className="w-3 h-3 text-gray-300" />
                <span className="font-medium text-gray-700">{s}</span>
                {i === 4 && <span className="text-gray-300 ml-0.5" />}
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Step n={1}>All contacts start in the <strong>New</strong> column by default.</Step>
            <Step n={2}>Click <strong>Move to [next stage]</strong> on a contact card to advance it through the pipeline.</Step>
            <Step n={3}>Use the small pill buttons on each card to move a contact to any other stage directly.</Step>
            <Step n={4}>Click a contact's name or the arrow icon to open their full profile and message history.</Step>
          </div>

          <Good>The lead status is also used as a filter in Campaign run modals — so you can send a campaign only to <Code>qualified</Code> leads, for example.</Good>
        </section>

        {/* ── Auto-Replies ── */}
        <section id="auto-replies" className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
              <Bot className="w-4.5 h-4.5 text-teal-500" style={{ width: 18, height: 18 }} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Auto-Replies</h2>
          </div>

          <p className="text-sm text-gray-600">
            Automatically reply to incoming WhatsApp messages that contain specific keywords.
          </p>

          <div className="space-y-3">
            <Step n={1}>Create a rule with a <strong>keyword</strong> (e.g. <Code>PRICE</Code>, <Code>HELP</Code>, <Code>STOP</Code>).</Step>
            <Step n={2}>Set the <strong>reply template</strong> to send when that keyword is detected in an incoming message.</Step>
            <Step n={3}>Rules are matched case-insensitively. The first matching rule wins.</Step>
            <Step n={4}>Toggle rules on/off without deleting them using the active switch.</Step>
          </div>

          <Tip>Auto-replies count against your Meta API message quota. Use them for high-value keywords only — not every possible word.</Tip>
        </section>

        {/* ── Analytics ── */}
        <section id="analytics" className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
              <BarChart2 className="w-4.5 h-4.5 text-indigo-500" style={{ width: 18, height: 18 }} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Analytics</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { metric: "Delivery Rate", desc: "% of messages that reached the recipient (delivered + read ÷ total sent)" },
              { metric: "Read Rate",     desc: "% of messages opened by the recipient (requires Meta read receipts enabled)" },
              { metric: "Failure Rate",  desc: "% of messages that failed — check your credentials or recipient's number if high" },
              { metric: "Opt-in Rate",   desc: "% of your total contacts who have opted in to receive messages" },
            ].map((m) => (
              <div key={m.metric} className="rounded-xl border border-gray-100 p-3 space-y-1">
                <p className="text-sm font-semibold text-gray-800">{m.metric}</p>
                <p className="text-xs text-gray-500">{m.desc}</p>
              </div>
            ))}
          </div>

          <Good>Click the refresh button in the top-right corner to reload analytics without a full page reload.</Good>
        </section>

        {/* ── Webhooks ── */}
        <section id="webhooks" className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center shrink-0">
              <Webhook className="w-4.5 h-4.5 text-rose-500" style={{ width: 18, height: 18 }} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Outbound Webhooks</h2>
          </div>

          <p className="text-sm text-gray-600">
            Send real-time HTTP POST notifications to your own server when events happen in the platform.
          </p>

          <div className="space-y-3">
            <Step n={1}>Go to <NavLink href="/webhooks" label="Webhooks" /> and click <strong>Add endpoint</strong>.</Step>
            <Step n={2}>Enter your endpoint URL — must use HTTPS and be publicly accessible (e.g. <Code>https://yourapp.com/hooks/whatsapp</Code>).</Step>
            <Step n={3}>
              Select which events to subscribe to:
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {["message.inbound","message.delivered","message.read","message.failed","contact.opted_out","contact.opted_in","campaign.completed","sequence.step_sent"].map((ev) => (
                  <Code key={ev}>{ev}</Code>
                ))}
              </div>
            </Step>
            <Step n={4}>Optionally add a <strong>signing secret</strong>. Every request will include an <Code>X-Webhook-Signature: sha256=…</Code> header so you can verify the payload is genuine.</Step>
            <Step n={5}>Use the <Send className="w-3 h-3 inline" /> send icon on an endpoint card to fire a test payload and confirm your server is receiving correctly.</Step>
          </div>

          {/* Delivery logs */}
          <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-rose-500" />
              Delivery Logs <FeatureBadge label="New" />
            </p>
            <p className="text-xs text-gray-600">
              Click the <History className="w-3 h-3 inline" /> history icon on any endpoint card to
              expand its last 20 delivery attempts. Each row shows the event name, HTTP status code,
              duration in milliseconds, and any error message. Green = success, red = failure.
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 text-xs font-mono text-gray-600 space-y-0.5">
            <p className="text-gray-400 font-sans font-semibold text-[10px] uppercase tracking-widest mb-1">Example payload</p>
            <p>{"{"}</p>
            <p>&nbsp;&nbsp;"event": "message.inbound",</p>
            <p>&nbsp;&nbsp;"timestamp": "2025-06-01T10:30:00.000Z",</p>
            <p>&nbsp;&nbsp;"data": {"{"}</p>
            <p>&nbsp;&nbsp;&nbsp;&nbsp;"messageId": "wamid.xxx",</p>
            <p>&nbsp;&nbsp;&nbsp;&nbsp;"fromPhone": "+919876543210",</p>
            <p>&nbsp;&nbsp;&nbsp;&nbsp;"fromName": "Alice",</p>
            <p>&nbsp;&nbsp;&nbsp;&nbsp;"type": "text",</p>
            <p>&nbsp;&nbsp;&nbsp;&nbsp;"body": "Hello, I need help"</p>
            <p>&nbsp;&nbsp;{"}"}</p>
            <p>{"}"}</p>
          </div>

          <Tip>Webhook delivery is fire-and-forget — if your endpoint returns a non-2xx status the event is not automatically retried. Check the delivery logs to diagnose failures.</Tip>
        </section>

        {/* Footer */}
        <div className="card bg-brand/5 border-brand/20 text-center py-8 space-y-2">
          <BookOpen className="w-8 h-8 text-brand mx-auto" />
          <p className="font-bold text-gray-900">That covers everything!</p>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            If something isn't working, check Settings first — most issues come from missing
            provider credentials or an inactive license.
          </p>
          <Link href="/dashboard" className="btn-primary mt-2 inline-flex">
            Go to Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
}
