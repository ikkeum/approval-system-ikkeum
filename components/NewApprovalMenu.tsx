"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { APPROVAL_TYPES } from "@/lib/approvals";

export default function NewApprovalMenu({
  variant = "primary",
}: {
  variant?: "primary" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const btnStyle =
    variant === "primary"
      ? {
          padding: "10px 20px",
          borderRadius: 8,
          background: "#185FA5",
          color: "#fff",
          fontWeight: 700,
          fontSize: 13,
          boxShadow: "0 2px 8px rgba(24,95,165,0.2)",
          border: "none",
          cursor: "pointer",
        }
      : {
          padding: "9px 18px",
          borderRadius: 8,
          background: "#fff",
          color: "#1E1E1C",
          fontWeight: 600,
          fontSize: 13,
          border: "1.5px solid #E5E7EB",
          cursor: "pointer",
        };

  return (
    <div style={{ position: "relative" }} ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={btnStyle}
      >
        + 기안 작성
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            padding: 6,
            minWidth: 220,
            zIndex: 50,
          }}
        >
          {APPROVAL_TYPES.map((t) => (
            <Link
              key={t.key}
              href={`/approvals/new?type=${t.key}`}
              onClick={() => setOpen(false)}
              style={{
                display: "block",
                padding: "10px 14px",
                fontSize: 13,
                color: "#1E1E1C",
                borderRadius: 6,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#F4F5F7")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
