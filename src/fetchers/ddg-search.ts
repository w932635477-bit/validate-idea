import type { Fetcher, RawItem } from "@/scorer/types";
import { encodeQ, fetchHtml } from "@/lib/http";
import { fail, ok } from "./_helpers";

type Engine = "ddg" | "bing";

// DDG / Bing HTML 抓取共享层。
// - competitor 维度(DDG 优先):兜 brave 无 key(用户无国际卡)。
// - search 维度(Bing 优先):兜 firecrawl 402/无 key。两市场通用(Bing 中文也好用)。
// competitor=DDG、search=Bing 错开引擎 → 同关键词两维度结果不重复。
async function fetchWeb(keywords: string[], prefer: Engine): Promise<{ engine: Engine; items: RawItem[] }> {
  const order: Engine[] = prefer === "bing" ? ["bing", "ddg"] : ["ddg", "bing"];
  for (const engine of order) {
    const items = engine === "ddg" ? await tryDdg(keywords) : await tryBing(keywords);
    if (items.length > 0) return { engine, items };
  }
  return { engine: prefer, items: [] };
}

// competitor 维度(en):brave 无 key 的兜底。DDG 优先。
export const ddgSearch: Fetcher = async (keywords) => {
  const { engine, items } = await fetchWeb(keywords, "ddg");
  if (items.length === 0) return fail("ddg-search", "en", "competitor", "DDG+Bing HTML 抓取均失败(可能反爬/出墙)");
  const src = engine === "bing" ? "bing-search" : "ddg-search";
  return ok(src, "en", "competitor", items.slice(0, 10), `${engine.toUpperCase()} ${items.length} 条(兜底 brave 无 key)`);
};

// search 维度(两市场):firecrawl 402/无 key 的兜底。Bing 优先(中文好 + 与 competitor 的 DDG 错开)。
export const ddgWebSearch: Fetcher = async (keywords, locale) => {
  const { engine, items } = await fetchWeb(keywords, "bing");
  if (items.length === 0) return fail("ddg-web-search", locale, "search", "DDG+Bing HTML 抓取均失败");
  const src = engine === "bing" ? "bing-web-search" : "ddg-web-search";
  return ok(src, locale, "search", items.slice(0, 10), `${engine.toUpperCase()} ${items.length} 条(兜底 firecrawl)`);
};

async function tryDdg(keywords: string[]): Promise<RawItem[]> {
  try {
    const $ = await fetchHtml(`https://html.duckduckgo.com/html/?q=${encodeQ(keywords)}`);
    const items: RawItem[] = [];
    $(".result, .web-result").each((_, el) => {
      const $el = $(el);
      const $a = $el.find(".result__a").first();
      const title = $a.text().trim();
      const url = decodeDdgHref($a.attr("href") ?? "");
      const snippet = $el.find(".result__snippet").text().trim();
      if (title && url) items.push({ title, url, snippet: snippet.slice(0, 200) || undefined });
    });
    return items;
  } catch {
    return [];
  }
}

// DDG html 端点 href 形如 //duckduckgo.com/l/?uddg=<encoded 真实 url>&rut=...;取 uddg 还原。
function decodeDdgHref(href: string): string {
  const m = href.match(/[?&]uddg=([^&]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      /* fall through */
    }
  }
  return href.startsWith("//") ? `https:${href}` : href;
}

async function tryBing(keywords: string[]): Promise<RawItem[]> {
  try {
    const $ = await fetchHtml(`https://www.bing.com/search?q=${encodeQ(keywords)}&count=10`);
    const items: RawItem[] = [];
    $("li.b_algo").each((_, el) => {
      const $el = $(el);
      const $a = $el.find("h2 a").first();
      const title = $a.text().trim();
      const url = $a.attr("href") ?? "";
      const snippet = $el.find(".b_caption p, p").first().text().trim();
      if (title && url) items.push({ title, url, snippet: snippet.slice(0, 200) || undefined });
    });
    return items;
  } catch {
    return [];
  }
}
