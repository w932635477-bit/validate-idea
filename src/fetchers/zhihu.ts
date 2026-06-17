import type { Fetcher, RawItem } from "@/scorer/types";
import { fetchJson } from "@/lib/http";
import { fail, mergeItems, ok } from "./_helpers";

interface ZhihuObject {
  title?: string;
  url?: string;
  excerpt?: string;
  voteup_count?: number;
}
interface ZhihuSearchItem {
  type?: string; // search_result / knowledge_ad / relevant_query / zvideo ...
  object?: ZhihuObject;
}
interface ZhihuSearchResp {
  data?: ZhihuSearchItem[];
}

const stripEm = (s: string): string => s.replace(/<\/?em>/g, "");

// API 给的是 api.zhihu.com/articles/<id>,转成人类可读的专栏链接。
function toHumanUrl(u: string): string {
  const m = u?.match(/api\.zhihu\.com\/articles\/(\d+)/);
  if (m) return `https://zhuanlan.zhihu.com/p/${m[1]}`;
  return (u ?? "").replace("api.zhihu.com", "www.zhihu.com");
}

// 知乎搜索:走 search_v3 JSON API。community 维度(国内独立开发/产品讨论最高信号)。
// 关键:HTML 搜索页是 React SPA,卡片客户端渲染,cheerio 抓不到——必须走 API。
// API 匿名调被拦(403),需 ZHIHU_COOKIE 注入登录态。F12→Network→任一请求→cookie 整行。
// cookie 几周到几个月过期,自用凑合。
export const zhihu: Fetcher = async (keywords) => {
  const cookie = process.env.ZHIHU_COOKIE;
  if (!cookie) {
    return fail("zhihu", "zh", "community", "匿名被拦,设 ZHIHU_COOKIE 注入登录态(知乎搜索 API 需登录态)");
  }
  try {
    const batches: RawItem[][] = [];
    for (const kw of keywords.slice(0, 2)) {
      const data = await fetchJson<ZhihuSearchResp>(
        `https://www.zhihu.com/api/v4/search_v3?t=general&q=${encodeURIComponent(kw)}&correction=1&offset=0&limit=10`,
        { headers: { referer: "https://www.zhihu.com/search", accept: "application/json, text/plain, */*", cookie } },
        10000,
      );
      const items: RawItem[] = (data.data ?? [])
        .filter((d) => d.type === "search_result" && d.object?.title)
        .map((d) => {
          const o = d.object!;
          return {
            title: stripEm(o.title!),
            url: toHumanUrl(o.url ?? ""),
            snippet: o.excerpt ? stripEm(o.excerpt).slice(0, 200) : undefined,
            metric: o.voteup_count,
          };
        });
      batches.push(items);
    }
    const merged = mergeItems(batches);
    if (!merged.length) {
      return fail("zhihu", "zh", "community", "cookie 已设但 0 条——cookie 可能已过期,请刷新 ZHIHU_COOKIE");
    }
    return ok("zhihu", "zh", "community", merged, `知乎 ${merged.length} 条`);
  } catch (e) {
    return fail("zhihu", "zh", "community", `知乎反爬:${(e as Error).message}`);
  }
};
