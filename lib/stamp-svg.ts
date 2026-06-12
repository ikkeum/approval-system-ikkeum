import DOMPurify from "isomorphic-dompurify";

/**
 * 구버전 직인 SVG 에 viewBox 가 없으면 width/height 로 보정.
 * (StampPanel / 결재 상세에 중복 정의돼 있던 normalizeStampSvg 통합)
 */
function normalizeStampSvg(svg: string): string {
  if (/viewBox\s*=/.test(svg)) return svg;
  const m = svg.match(/<svg([^>]*)>/);
  if (!m) return svg;
  const attrs = m[1];
  const w = attrs.match(/\bwidth\s*=\s*["'](\d+(?:\.\d+)?)/)?.[1];
  const h = attrs.match(/\bheight\s*=\s*["'](\d+(?:\.\d+)?)/)?.[1];
  if (!w || !h) return svg;
  return svg.replace(/<svg([^>]*)>/, `<svg$1 viewBox="0 0 ${w} ${h}">`);
}

/**
 * DB(profiles.stamp_svg)의 SVG 를 dangerouslySetInnerHTML 로 렌더하기 전 반드시 통과.
 * profiles_self_update 정책상 사용자가 자기 stamp_svg 에 임의 마크업을 저장할 수 있고,
 * 직인은 타인(결재자/관리자) 브라우저에서 렌더되므로 저장형 XSS 싱크가 된다.
 */
export function sanitizeStampSvg(svg: string | null | undefined): string {
  if (!svg) return "";
  return DOMPurify.sanitize(normalizeStampSvg(svg), {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}
