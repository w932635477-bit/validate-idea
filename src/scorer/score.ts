import {
  WEIGHTS,
  verdictFromTotal,
  type Dimension,
  type FetchResult,
  type Locale,
  type MarketReport,
  type ScoringResult,
} from "./types";

/** 加权总分 = search*0.4 + community*0.3 + competitor*0.3。代码算,不依赖 LLM 算对。 */
export function computeTotal(scoring: ScoringResult): number {
  const d = scoring.dimensionScores;
  return Math.round(
    d.search.score * WEIGHTS.search +
      d.community.score * WEIGHTS.community +
      d.competitor.score * WEIGHTS.competitor,
  );
}

/** 各维度是否至少有一个数据源成功(中文 search 维度靠 baidu-search 结果数降级,可能标 false)。 */
export function dataCompleteness(results: FetchResult[]): { dimension: Dimension; ok: boolean }[] {
  return (["search", "community", "competitor"] as Dimension[]).map((dim) => ({
    dimension: dim,
    ok: results.some((r) => r.dimension === dim && r.ok),
  }));
}

/** 组装单市场报告。scoring 应已过 groundingCheck。 */
export function assembleMarketReport(params: {
  locale: Locale;
  label: string;
  keywords: string[];
  fetchResults: FetchResult[];
  scoring: ScoringResult;
}): MarketReport {
  const total = computeTotal(params.scoring);
  return {
    ...params,
    total,
    verdict: verdictFromTotal(total),
    dataCompleteness: dataCompleteness(params.fetchResults),
  };
}

/**
 * 数据源全失败的维度,LLM 可能臆测出中等分数(如把失败的 baidu 编成"百度有多条结果")。
 * 强制该维度为地板分 + "数据不可用" reason,与 dataCompleteness 同口径。
 * 跟 groundingCheck 同哲学:数据没有就不能编。
 */
export function enforceNoData(scoring: ScoringResult, fetchResults: FetchResult[]): ScoringResult {
  const dimensionScores = { ...scoring.dimensionScores };
  for (const { dimension, ok } of dataCompleteness(fetchResults)) {
    if (!ok) {
      dimensionScores[dimension] = {
        score: 10,
        reason: "本次该维度所有数据源抓取失败,无法评估真实需求,暂按最低分处理(不代表真实低需求)。",
      };
    }
  }
  return { ...scoring, dimensionScores };
}

