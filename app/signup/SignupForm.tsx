"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type SignupState } from "./actions";

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
};

export default function SignupForm() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(
    signupAction,
    null,
  );

  if (state?.ok) {
    return (
      <div style={card}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
          확인 메일을 보냈어요
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
          <strong>{state.email}</strong> 로 확인 링크를 보냈습니다.
          <br />
          받은편지함(스팸함 포함)을 확인해서 링크를 눌러주세요.
        </p>
        <Link
          href="/login"
          style={{
            display: "inline-block",
            marginTop: 20,
            color: "#185fa5",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          로그인 페이지로
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} style={card}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>
        회원가입
      </h1>

      <div style={{ marginBottom: 16 }}>
        <label style={label}>이름</label>
        <input
          type="text"
          name="name"
          required
          maxLength={40}
          style={input}
          placeholder="홍길동"
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={label}>회사 이메일</label>
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
        <label style={label}>비밀번호 (8자 이상)</label>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          style={input}
        />
      </div>

      {state && !state.ok && state.error && (
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
        {pending ? "처리 중..." : "회원가입"}
      </button>

      <div
        style={{
          marginTop: 20,
          textAlign: "center",
          fontSize: 13,
          color: "#6b7280",
        }}
      >
        이미 계정이 있으신가요?{" "}
        <Link href="/login" style={{ color: "#185fa5", fontWeight: 600 }}>
          로그인
        </Link>
      </div>
    </form>
  );
}
