import type { Fetcher, RawItem } from "@/scorer/types";
import { encodeQ, fetchJson } from "@/lib/http";
import { fail, mergeItems, ok } from "./_helpers";

interface BraveResp {
  web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> };
}

// Brave Search API:合规搜索+竞品。competitor 维度。需 BRAVE_SEARCH_API_KEY,无则降级用 DDG。
export const brave: Fetcher = async (keywords) => {
  const token = process.env.BRAVE_SEARCH_API_KEY;
  if (!token) return fail("brave", "en", "competitor", "未配 BRAVE_SEARCH_API_KEY(降级:search 维度用 DDG)");
  try {
    const data = await fetchJson<BraveResp>(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeQ(keywords)}&count=10`,
      { headers: { accept: "application/json", "x-subscription-token": token } },
    );
    const items: RawItem[] = (data.web?.results ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: r.description?.slice(0, 200),
    }));
    return ok("brave", "en", "competitor", mergeItems([items]), `Brave ${items.length} 条`);
  } catch (e) {
    return fail("brave", "en", "competitor", (e as Error).message);
  }
};
