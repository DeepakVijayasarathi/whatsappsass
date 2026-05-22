"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Send,
  Inbox,
  BarChart2,
  Settings,
  LogOut,
  MessageSquare,
  UserCircle,
  UsersRound,
} from "lucide-react";
import { clearAuth, getUser, getWorkspace } from "@/lib/auth";

const navItems = [
  { href: "/dashboard",  icon: LayoutDashboard, label: "Dashboard",    roles: ["owner", "admin", "marketer"] },
  { href: "/contacts",   icon: Users,            label: "Contacts",     roles: ["owner", "admin", "marketer"] },
  { href: "/campaigns",  icon: Megaphone,        label: "Campaigns",    roles: ["owner", "admin", "marketer"] },
  { href: "/send",       icon: Send,             label: "Send Message", roles: ["owner", "admin", "marketer"] },
  { href: "/inbox",      icon: Inbox,            label: "Inbox",        roles: ["owner", "admin", "marketer"] },
  { href: "/analytics",  icon: BarChart2,        label: "Analytics",    roles: ["owner", "admin", "marketer"] },
  { href: "/team",       icon: UsersRound,       label: "Team",         roles: ["owner", "admin"] },
  { href: "/settings",   icon: Settings,         label: "Settings",     roles: ["owner", "admin"] },
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

  const visible = navItems.filter((item) =>
    item.roles.includes(user?.role ?? "marketer")
  );

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen fixed left-0 top-0">
      {/* Workspace header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 truncate">
              {workspace?.name ?? "Workspace"}
            </p>
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              {workspace?.plan ?? "lite"} plan
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visible.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-brand/10 text-brand"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-gray-100">
        <Link
          href="/profile"
          className={clsx(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors",
            pathname === "/profile"
              ? "bg-brand/10 text-brand"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          )}
        >
          <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-gray-600">
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
          <UserCircle className="w-4 h-4 shrink-0 text-gray-400" />
        </Link>

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
