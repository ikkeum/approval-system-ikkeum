"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function normalizeStampSvg(svg: string | null | undefined): string {
  if (!svg) return "";
  if (/viewBox\s*=/.test(svg)) return svg;
  const m = svg.match(/<svg([^>]*)>/);
  if (!m) return svg;
  const attrs = m[1];
  const w = attrs.match(/\bwidth\s*=\s*["'](\d+(?:\.\d+)?)/)?.[1];
  const h = attrs.match(/\bheight\s*=\s*["'](\d+(?:\.\d+)?)/)?.[1];
  if (!w || !h) return svg;
  return svg.replace(/<svg([^>]*)>/, `<svg$1 viewBox="0 0 ${w} ${h}">`);
}

export default function StampPanel({
  name,
  initialSvg,
}: {
  name: string;
  initialSvg: string | null;
}) {
  const router = useRouter();
  const [svg, setSvg] = useState(initialSvg);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(force: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stamp${force ? "?force=1" : ""}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "생성 실패");
      setSvg(json.svg);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #E5E7EB",
        padding: 24,
      }}
    >
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
        내 직인
      </h2>
      <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>
        이름 <strong>{name}</strong> 기반으로 생성됩니다. 승인·반려 시 자동으로 첨부됩니다.
      </p>

      {svg ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div
            className="stamp-frame"
            style={{
              width: 180,
              height: 180,
              border: "1px dashed #E5E7EB",
              borderRadius: 8,
              background: "#FAFBFC",
            }}
            dangerouslySetInnerHTML={{ __html: normalizeStampSvg(svg) }}
          />
          <button onClick={() => generate(true)} disabled={loading} style={btn}>
            {loading ? "재생성 중..." : "다시 생성"}
          </button>
        </div>
      ) : (
        <button onClick={() => generate(false)} disabled={loading} style={btn}>
          {loading ? "생성 중..." : "직인 생성"}
        </button>
      )}

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#DC2626",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
    </section>
  );
}

const btn: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "1.5px solid #E5E7EB",
  background: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};
