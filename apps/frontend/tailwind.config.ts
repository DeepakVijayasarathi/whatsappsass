import type { Config } from "tailwindcss";

/**
 * COLOR TOKENS — keep these in sync with src/lib/brand.ts primaryColor/primaryDark/primaryLight.
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
    },
  },
  plugins: [],
};

export default config;
