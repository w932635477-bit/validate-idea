import type { Fetcher, RawItem } from "@/scorer/types";
import { encodeQ, fetchHtml } from "@/lib/http";
import { fail, ok } from "./_helpers";

// 百度搜索 HTML 抓取:竞品发现 + 搜索结果数(代百度指数趋势)。competitor 维度。
// 自用低频,反爬风险低。失败降级。
export const baiduSearch: Fetcher = async (keywords) => {
  try {
    const $ = await fetchHtml(`https://www.baidu.com/s?wd=${encodeQ(keywords)}&rn=10`);
    const items: RawItem[] = [];
    $(".result.c-container, .c-container").each((_, el) => {
      const $el = $(el);
      const title = $el.find("h3 a").text().trim();
      const href = $el.find("h3 a").attr("href") ?? "";
      const snippet = $el.find(".c-abstract, [class*='abstract']").text().trim();
      if (title && href) items.push({ title, url: href, snippet: snippet.slice(0, 200) || undefined });
    });
    const nums = $(".nums_text, .search_tool_con .nums").text();
    const summary = nums || `百度前 ${items.length} 条结果`;
    return ok("baidu-search", "zh", "competitor", items.slice(0, 10), summary);
  } catch (e) {
    return fail("baidu-search", "zh", "competitor", (e as Error).message);
  }
};
