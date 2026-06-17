import type { Fetcher, RawItem } from "@/scorer/types";
import { fetchJson } from "@/lib/http";
import { fail, mergeItems, ok } from "./_helpers";

interface PullpushSubmission {
  title?: string;
  permalink?: string; // "/r/SUB/comments/id/slug/"
  subreddit?: string;
  num_comments?: number;
  score?: number | null; // 抓取时的快照,可能为 null/缺失
}
interface PullpushResp {
  data?: PullpushSubmission[];
}

// pullpush.io(pushshift 的免费继任者)搜 reddit 历史 submission。community 维度。
// 用它绕开 reddit 官方:无账号、无 OAuth、无 CAPTCHA,公开 JSON 直出。
// 数据是 pushshift dump 的历史快照(非实时、覆盖不全)。pullpush 响应慢且波动大
// (size=3 都要 ~10s,size 越大越慢,偶发 >20s),故:size 控 10、单请求超时 25s、
// 两关键词并行(Promise.allSettled)且一词失败/超时不丢另一词的数据。
// 对需求验证(「有没有人讨论/吐槽/求过这个」)足够:历史讨论本身就是 community 信号。
export const pullpush: Fetcher = async (keywords) => {
  const results = await Promise.allSettled(
    keywords.slice(0, 2).map(
      async (kw): Promise<RawItem[]> => {
        const data = await fetchJson<PullpushResp>(
          `https://api.pullpush.io/reddit/search/submission/?q=${encodeURIComponent(kw)}&size=10`,
          undefined,
          25000,
        );
        return (data.data ?? []).map((s) => {
          const sub = s.subreddit ?? /^\/r\/([^/]+)/.exec(s.permalink ?? "")?.[1];
          const parts = [sub ? `r/${sub}` : null, s.num_comments ? `${s.num_comments} 评论` : null].filter(Boolean);
          return {
            title: s.title ?? "(无标题)",
            url: s.permalink ? `https://www.reddit.com${s.permalink}` : "",
            metric: typeof s.score === "number" ? s.score : undefined,
            snippet: parts.join(" · ") || undefined,
          };
        });
      },
    ),
  );
  const batches = results
    .filter((r): r is PromiseFulfilledResult<RawItem[]> => r.status === "fulfilled")
    .map((r) => r.value);
  if (batches.length === 0) {
    const r0 = results[0];
    const msg = r0?.status === "rejected" ? ((r0.reason as Error)?.message ?? String(r0.reason)) : "未知";
    return fail("pullpush", "en", "community", `pullpush 两词都失败:${msg}`);
  }
  const merged = mergeItems(batches);
  return ok("pullpush", "en", "community", merged, `Reddit(via pullpush) ${merged.length} 帖`);
};
