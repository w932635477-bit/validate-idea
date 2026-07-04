import type { Fetcher, Locale } from "@/scorer/types";
import { baiduSearch } from "./baidu-search";
import { zhihu } from "./zhihu";
import { firecrawl } from "./firecrawl";
import { brave } from "./brave";
import { ddgSearch, ddgWebSearch } from "./ddg-search";
import { hn } from "./hn";
import { lobsters } from "./lobsters";
import { pullpush } from "./pullpush";

/**
 * 按市场分组的 fetcher 注册表。所有 fetcher 可插拔,新增数据源只需写一个文件并加进来。
 *
 * search 维度(两个市场):firecrawl 主(真短语检索 + 内容抽取),ddg-web-search 兜底
 *   (Bing 优先 + DDG,firecrawl 402/无 key 时启用)。替代了 google-trends(已坏,返 HTML)。
 *   旧 bing/duckduckgo 的"词典噪声"问题在 firecrawl 死时由兜底承担(有噪声数据 > 零数据臆测)。
 * community:zh=知乎(cookie),en=hn/lobsters/pullpush。
 * competitor:zh=baidu-search;en=brave(需 key,无则 ok:false)+ ddg-search(DDG/Bing HTML 兜底
 *   brave 无 key)+ pipeline 的 deriveHnCompetitor(把 hn 的 "Show HN/Tell HN" 发布帖再分桶到 competitor)。
 *
 * 已移除:v2ex(topics/search 端点 404)、productHunt(PH v2 砍了关键词搜索)、
 *   bing/duckduckgo/google-trends(被 firecrawl 替代,2026-06-16)、juejin(反爬 err_no=2,路由不存在)。
 * reddit 经 pullpush 间接覆盖(pullpush 聚合 pushshift dump,免账号/CAPTCHA)。
 */
export const FETCHERS: Record<Locale, Fetcher[]> = {
  zh: [baiduSearch, zhihu, firecrawl, ddgWebSearch],
  en: [firecrawl, hn, lobsters, pullpush, brave, ddgSearch, ddgWebSearch],
};
