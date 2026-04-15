import type { Metadata, Viewport } from "next";
import { Monitor } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "사내 전자결재",
  description: "Ikkeum Approval",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        {children}
        <div className="mobile-block" role="alert" aria-live="polite">
          <Monitor size={56} strokeWidth={1.5} color="#9CA3AF" />
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>
            데스크톱에서 접속해주세요
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#D1D5DB",
              maxWidth: 320,
            }}
          >
            사내 전자결재는 현재 데스크톱 웹 환경에 맞춰져 있습니다.
            <br />
            모바일·태블릿 최적화는 준비 중입니다.
          </p>
          <p style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>
            브라우저 창을 넓히시거나 PC에서 다시 접속해주세요.
          </p>
        </div>
      </body>
    </html>
  );
}
