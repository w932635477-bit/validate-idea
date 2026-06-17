import { z } from "zod";

// ─── Fetcher 层 ───────────────────────────────────────────────

export type Locale = "zh" | "en";
export type Dimension = "search" | "community" | "competitor";

/** 单条原始数据(帖子/搜索结果/竞品),统一形状给下游。 */
export interface RawItem {
  title: string;
  url: string;
  snippet?: string;
  metric?: number; // 点数 / 回复数 / 搜索量相对值,有就给
}

/** 所有 fetcher 的统一返回。失败不 throw,返回 ok:false。 */
export interface FetchResult {
  ok: boolean;
  source: string; // "hn" / "v2ex" / ...
  locale: Locale;
  dimension: Dimension;
  data?: { items: RawItem[]; summary?: string };
  reason?: string; // ok=false 时的失败原因
}

/** 跨市场 fetcher 签名:关键词 + 市场 → 结果。 */
export type Fetcher = (keywords: string[], locale: Locale) => Promise<FetchResult>;

// ─── 关键词提取(LLM)─────────────────────────────────────────

export const KeywordsSchema = z.object({
  detectedLocale: z.enum(["zh", "en"]),
  zh: z.array(z.string()).min(1).max(4),
  en: z.array(z.string()).min(1).max(4),
});
export type Keywords = z.infer<typeof KeywordsSchema>;

// ─── 评分结果(LLM structured output)──────────────────────────

const DimensionScoreSchema = z.object({
  score: z.number().min(0).max(100),
  reason: z.string(),
});

export const ScoringResultSchema = z.object({
  dimensionScores: z.object({
    search: DimensionScoreSchema,
    community: DimensionScoreSchema,
    competitor: DimensionScoreSchema,
  }),
  headline: z.string(), // 一句话判断
  keyRisks: z.array(z.string()), // 主要风险点
  whoPays: z.string(), // 最可能付费的角色+场景
  conflicts: z.array(
    z.object({ description: z.string(), dataPoints: z.array(z.string()) }),
  ),
  sources: z.array(z.object({ claim: z.string(), url: z.string() })),
});
export type ScoringResult = z.infer<typeof ScoringResultSchema>;

// ─── Part C 跨市场对比(LLM structured output)─────────────────

const PriceRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  currency: z.string(),
  unit: z.string(),
});

export const PartCSchema = z.object({
  scoreDiff: z.object({
    local: z.number(),
    foreign: z.number(),
    delta: z.number(),
    direction: z.enum(["local_higher", "foreign_higher", "even"]),
  }),
  coreDifferences: z.array(z.string()),
  recommendedStrategy: z.object({
    primaryMarket: z.enum(["local", "foreign", "both", "neither"]),
    reasoning: z.string(),
    specificAction: z.string(),
  }),
  entryBarriers: z.array(
    z.object({
      barrier: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      note: z.string(),
    }),
  ),
  recommendedChannels: z.array(
    z.object({ channel: z.string(), priority: z.enum(["low", "medium", "high"]) }),
  ),
  pricingSuggestion: z.object({
    foreign: PriceRangeSchema,
    local: PriceRangeSchema,
    reasoning: z.string(),
  }),
});
export type PartC = z.infer<typeof PartCSchema>;

// ─── 完整报告 ────────────────────────────────────────────────

export interface MarketReport {
  locale: Locale;
  label: string; // "本地市场(中文)" / "对方市场(英文)"
  keywords: string[];
  fetchResults: FetchResult[];
  scoring: ScoringResult;
  total: number;
  verdict: Verdict;
  dataCompleteness: { dimension: Dimension; ok: boolean }[];
}

export interface CrossMarketReport {
  id: string;
  createdAt: string; // ISO
  idea: string;
  detectedLocale: Locale;
  keywords: Keywords;
  partA: MarketReport; // 本地
  partB: MarketReport; // 对方
  partC: PartC;
}

// ─── 评分常量(代码算 total/verdict,不依赖 LLM)──────────────

export const WEIGHTS: Record<Dimension, number> = {
  search: 0.4,
  community: 0.3,
  competitor: 0.3,
};

export type Verdict = "build" | "maybe" | "skip";

export function verdictFromTotal(total: number): Verdict {
  if (total >= 70) return "build";
  if (total >= 40) return "maybe";
  return "skip";
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  build: "造",
  maybe: "可以造,注意风险",
  skip: "不建议造",
};

export const DIMENSION_LABEL: Record<Dimension, string> = {
  search: "搜索+趋势",
  community: "社区",
  competitor: "竞品+付费",
};
