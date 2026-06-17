import 'dotenv/config'; // 自加载 .env(知乎 cookie / proxy 等)。任何调用方式都稳,不用手动 source。
import { runFetchers } from "@/lib/pipeline";
import { dataCompleteness } from "@/scorer/score";
import type { FetchResult, Locale } from "@/scorer/types";

// 数据层 CLI:跑中英双市场 fetcher,输出裁剪数据 JSON 给 skill 的 Claude 评分。
// 不调任何 LLM(零 key 依赖)——评分/分析交给跑 skill 的 Claude。
// 用法(在 skill 目录,.env 由脚本自加载):
//   npx tsx validate.ts '{"detectedLocale":"zh","zh":["AI周报"],"en":["AI weekly report"]}'

interface KeywordsInput {
  detectedLocale: Locale;
  zh: string[];
  en: string[];
}

// ponytail: 裁剪每源 top 8 条,够评分又不爆 Claude token。
const MAX_ITEMS = 8;

interface TrimmedItem {
  title: string;
  url: string;
  snippet?: string;
  metric?: number;
}

interface TrimmedResult {
  source: string;
  dimension: string;
  ok: boolean;
  reason?: string;
  summary?: string;
  items: TrimmedItem[];
}

interface MarketData {
  results: TrimmedResult[];
  dataCompleteness: { dimension: string; ok: boolean }[];
}

function trim(r: FetchResult): TrimmedResult {
  return {
    source: r.source,
    dimension: r.dimension,
    ok: r.ok,
    reason: r.ok ? undefined : r.reason,
    summary: r.data?.summary,
    items: (r.data?.items ?? [])
      .slice(0, MAX_ITEMS)
      .map((it) => ({ title: it.title, url: it.url, snippet: it.snippet, metric: it.metric })),
  };
}

async function fetchMarket(keywords: string[], locale: Locale): Promise<MarketData> {
  const results = await runFetchers(keywords, locale);
  return {
    results: results.map(trim),
    dataCompleteness: dataCompleteness(results),
  };
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      '用法: npx tsx validate.ts \'{"detectedLocale":"zh","zh":[...],"en":[...]}\'',
    );
    process.exit(2);
  }
  let kw: KeywordsInput;
  try {
    kw = JSON.parse(arg) as KeywordsInput;
  } catch {
    console.error("keywords 参数不是合法 JSON");
    process.exit(2);
  }
  const [zh, en] = await Promise.all([fetchMarket(kw.zh, "zh"), fetchMarket(kw.en, "en")]);
  // 只往 stdout 写 JSON(stderr 留给错误日志),Claude 直接读 stdout 解析。
  process.stdout.write(JSON.stringify({ detectedLocale: kw.detectedLocale, zh, en }, null, 2));
}

main().catch((e) => {
  console.error("✗ 数据抓取失败:", e instanceof Error ? e.message : e);
  process.exit(1);
});
