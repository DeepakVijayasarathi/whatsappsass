/**
 * SITE CONFIGURATION — edit this file to rebrand AND reconfigure the app.
 *
 * • brand.*   → name, colors, tagline, auth panel copy, contact email
 * • nav.*     → sidebar menu items, labels, routes, roles, groups
 *
 * Every surface reads from here. Nothing else needs to change.
 */

// ─── Nav item type ────────────────────────────────────────────────────────────
export type NavRole  = "owner" | "admin" | "marketer";
export type NavGroup = "main" | "admin";
export type NavBadge = "inbox" | "sequences" | null;

export interface NavItem {
  href:   string;
  icon:   string;          // Lucide icon name — resolved in Sidebar.tsx
  label:  string;
  roles:  NavRole[];
  badge:  NavBadge;
  group:  NavGroup;
  /** Set false to hide item without deleting it */
  enabled?: boolean;
}

// ─── Navigation menu ──────────────────────────────────────────────────────────
export const nav: NavItem[] = [
  // ── Main section ──────────────────────────────────────────────────────────
  { href: "/dashboard",        icon: "LayoutDashboard", label: "Dashboard",       roles: ["owner","admin","marketer"], badge: null,    group: "main" },
  { href: "/contacts",         icon: "Users",           label: "Contacts",        roles: ["owner","admin","marketer"], badge: null,    group: "main" },
  { href: "/campaigns",        icon: "Megaphone",       label: "WA Campaigns",    roles: ["owner","admin","marketer"], badge: null,    group: "main" },
  { href: "/email-campaigns",  icon: "Mail",            label: "Email Campaigns", roles: ["owner","admin","marketer"], badge: null,    group: "main" },
  { href: "/send",             icon: "Send",            label: "Send Message",    roles: ["owner","admin","marketer"], badge: null,    group: "main" },
  { href: "/inbox",            icon: "Inbox",           label: "Inbox",           roles: ["owner","admin","marketer"], badge: "inbox", group: "main", enabled: false },
  { href: "/crm",              icon: "Kanban",          label: "CRM Pipeline",    roles: ["owner","admin","marketer"], badge: null,    group: "main" },
  { href: "/templates",        icon: "FileText",        label: "Templates",       roles: ["owner","admin","marketer"], badge: null,    group: "main" },
  { href: "/analytics",        icon: "BarChart2",       label: "Analytics",       roles: ["owner","admin","marketer"], badge: null,    group: "main" },
  { href: "/sequences",        icon: "GitBranch",       label: "Drip Sequences",  roles: ["owner","admin","marketer"], badge: "sequences", group: "main" },
  { href: "/guide",            icon: "BookOpen",        label: "How to Use",      roles: ["owner","admin","marketer"], badge: null,    group: "main" },

  // ── Admin section ─────────────────────────────────────────────────────────
  { href: "/auto-replies",     icon: "Bot",             label: "Auto-Replies",    roles: ["owner","admin"],            badge: null,    group: "admin" },
  { href: "/webhooks",         icon: "Webhook",         label: "Webhooks",        roles: ["owner","admin"],            badge: null,    group: "admin" },
  { href: "/admin/metrics",    icon: "LineChart",       label: "Metrics",         roles: ["owner","admin"],            badge: null,    group: "admin" },
  { href: "/admin/audit-log",  icon: "ClipboardList",   label: "Audit Log",       roles: ["owner","admin"],            badge: null,    group: "admin" },
  { href: "/admin/workspaces", icon: "Shield",          label: "Super Admin",     roles: ["owner"],                    badge: null,    group: "admin" },
  { href: "/team",             icon: "UsersRound",      label: "Team",            roles: ["owner","admin"],            badge: null,    group: "admin" },
  { href: "/settings",         icon: "Settings",        label: "Settings",        roles: ["owner","admin"],            badge: null,    group: "admin" },
];

// ─── Branding ─────────────────────────────────────────────────────────────────
export const brand = {
  /** Short product name shown in nav, sidebar, browser tab, emails */
  name: "WA SaaS Lite",

  /** Full / marketing name used on the landing page hero */
  fullName: "WhatsApp SaaS Lite",

  /** One-line tagline for the landing page hero */
  tagline: "WhatsApp marketing, on your own server",

  /** Sub-tagline below hero headline */
  subTagline:
    "Send campaigns, manage contacts, automate replies, and close deals — all from one dashboard. Connect Meta Cloud API or MSG91. No SaaS markup.",

  /** Contact / support email (used in landing page pricing CTA) */
  contactEmail: "hello@example.com",

  /** Primary color — must match tailwind.config.ts brand.DEFAULT */
  primaryColor: "#25D366",

  /** Dark shade — must match tailwind.config.ts brand.dark */
  primaryDark: "#128C7E",

  /** Light shade — must match tailwind.config.ts brand.light */
  primaryLight: "#DCF8C6",

  /** Background color for the page/body (CSS class applied in globals.css) */
  bodyBg: "bg-slate-50",

  /** Text shown in the sidebar under the workspace name */
  planLabel: "lite",

  /** Auth page left-panel gradient  (Tailwind from-* to-* values) */
  authGradient: "from-[#25D366] to-[#128C7E]",

  /** Auth panel headline on login screen */
  authLoginHeadline: "Welcome back",

  /** Auth panel headline on register screen */
  authRegisterHeadline: "Start for free",

  /** Perks shown on the register left panel */
  authPerks: [
    "Free to self-host — no per-message fees",
    "WhatsApp & Email campaigns in one place",
    "Two-way inbox with auto-replies",
    "CRM pipeline & drip sequences",
  ],
} as const;
