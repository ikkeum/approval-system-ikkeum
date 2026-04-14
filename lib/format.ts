export function formatKRW(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }) +
    " " +
    d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
}

export function diffDays(startISO: string, endISO: string): number {
  const s = new Date(startISO).getTime();
  const e = new Date(endISO).getTime();
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}
