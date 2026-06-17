// bundle 精简版:只保留 validate.ts 用到的 runFetchers 路径。
// 砍掉 scoreAndAssemble / generatePartC / llm / grounding —— 评分交给跑 skill 的 Claude,零 LLM 依赖。
// 与项目 src/lib/pipeline.ts 同源;如需 LLM 评分能力请回源文件,别在这里加回。
import { FETCHERS } from "@/fetchers";
import { fail } from "@/fetchers/_helpers";
import type { FetchResult, Locale } from "@/scorer/types";

/** 并行跑某市场的所有 fetcher。单 fetcher 失败不阻塞(每个内部已 catch,返回 ok:false)。 */
export async function runFetchers(keywords: string[], locale: Locale): Promise<FetchResult[]> {
  const fetchers = FETCHERS[locale];
  const settled = await Promise.allSettled(fetchers.map((f) => f(keywords, locale)));
  const fetched = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    return fail(fetchers[i].name || `fetcher${i}`, locale, "search", (s.reason as Error)?.message ?? "rejected");
  });
  // competitor 桶位兜底:brave 无 key 时 competitor 维度失明。从已抓的 hn community 结果里
  // 把 "Show HN/Tell HN" 发布帖再分一桶到 competitor(零额外 HTTP,纯再分类)。
  return [...fetched, ...deriveHnCompetitor(fetched)];
}

const SHOW_HN_RE = /^(show hn|tell hn)\b/i;

function deriveHnCompetitor(results: FetchResult[]): FetchResult[] {
  const hn = results.find((r) => r.source === "hn" && r.dimension === "community" && r.ok);
  const launches = (hn?.data?.items ?? []).filter((it) => SHOW_HN_RE.test(it.title));
  if (launches.length === 0) return [];
  return [
    {
      ok: true,
      source: "hn-showhn",
      locale: "en",
      dimension: "competitor",
      data: {
        items: launches,
        summary: `HN Show HN 发布帖 ${launches.length} 条(从 community 再分桶,兜底 brave 无 key 导致的 competitor 失明)`,
      },
    },
  ];
}
