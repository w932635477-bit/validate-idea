import type { Fetcher, RawItem } from "@/scorer/types";
import { encodeQ, fetchJson } from "@/lib/http";
import { fail, mergeItems, ok } from "./_helpers";

interface HnResp {
  hits?: Array<{
    title?: string;
    url?: string;
    points?: number;
    num_comments?: number;
    objectID: string;
  }>;
  nbHits?: number;
}

// HN Algolia API,免费无限制。community 维度。
export const hn: Fetcher = async (keywords) => {
  try {
    const batches: RawItem[][] = [];
    let totalHits = 0;
    for (const kw of keywords.slice(0, 2)) {
      const data = await fetchJson<HnResp>(
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(kw)}&tags=story&hitsPerPage=15`,
      );
      totalHits += data.nbHits ?? 0;
      batches.push(
        (data.hits ?? []).map((h) => ({
          title: h.title ?? "(无标题)",
          url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
          metric: h.points,
          snippet: h.num_comments !== undefined ? `${h.num_comments} 评论` : undefined,
        })),
      );
    }
    const merged = mergeItems(batches);
    return ok("hn", "en", "community", merged, `HN ${merged.length} 帖(总命中 ${totalHits})`);
  } catch (e) {
    return fail("hn", "en", "community", (e as Error).message);
  }
};
