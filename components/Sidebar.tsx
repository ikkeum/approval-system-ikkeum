"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  FileText,
  UserRound,
  Clock,
  CalendarDays,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; icon: LucideIcon; label: string };

const BASE_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "대시보드" },
  { href: "/approvals", icon: Inbox, label: "결재함" },
  { href: "/mydocs", icon: FileText, label: "내 문서" },
  { href: "/attendance", icon: Clock, label: "근태" },
  { href: "/profile", icon: UserRound, label: "프로필" },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin/members", icon: Settings, label: "조직 관리" },
  { href: "/admin/holidays", icon: CalendarDays, label: "휴일 관리" },
];

export default function Sidebar({
  userName,
  isAdmin,
}: {
  userName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const ITEMS = isAdmin ? [...BASE_ITEMS, ...ADMIN_ITEMS] : BASE_ITEMS;

  return (
    <aside
      style={{
        width: 220,
        background: "#1E1E1C",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      <div
        style={{
          padding: "20px 20px",
          fontSize: 16,
          fontWeight: 800,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/symbol.png"
          alt="Ikkeum"
          style={{
            height: 28,
            width: 28,
            borderRadius: 6,
            background: "#fff",
            padding: 2,
          }}
        />
        <span>사내 전자결재</span>
      </div>

      <nav style={{ flex: 1, paddingTop: 8 }}>
        {ITEMS.map((it) => {
          const active =
            pathname === it.href || pathname.startsWith(it.href + "/");
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 20px",
                background: active ? "rgba(24,95,165,0.25)" : "transparent",
                color: active ? "#7EB5E8" : "#9CA3AF",
                fontWeight: active ? 700 : 500,
                fontSize: 14,
                borderLeft: active
                  ? "3px solid #185FA5"
                  : "3px solid transparent",
              }}
            >
              <Icon size={16} strokeWidth={2} />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          padding: "14px 20px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          fontSize: 12,
          color: "#9CA3AF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>{userName}</span>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            style={{
              background: "transparent",
              border: "none",
              color: "#9CA3AF",
              fontSize: 12,
              cursor: "pointer",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <LogOut size={12} />
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
