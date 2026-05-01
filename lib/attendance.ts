import "server-only";
import ipaddr from "ipaddr.js";

type IPAddr = ipaddr.IPv4 | ipaddr.IPv6;
type ParsedRange = { addr: IPAddr; bits: number };

let cached: { raw: string | undefined; ranges: ParsedRange[] } | null = null;

export function parseAllowlist(value: string): ParsedRange[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseEntry)
    .filter((x): x is ParsedRange => x !== null);
}

function parseEntry(entry: string): ParsedRange | null {
  try {
    if (entry.includes("/")) {
      const [ipStr, bitsStr] = entry.split("/");
      const bits = parseInt(bitsStr, 10);
      if (Number.isNaN(bits)) return null;
      const addr = ipaddr.parse(ipStr);
      return { addr, bits };
    }
    const addr = ipaddr.parse(entry);
    return { addr, bits: addr.kind() === "ipv4" ? 32 : 128 };
  } catch {
    return null;
  }
}

function getRanges(): ParsedRange[] {
  const raw = process.env.COMPANY_IP_ALLOWLIST;
  if (cached && cached.raw === raw) return cached.ranges;
  const ranges = parseAllowlist(raw ?? "");
  cached = { raw, ranges };
  return ranges;
}

/**
 * 클라이언트 IP가 사내 allowlist 안에 있는지 검사.
 * allowlist 가 비어있으면 항상 false (안전 기본값: 차단).
 */
export function isIpAllowed(clientIp: string | null): boolean {
  if (!clientIp) return false;
  const ranges = getRanges();
  if (ranges.length === 0) return false;

  let parsed: IPAddr;
  try {
    parsed = ipaddr.parse(clientIp);
  } catch {
    return false;
  }

  // IPv4-mapped IPv6 (e.g. ::ffff:1.2.3.4) → IPv4 로 정규화
  if (parsed.kind() === "ipv6") {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) parsed = v6.toIPv4Address();
  }

  return ranges.some((r) => {
    if (parsed.kind() !== r.addr.kind()) return false;
    try {
      return (parsed as ipaddr.IPv4).match(r.addr as ipaddr.IPv4, r.bits);
    } catch {
      return false;
    }
  });
}

/**
 * KST 기준 오늘 날짜 (YYYY-MM-DD).
 * 출퇴근의 work_date 는 사용자가 인지하는 "오늘"이어야 하므로 KST 고정.
 */
export function todayKst(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/**
 * KST 기준 어제 날짜 (YYYY-MM-DD). 자정 넘어 퇴근 폴백용.
 */
export function yesterdayKst(now: Date = new Date()): string {
  return new Date(now.getTime() - 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Seoul",
  });
}

/**
 * YYYY-MM-DD 가 KST 기준 토/일인지. 정오 KST 시각으로 변환해 요일을 본다.
 */
export function isWeekend(dateStr: string): boolean {
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}
