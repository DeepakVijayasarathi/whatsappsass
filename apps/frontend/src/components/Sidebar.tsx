"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, Megaphone, Send, Inbox, BarChart2,
  Settings, LogOut, MessageSquare, UserCircle, UsersRound,
  FileText, Mail, ClipboardList, Shield, LineChart, Kanban,
  X, Bot, Webhook, GitBranch, BookOpen,
} from "lucide-react";
import { clearAuth, getUser, getWorkspace } from "@/lib/auth";
import { useInboxNotifications } from "@/lib/useInboxNotifications";
import { brand, nav } from "@/lib/brand";
import type { NavRole } from "@/lib/brand";

// ── Icon name → component map (mirrors the icon names used in brand.ts) ──────
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Users, Megaphone, Send, Inbox, BarChart2,
  Settings, MessageSquare, UsersRound,
  FileText, Mail, ClipboardList, Shield, LineChart, Kanban,
  Bot, Webhook, GitBranch, BookOpen,
};

interface Props { open?: boolean; onClose?: () => void; }

export default function Sidebar({ open = false, onClose }: Props) {
  const pathname  = usePathname();
  const router    = useRouter();
  const user      = getUser();
  const workspace = getWorkspace();
  const [unreadCount, setUnreadCount] = useState(0);

  useInboxNotifications(setUnreadCount);

  const handleLogout = () => { clearAuth(); router.push("/login"); };

  const role = (user?.role ?? "marketer") as NavRole;
  const visible    = nav.filter((i) => (i.enabled ?? true) && i.roles.includes(role));
  const mainItems  = visible.filter((i) => i.group === "main");
  const adminItems = visible.filter((i) => i.group === "admin");

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 z-40 w-64 h-screen flex flex-col",
        "bg-white border-r border-gray-100",
        "transition-transform duration-200 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      {/* ── Workspace header ── */}
      <div className="px-4 py-4 border-b border-gray-100 flex items-center gap-3 min-h-[64px]">
        <div className="w-9 h-9 bg-gradient-to-br from-brand to-brand-dark rounded-xl flex items-center justify-center shrink-0 shadow-sm">
          <MessageSquare className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-gray-900 truncate leading-tight">
            {workspace?.name ?? "Workspace"}
          </p>
          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">
            {workspace?.plan ?? brand.planLabel} plan
          </span>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden icon-btn shrink-0"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 scroll-area">

        {/* Main section */}
        <div className="space-y-0.5">
          {mainItems.map(({ href, icon, label, badge }) => {
            const Icon = ICONS[icon] ?? FileText;
            const active = isActive(href);
            const showBadge = badge === "inbox" && unreadCount > 0;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-brand/10 text-brand"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon className={clsx("w-4 h-4 shrink-0", active ? "text-brand" : "text-gray-400")} />
                <span className="flex-1 truncate">{label}</span>
                {showBadge && (
                  <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Admin section */}
        {adminItems.length > 0 && (
          <div className="mt-4">
            <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Admin
            </p>
            <div className="space-y-0.5">
              {adminItems.map(({ href, icon, label }) => {
                const Icon = ICONS[icon] ?? FileText;
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-brand/10 text-brand"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <Icon className={clsx("w-4 h-4 shrink-0", active ? "text-brand" : "text-gray-400")} />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* ── User footer ── */}
      <div className="p-3 border-t border-gray-100 space-y-1">
        <Link
          href="/profile"
          className={clsx(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150",
            pathname === "/profile"
              ? "bg-brand/10 text-brand"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          )}
        >
          <div className="w-7 h-7 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-gray-600">
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
          <UserCircle className="w-4 h-4 shrink-0 text-gray-300" />
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
