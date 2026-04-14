"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE_ITEMS = [
  { href: "/dashboard", icon: "▦", label: "대시보드" },
  { href: "/approvals", icon: "✓", label: "결재함" },
  { href: "/mydocs", icon: "◎", label: "내 문서" },
  { href: "/profile", icon: "◉", label: "프로필" },
];

const ADMIN_ITEM = { href: "/admin/members", icon: "⚙", label: "조직 관리" };

export default function Sidebar({
  userName,
  isAdmin,
}: {
  userName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const ITEMS = isAdmin ? [...BASE_ITEMS, ADMIN_ITEM] : BASE_ITEMS;

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
              <span style={{ fontSize: 16 }}>{it.icon}</span>
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
            }}
          >
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
