import type { Fetcher, RawItem } from "@/scorer/types";
import { fetchJson } from "@/lib/http";
import { fail, mergeItems, ok } from "./_helpers";

interface FirecrawlSearchResp {
  success?: boolean;
  data?: Array<{ title?: string; url?: string; description?: string }>;
}

// Firecrawl search API:真短语检索 + 内容抽取。search 维度。
// 替代 bing/ddg(它们把 "dependency security" 拆词命中词典站)。中文也能用,治 zh/search 黑维度。
// 需 FIRECRAWL_API_KEY(.env)。中国本地若需出墙,走 http.ts 的 HTTPS_PROXY。
// locale 参数化,zh/en 都能跑;当前只注册在 zh(PoC,先不动 en 的 bing/ddg)。
export const firecrawl: Fetcher = async (keywords, locale) => {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return fail("firecrawl", locale, "search", "未配 FIRECRAWL_API_KEY");
  try {
    const resp = await fetchJson<FirecrawlSearchResp>("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ query: keywords.join(" "), limit: 10 }),
    });
    if (!resp.success) return fail("firecrawl", locale, "search", "Firecrawl 返回 success=false");
    const items: RawItem[] = (resp.data ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: r.description?.slice(0, 200),
    }));
    if (items.length === 0) return fail("firecrawl", locale, "search", "Firecrawl 0 条结果");
    return ok("firecrawl", locale, "search", mergeItems([items]), `Firecrawl ${items.length} 条`);
  } catch (e) {
    return fail("firecrawl", locale, "search", (e as Error).message);
  }
};
