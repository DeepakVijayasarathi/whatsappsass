/**
 * BRANDING CONFIGURATION — edit this file to rebrand the entire app.
 *
 * Every surface (sidebar, landing page, login/register, metadata, emails)
 * reads from here. Nothing else needs to change.
 */

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
