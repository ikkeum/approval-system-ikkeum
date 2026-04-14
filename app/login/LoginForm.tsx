"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  padding: 32,
  width: "100%",
  maxWidth: 400,
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1.5px solid #e5e7eb",
  fontSize: 14,
  outline: "none",
  background: "#fafbfc",
};

const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#6b7280",
  marginBottom: 6,
  display: "block",
};

const btn: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: 8,
  border: "none",
  background: "#185fa5",
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(24,95,165,0.2)",
};

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    null,
  );

  return (
    <form action={formAction} style={card}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>
        사내 전자결재
      </h1>

      <input type="hidden" name="next" value={next} />

      <div style={{ marginBottom: 16 }}>
        <label style={label}>이메일</label>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          style={input}
          placeholder="name@회사도메인.com"
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={label}>비밀번호</label>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          style={input}
        />
      </div>

      {state?.error && (
        <div
          style={{
            padding: "10px 12px",
            marginBottom: 16,
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            color: "#dc2626",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {state.error}
        </div>
      )}

      <button type="submit" disabled={pending} style={btn}>
        {pending ? "로그인 중..." : "로그인"}
      </button>

      <div
        style={{
          marginTop: 20,
          textAlign: "center",
          fontSize: 13,
          color: "#6b7280",
        }}
      >
        계정이 없으신가요?{" "}
        <Link href="/signup" style={{ color: "#185fa5", fontWeight: 600 }}>
          회원가입
        </Link>
      </div>
    </form>
  );
}
