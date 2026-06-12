import { describe, it, expect } from "vitest";
import { getClientIp } from "@/lib/ip";

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/attendance/check-in", {
    method: "POST",
    headers,
  });
}

describe("getClientIp", () => {
  it("x-real-ip 가 있으면 x-forwarded-for 보다 우선한다", () => {
    const r = req({
      "x-forwarded-for": "203.0.113.10, 198.51.100.7",
      "x-real-ip": "198.51.100.7",
    });
    expect(getClientIp(r)).toBe("198.51.100.7");
  });

  it("클라이언트가 주입한 XFF 왼쪽 값(스푸핑)을 신뢰하지 않는다", () => {
    // Vercel 은 수신한 XFF 뒤에 실제 IP 를 append 한다:
    // 공격자가 "X-Forwarded-For: 203.0.113.10"(사내IP)을 보내면
    // 헤더는 "203.0.113.10, <실제IP>" 가 된다. 실제 IP 를 반환해야 한다.
    const r = req({ "x-forwarded-for": "203.0.113.10, 198.51.100.7" });
    expect(getClientIp(r)).toBe("198.51.100.7");
  });

  it("XFF 가 단일 값이면 그 값을 반환한다", () => {
    const r = req({ "x-forwarded-for": "198.51.100.7" });
    expect(getClientIp(r)).toBe("198.51.100.7");
  });

  it("헤더가 없으면 null (호출측에서 차단되는 안전 기본값)", () => {
    expect(getClientIp(req({}))).toBeNull();
  });

  it("공백/빈 항목을 정리한다", () => {
    const r = req({ "x-forwarded-for": "203.0.113.10 ,  198.51.100.7 , " });
    expect(getClientIp(r)).toBe("198.51.100.7");
  });
});
