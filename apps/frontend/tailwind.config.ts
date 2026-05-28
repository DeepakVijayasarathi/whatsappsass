import type { Config } from "tailwindcss";

/**
 * COLOR TOKENS — keep in sync with:
 *   src/lib/brand.ts  (primaryColor / primaryDark / primaryLight)
 *   src/app/globals.css  (--brand / --brand-dark)
 *
 * Change all three places together when rebranding.
 */
const BRAND_PRIMARY = "#25D366"; // brand.primaryColor
const BRAND_DARK    = "#128C7E"; // brand.primaryDark
const BRAND_LIGHT   = "#DCF8C6"; // brand.primaryLight

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: BRAND_PRIMARY,
          dark:    BRAND_DARK,
          light:   BRAND_LIGHT,
        },
      },
      // ── Shadow scale ───────────────────────────────────────────────────
      boxShadow: {
        // Elevation system — use these instead of arbitrary values
        "xs":   "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "sm":   "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)",
        "md":   "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
        "lg":   "0 10px 15px -3px rgb(0 0 0 / 0.07), 0 4px 6px -4px rgb(0 0 0 / 0.07)",
        "xl":   "0 20px 25px -5px rgb(0 0 0 / 0.07), 0 8px 10px -6px rgb(0 0 0 / 0.07)",
        "2xl":  "0 25px 50px -12px rgb(0 0 0 / 0.18)",
        // Card system
        "card": "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        "card-hover": "0 4px 12px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
        // Modal
        "modal": "0 25px 50px -12px rgb(0 0 0 / 0.22), 0 0 0 1px rgb(0 0 0 / 0.05)",
        // Focus ring (not usually a shadow but useful for complex focus states)
        "focus-brand": `0 0 0 2px #fff, 0 0 0 4px ${BRAND_PRIMARY}`,
      },
      // ── Typography scale ────────────────────────────────────────────────
      fontSize: {
        // Enforce minimum readable size — 10px and 9px are accessibility violations
        // Map to 11px minimum
        "2xs": ["11px", { lineHeight: "16px", letterSpacing: "0.01em" }],
        "xs":  ["12px", { lineHeight: "18px" }],
        "sm":  ["14px", { lineHeight: "21px" }],
        "base":["16px", { lineHeight: "24px" }],
        "lg":  ["18px", { lineHeight: "28px" }],
        "xl":  ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "36px" }],
      },
      // ── Border radius ────────────────────────────────────────────────────
      borderRadius: {
        "xl":  "12px",
        "2xl": "16px",
        "3xl": "24px",
      },
      // ── Animation ────────────────────────────────────────────────────────
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(4px)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "fade-out": "fade-out 0.1s ease-in",
        "slide-up": "slide-up 0.2s ease-out",
        "scale-in": "scale-in 0.15s ease-out",
      },
      // ── Spacing ──────────────────────────────────────────────────────────
      spacing: {
        "4.5": "18px",
        "18":  "72px",
        "22":  "88px",
      },
      // ── Screens ──────────────────────────────────────────────────────────
      screens: {
        "xs": "480px",
        // Inherits: sm(640), md(768), lg(1024), xl(1280), 2xl(1536)
      },
    },
  },
  plugins: [],
};

export default config;
