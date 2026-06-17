import type { Fetcher, Locale } from "@/scorer/types";
import { baiduSearch } from "./baidu-search";
import { zhihu } from "./zhihu";
import { firecrawl } from "./firecrawl";
import { brave } from "./brave";
import { hn } from "./hn";
import { lobsters } from "./lobsters";
import { pullpush } from "./pullpush";

/**
 * 按市场分组的 fetcher 注册表。所有 fetcher 可插拔,新增数据源只需写一个文件并加进来。
 *
 * search 维度(两个市场)统一用 firecrawl —— 真短语检索 + 内容抽取,不把 "dependency security"
 * 拆词命中词典站(旧 bing/ddg 的毛病)。替代了 bing/duckduckgo(词典噪声)和 google-trends(已坏,返 HTML)。
 * community:zh=知乎(cookie),en=hn/lobsters/pullpush。
 * competitor:zh=baidu-search;en=brave(需 key,无则 ok:false)+ pipeline 的 deriveHnCompetitor
 *   (把 hn 的 "Show HN/Tell HN" 发布帖再分桶到 competitor,兜底 brave 无 key)。
 *
 * 已移除:v2ex(topics/search 端点 404)、productHunt(PH v2 砍了关键词搜索)、
 *   bing/duckduckgo/google-trends(被 firecrawl 替代,2026-06-16)、juejin(反爬 err_no=2,路由不存在)。
 * reddit 经 pullpush 间接覆盖(pullpush 聚合 pushshift dump,免账号/CAPTCHA)。
 */
export const FETCHERS: Record<Locale, Fetcher[]> = {
  zh: [baiduSearch, zhihu, firecrawl],
  en: [firecrawl, hn, lobsters, pullpush, brave],
};
