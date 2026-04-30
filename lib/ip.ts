import "server-only";

/**
 * 클라이언트 실 IP 추출. Vercel/프록시 환경에서는 x-forwarded-for 의 첫 값.
 */
export function getClientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}
