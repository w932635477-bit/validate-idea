import type { Dimension, FetchResult, Locale, RawItem } from "@/scorer/types";

export function ok(
  source: string,
  locale: Locale,
  dimension: Dimension,
  items: RawItem[],
  summary?: string,
): FetchResult {
  return { ok: true, source, locale, dimension, data: { items, summary } };
}

export function fail(
  source: string,
  locale: Locale,
  dimension: Dimension,
  reason: string,
): FetchResult {
  return { ok: false, source, locale, dimension, reason };
}

/** 多关键词合并搜:取每个关键词前 N 条,去重(按 url),最多 limit 条。 */
export function mergeItems(batches: RawItem[][], limit = 15): RawItem[] {
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const batch of batches) {
    for (const it of batch) {
      if (it.url && !seen.has(it.url)) {
        seen.add(it.url);
        out.push(it);
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}
