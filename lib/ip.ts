import "server-only";

/**
 * 클라이언트 실 IP 추출.
 *
 * - `x-real-ip` 는 Vercel 이 직접 세팅하므로 신뢰 가능 → 최우선.
 * - `x-forwarded-for` 는 클라이언트가 보낸 값 "뒤에" 프록시가 실제 IP 를
 *   append 하므로, 가장 오른쪽 값만 신뢰한다. (왼쪽 값을 쓰면
 *   `X-Forwarded-For: <사내IP>` 헤더 주입으로 IP 검증이 우회된다)
 */
export function getClientIp(request: Request): string | null {
  const real = request.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return null;
}
