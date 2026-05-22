"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Send,
  BarChart2,
  Settings,
  LogOut,
  MessageSquare,
  Inbox,
} from "lucide-react";
import { clearAuth, getUser, getWorkspace } from "@/lib/auth";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/contacts", icon: Users, label: "Contacts" },
  { href: "/campaigns", icon: Megaphone, label: "Campaigns" },
  { href: "/send", icon: Send, label: "Send Message" },
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/analytics", icon: BarChart2, label: "Analytics" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();
  const workspace = getWorkspace();

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">
              {workspace?.name ?? "Workspace"}
            </p>
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              {workspace?.plan ?? "lite"}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-brand/10 text-brand"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3 px-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-gray-600">
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
