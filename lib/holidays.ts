import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 공공데이터포털 특일정보(getRestDeInfo) API 응답.
 * 응답 구조: response.body.items.item[] (or single object)
 *   - dateName: 공휴일 이름 (예: "신정", "어린이날 대체")
 *   - locdate: YYYYMMDD (number)
 *   - isHoliday: 'Y' | 'N'
 */
type ApiItem = {
  dateName: string;
  locdate: number;
  isHoliday: "Y" | "N";
};

const API_URL =
  "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";

export async function fetchPublicHolidays(
  year: number,
): Promise<{ date: string; name: string }[]> {
  const apiKey = process.env.HOLIDAY_API_KEY;
  if (!apiKey) throw new Error("HOLIDAY_API_KEY 미설정");

  const url = new URL(API_URL);
  url.searchParams.set("serviceKey", apiKey);
  url.searchParams.set("solYear", String(year));
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("_type", "json");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`공공데이터 API 호출 실패: HTTP ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown>;

  // 에러 응답 체크 (resultCode !== '00')
  const header = (data?.response as Record<string, unknown> | undefined)?.header as
    | { resultCode?: string; resultMsg?: string }
    | undefined;
  if (header && header.resultCode !== "00") {
    throw new Error(`공공데이터 API 오류: ${header.resultMsg ?? "알 수 없음"}`);
  }

  const itemsRaw = (
    (data?.response as Record<string, unknown> | undefined)?.body as
      | Record<string, unknown>
      | undefined
  )?.items as { item?: ApiItem | ApiItem[] } | undefined;
  const itemsField = itemsRaw?.item;
  const items: ApiItem[] = Array.isArray(itemsField)
    ? itemsField
    : itemsField
      ? [itemsField]
      : [];

  return items
    .filter((it) => it.isHoliday === "Y")
    .map((it) => {
      const s = String(it.locdate);
      const date = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
      return { date, name: it.dateName };
    });
}

/**
 * 특정 연도의 source='public' 행을 공공API 결과로 재구성.
 * source='manual' 행은 동일 날짜라도 보존(ON CONFLICT DO NOTHING).
 */
export async function syncPublicHolidays(
  supabase: SupabaseClient,
  year: number,
): Promise<{ fetched: number; deleted: number; inserted: number }> {
  const items = await fetchPublicHolidays(year);

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const { error: delErr, count: deletedCount } = await supabase
    .from("holidays")
    .delete({ count: "exact" })
    .eq("source", "public")
    .gte("date", yearStart)
    .lte("date", yearEnd);
  if (delErr) throw new Error(`기존 공공 휴일 삭제 실패: ${delErr.message}`);

  if (items.length === 0) {
    return { fetched: 0, deleted: deletedCount ?? 0, inserted: 0 };
  }

  const rows = items.map((it) => ({
    date: it.date,
    name: it.name,
    source: "public" as const,
  }));

  const { error: insErr, count: insertedCount } = await supabase
    .from("holidays")
    .upsert(rows, {
      onConflict: "date",
      ignoreDuplicates: true,
      count: "exact",
    });
  if (insErr) throw new Error(`공공 휴일 등록 실패: ${insErr.message}`);

  return {
    fetched: items.length,
    deleted: deletedCount ?? 0,
    inserted: insertedCount ?? 0,
  };
}
