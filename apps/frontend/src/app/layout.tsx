import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { brand } from "@/lib/brand";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",            // Prevent FOIT — show fallback font while loading
  variable: "--font-inter",   // CSS variable for potential future theming
  // Preload only the weights we actually use
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,            // Allow pinch-zoom (accessibility — don't lock to 1)
  themeColor: brand.primaryColor,
};

export const metadata: Metadata = {
  title: {
    default: brand.fullName,
    template: `%s — ${brand.name}`,  // Individual pages can set their own title
  },
  description: brand.subTagline,
  robots: { index: false, follow: false }, // Self-hosted — don't index
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: "500",
              boxShadow: "0 4px 12px -1px rgb(0 0 0 / 0.12), 0 2px 4px -2px rgb(0 0 0 / 0.08)",
              maxWidth: "380px",
            },
            success: {
              iconTheme: { primary: "#25D366", secondary: "#ffffff" },
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "#ffffff" },
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}
