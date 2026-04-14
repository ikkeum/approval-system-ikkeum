import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "사내 전자결재",
  description: "Ikkeum Approval",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
