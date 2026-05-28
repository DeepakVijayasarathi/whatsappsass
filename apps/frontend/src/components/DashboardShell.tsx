"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, MessageSquare } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { brand } from "@/lib/brand";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Auto-close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Close sidebar on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sidebarOpen) setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Skip-to-main-content link — shown only on keyboard focus */}
      <a
        href="#main-content"
        className="
          sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200]
          focus:bg-white focus:text-brand focus:font-semibold focus:text-sm
          focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-md
          focus:ring-2 focus:ring-brand focus:ring-offset-2
          transition-all
        "
      >
        Skip to main content
      </a>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile backdrop — traps focus within sidebar when open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 lg:ml-64 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3 shadow-xs">
          <button
            onClick={() => setSidebarOpen(true)}
            className="icon-btn"
            aria-label="Open navigation menu"
            aria-expanded={sidebarOpen}
            aria-controls="sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <span className="font-bold text-gray-900 text-sm tracking-tight">{brand.name}</span>
          </div>
        </header>

        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
