# validate-idea — 跨市场需求验证(Claude Code skill)

输入一句话产品 idea,采集中英**双市场**真实数据(搜索/社区/竞品),严格评分,输出双语验证报告:本地市场 vs 对方市场、谁先做、造不造。

**杀手点:跨市场对比。** 多数 idea 验证工具只看一个市场。这个同时扒中文 + 英文,告诉你"你的痛在对方市场是不是早被解决了"——需求真实 ≠ 机会真实。

## 怎么工作

评分由**跑这个 skill 的 Claude** 做(读数据、判断、写报告)。本仓库只提供**数据抓取层**:9 个 fetcher 覆盖中英两市场的 search / community / competitor 三维。**零 LLM key 依赖**——你已有的 Claude 就是评分引擎。

## 安装为 Claude Code skill

```bash
git clone https://github.com/w932635477-bit/validate-idea.git ~/.claude/skills/validate-idea
cd ~/.claude/skills/validate-idea
cp .env.example .env   # 按需填(全可选,见下)
npm install            # 一次性
```

装好后在 Claude Code 里直接描述你的 idea(中/英都行),会自动触发这个 skill。

`.env` 全是可选 key,缺了对应源就优雅降级(该源 `ok:false`,不崩):
- `FIRECRAWL_API_KEY` — search 维度,两市场都靠它,建议填(数据质量最好)
- `ZHIHU_COOKIE` — 中文社区(知乎)
- `HTTPS_PROXY` — 在中国抓英文源(hn/lobsters/brave/firecrawl)经本地代理出
- `BRAVE_SEARCH_API_KEY` — 英文竞品(无 key 时 HN Show HN 发布帖兜底)

## 用法

在 Claude Code 里描述你的 idea(中/英都行)触发 skill。或手动跑数据层看原始 JSON:

```bash
npx tsx validate.ts '{"detectedLocale":"zh","zh":["AI周报"],"en":["AI weekly report"]}'
```

## 数据源

| 维度 | 中文市场 | 英文市场 |
|---|---|---|
| search | firecrawl | firecrawl |
| community | 知乎(cookie) | HN / Lobsters / pullpush(reddit 聚合) |
| competitor | baidu-search | brave(key)+ HN Show HN 兜底 |

每个 fetcher 失败独立 catch,返回 `ok:false`,不阻塞其他源。

## demo 报告(方法学证据)

三篇真实跑出来的验证报告(见 [`docs/demos/`](docs/demos/)):
- **出海收款** — 别造(全球 45 / 中国 61,两边红海)
- **AI 周报** — 造,但只造中国
- **AI PR review** — 别造(巨头 + 开源 + 平台原生三重碾压)

## 诚实声明

- EN 源在中国需代理,否则英文维度数据贫瘠(如实标 `ok:false`,不编)。
- 数据缺失的维度,评分规则强制低分(10),防止"没数据就臆测中等分"。
- 报告是决策辅助,不是决策本身。

## 技术栈

cheerio + undici + zod + tsx。无前端、无部署、无 LLM 调用。
