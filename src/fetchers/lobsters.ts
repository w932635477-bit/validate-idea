import type { Fetcher, RawItem } from "@/scorer/types";
import { fetchHtml } from "@/lib/http";
import { fail, mergeItems, ok } from "./_helpers";

// Lobsters 搜索 HTML。技术社区,community 维度。结果量通常小。
export const lobsters: Fetcher = async (keywords) => {
  try {
    const batches: RawItem[][] = [];
    for (const kw of keywords.slice(0, 2)) {
      // lobste.rs 的 /search 对"伪装成浏览器的 UA"返回 403(反爬),但接受自报家门的 bot UA。
      // http.ts 默认塞 Chrome UA,这里覆盖成描述性 bot UA 才能过(homepage/RSS 不挑,仅 /search 挑)。
      const $ = await fetchHtml(
        `https://lobste.rs/search?q=${encodeURIComponent(kw)}&what=stories&order=newest`,
        { headers: { "user-agent": "Looking-SaaS/0.1 (+https://github.com/w932635477-bit/Looking-SaaS; demand-validation self-use)" } },
      );
      const items: RawItem[] = [];
      $(".story").each((_, el) => {
        const $el = $(el);
        const $a = $el.find(".u-url").first();
        const title = $a.text().trim();
        const href = $a.attr("href") ?? "";
        const score = $el.find(".score").text().trim();
        if (title) {
          const url = href.startsWith("http") ? href : `https://lobste.rs${href}`;
          items.push({ title, url, snippet: score ? `热度 ${score}` : undefined });
        }
      });
      batches.push(items);
    }
    const merged = mergeItems(batches);
    return ok("lobsters", "en", "community", merged, `Lobsters ${merged.length} 条`);
  } catch (e) {
    return fail("lobsters", "en", "community", (e as Error).message);
  }
};
