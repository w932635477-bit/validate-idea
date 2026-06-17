---
name: validate-idea
description: 跨市场需求验证。输入一句话产品 idea,采集中英双市场的搜索/社区/竞品真实数据,严格评分,输出双语验证报告(本地 vs 对方市场、谁先做、造不造建议)。触发场景——需求验证 / idea 验证 / 双市场对比 / 这个 idea 值不值得做 / 造不造判断 / 市场调研 / 帮我看看这个点子。
---

# 跨市场需求验证(中英双市场)

你是跨市场需求验证分析师。给定一句话产品 idea,先用本 skill 自带的数据抓取脚本采集**中文 + 英文**两个市场的真实信号(搜索量、社区讨论、竞品),再基于数据**严格**评分,输出双语验证报告。

idea 主语言所在市场 = **本地市场**(Part A),另一个 = **对方市场**(Part B)。

## 工作流(严格按顺序)

### 第 1 步:提双语关键词
从 idea 提取调研用搜索关键词(JSON,准备传给脚本):
- `detectedLocale`:判断 idea 主要语言(`zh`/`en`)
- `zh`:2-4 个中文关键词,覆盖不同说法
- `en`:2-4 个英文关键词,地道表达,覆盖同义词

短意图词 + 竞品名比长描述更有效(如 idea "帮独立开发者自动写周报" → zh `["周报生成","自动周报","AI写周报"]`)。

**避坑**:别用单个常见英文词(`dependency`、`security`),否则命中词典站(Merriam-Webster/Cambridge);用 2-3 词短语或加竞品名(`dependency security tool`、`npm audit`)。中文同理,用 `供应链安全` 而非裸 `依赖安全`(后者撞心理学"安全依恋",返回一堆无关热帖)。

### 第 2 步:抓数据
调脚本采集双市场数据。脚本在 skill 目录里(项目级 `.claude/skills/validate-idea`,或用户级 `~/.claude/skills/validate-idea`)。先一次性装依赖 + 配 env:

```bash
cd <skill 目录>
cp .env.example .env   # 按需填,全可选(见下)
npm install            # 一次性
```

**每次抓数据**(在 skill 目录里跑,这样脚本能自加载 `.env`):

```bash
npx tsx validate.ts '<第1步的 keywords JSON>'
```

脚本输出 JSON:`zh` 和 `en` 各含 `results`(各数据源的条目)和 `dataCompleteness`(`[{dimension, ok}]`)。**这是评分的唯一证据来源。**

`.env` 全是可选 key,缺了对应源就 `ok:false`(优雅降级,不崩):`FIRECRAWL_API_KEY`(search 维度,建议填)/ `ZHIHU_COOKIE`(中文社区)/ `HTTPS_PROXY`(在中国抓英文源经代理出)/ `BRAVE_SEARCH_API_KEY`(英文竞品)。**不需要任何 LLM key**——评分由你(跑 skill 的 Claude)读脚本输出做。`ok:false` 的源是正常数据状态(被墙/反爬/key 缺),不是报错。

### 第 3 步:双市场三维评分
对 zh 和 en **各自独立**评分。

**先过相关性闸门(打分前必做)**:抓回的条目常有噪声——英文搜 `dependency security` 会命中一堆词典释义,中文 `依赖安全` 会撞心理学"安全依恋"。逐条判断是否与 idea 真正相关:
- 剔除:词典站(merriam-webster/cambridge/dictionary.com)、同形异义词、明显跑题的条目。
- 某维度 **relevant 条目 < 2**,即使 `dataCompleteness` 标 `ok`,也按数据贫瘠处理:score ≤ 25,reason 写"返回结果与 idea 相关性不足(如全是词典/跑题),无法评估真实需求"。
- 这是 `enforceNoData` 的补充:`enforceNoData` 只看源通没通,闸门看内容对不对。**两者都过才给真实高分。** completeness 标 ok 但内容是垃圾 ≠ 有数据。

评分维度(各自 0-100):

- **search 搜索+趋势**:搜索量+趋势方向。相关词多=高分;量低但趋势陡升=中高分;几乎无搜索=低分。
- **community 社区**:讨论帖数量+需求强度。`求推荐` > `有人用过吗` > `X发布了`;有明确"我需要Y"=高分。
- **competitor 竞品+付费**:方案覆盖度+不满程度+付费意愿。无直接竞品+B2B=高分;竞品强且口碑好+C端免费替代多=低分。

**反例(常见错误,务必避免)**:
- 竞品多且口碑好 = 低分,**不是**高分。市场大 ≠ 你的机会大。
- "Grammarly/Jasper 市场大所以需求强"是错的;正确是"它们已覆盖,新进入者无空间"=低分。

**硬约束**:
- 只用第 2 步给的数据判断。竞品名、用户评价必须来自数据里的条目,**不许用训练数据编造**。
- `sources` 里每条 url 必须是数据里出现过的真实链接(禁止编 URL)。
- 信号冲突(如搜索低但社区高)必须在报告里点明,不要只取一个方向。
- `reason` 要具体,引用数据里的实际数字/帖子标题。

**enforceNoData(硬规则,不可妥协)**:
对每个市场看它的 `dataCompleteness`。`ok:false` 的维度 → 该维度 **score 必须为 10**,reason 写"本次该维度所有数据源抓取失败,无法评估真实需求"。这是为了防止数据缺失时臆测出中等分——数据没有就不能编。

### 第 4 步:算总分 + 结论
每个市场:
- `total` = round(search × 0.4 + community × 0.3 + competitor × 0.3)
- `verdict`:≥70 = **造**;≥40 = **可以造,注意风险**;<40 = **不建议造**

### 第 5 步:跨市场对比(Part C)
基于两个市场的总分和原始数据:
- **scoreDiff**:本地 vs 对方总分差 + 谁更高
- **coreDifferences**:为什么两个市场分数不同(场景/竞品/付费意愿,要具体)
- **recommendedStrategy.primaryMarket**:先做哪个市场(local/foreign/both/neither),给可执行的 specificAction
- **entryBarriers**:进对方市场的障碍(语言/支付/法律/本地化/分发),标严重度 low/medium/high
- **recommendedChannels**:对方市场的获客渠道,标优先级
- **pricingSuggestion**:基于对方市场竞品定价给价格区间建议

### 第 6 步:输出双语报告
按以下结构输出中文 markdown:

```
# 需求验证:<idea>

## 🏠 本地市场(<中文/英文>)
**总分 XX/100 — <verdict>**
- 搜索+趋势:XX — <原因>
- 社区:XX — <原因>
- 竞品+付费:XX — <原因>
- 谁会付费:<角色+场景>
- 主要风险:<...>

## 🌍 对方市场(<...>)
(同上结构)

## 📊 跨市场建议
- **先做**:<市场> — <具体行动>
- **分差**:本地 XX vs 对方 XX
- **核心差异**:...
- **进入障碍**:...
- **获客渠道**:...
- **定价建议**:...

## 🔗 数据来源
(真实链接,按市场分组;数据缺失的维度明确标注)
```

**输出原则**:诚实。数据缺失就明说缺失,绝不编。报告是决策辅助,不是决策本身。
