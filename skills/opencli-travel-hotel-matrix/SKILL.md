---
name: opencli-travel-hotel-matrix
description: 用 opencli 做旅游酒店攻略。适用于“先用小红书搜热门酒店，再用 Trip 单晚价格做矩阵，最后生成 HTML 和入住组合建议”的任务，前提是本机可用 opencli。
---

# OpenCLI Travel Hotel Matrix

## Overview

这个 skill 用来把“模糊的订酒店问题”收敛成一个可执行的研究流程：

1. 建立酒店池：小红书高频、用户点名、预算可订、外部知名候选都要纳入
2. 用 `opencli xiaohongshu` 找真实优缺点和中文用户讨论证据
3. 用 `opencli ctrip search` 或人工归一化中文名/英文名
4. 用 `opencli trip hotel-night-price` 拉单晚最低可订价，并校验匹配酒店
5. 拼成价格矩阵和区域导读
6. 生成带筛选、链接、方案比较的 HTML

这个 skill 适合：

- 旅游城市酒店选择
- 不同旅行意图下的酒店分段住法比较
- 用户想先做价格矩阵，再反推到底该不该换酒店、换几次酒店
- 需要同时给出价格、位置、口碑、链接、推荐理由

不适合：

- 只查一家酒店一个日期。这种直接调用 `opencli trip hotel-night-price` 即可。

## Prerequisite

先确认 opencli 可用：

```bash
opencli doctor --no-live
opencli list -f json | jq '.[] | select(.site=="trip" or .site=="xiaohongshu" or .site=="ctrip") | {site,name}'
```

至少应看到：

- `xiaohongshu/search`
- `xiaohongshu/note`
- `ctrip/search`
- `trip/hotel-night-price`

## Workflow

### Step 1: 定义搜索范围

先明确这些变量：

- 城市
- 日期范围
- 预算上限
- 是否接受换酒店
- 旅行意图：度假、亲子、商务、中转、城市游、吃喝夜生活、看景点、顺路去其他城市
- 酒店偏好：度假型、交通方便、景点步行、安静、品牌连锁、设计感、可过渡省钱
- 是否有必须住某一区域的硬约束
- 是否存在晚到/早走这种让第一晚或最后一晚可以降配的情况

如果用户没有说清楚，优先补这几个，不要一开始就搜太散。

不要默认城市是海滨城市，也不要默认用户要海景或 resort。先用旅行意图决定酒店池类型。

### Step 1.5: 建立工作数据文件

如果任务会跨多轮搜索或要生成 HTML，创建一个工作 JSON 文件作为事实源，例如：

```bash
hotel-matrix.json
```

中途可以在上下文里临时记录，但最终生成 HTML 时必须把酒店、价格、来源链接都写进 JSON。这样可以避免最后一步丢失小红书链接、Trip 价格页或携程链接。

数据结构参考：

[references/data-schema.md](./references/data-schema.md)

### Step 2: 建立酒店池

不要只依赖一个来源。酒店池至少分四层：

- `用户点名候选`：用户明确提到的酒店、区域、品牌、度假村
- `小红书高频候选`：中文用户常讨论、测评、决赛圈、避雷帖里反复出现的酒店
- `预算可订候选`：Trip/携程里实际能落到预算附近的酒店
- `外部知名候选`：目的地级、国际品牌、经典度假村、设计酒店、亲子/主题酒店；即使明显预算外，也应列入“种草/不优先”或“扩展候选”，帮助用户建立完整视野

先搜合集，再搜单酒店测评。搜索词不要只围绕预算酒店；如果目的地有高端 resort、老牌酒店、会安/老城/机场/海岛等典型区域，也要单独搜一轮。

```bash
opencli xiaohongshu search '岘港 酒店 攻略'
opencli xiaohongshu search '岘港 海景酒店 推荐'
opencli xiaohongshu search '岘港 酒店 测评 凯悦 富丽华 TMS 萨拉 佩尼苏拉'
opencli xiaohongshu search '岘港 度假村 推荐 洲际 纳曼 TIA Sheraton'
```

然后对高频酒店继续看 note：

```bash
opencli xiaohongshu note '<note-url>'
```

链接采集规则：

- 从 `opencli xiaohongshu search` 返回结果里保存候选 note URL
- 看过的 note URL 立即放进 `hotel.xiaohongshu.noteLinks[]`
- 如果暂时没有强测评，给酒店保留 `hotel.xiaohongshu.searchUrl`
- 不要等到 HTML 生成阶段再回头找小红书链接

输出时不要只写一句“早餐不错”。至少提炼这些维度：

- 位置
- 海景/沙滩距离
- 早餐
- 泳池/设施
- 隔音/噪音
- 新旧程度
- 周边吃饭是否方便
- 是否常见负面点

不要把小红书当唯一事实源。小红书适合发现中文用户感受、照片角度、避雷点、决赛圈，但不适合单独决定完整酒店池。对于外部知名候选，如果小红书低频但酒店本身是目的地级或品牌级，也可以保留，并把 `sourceEvidenceLabel` 标成“外部知名+价格验证”或“补充候选”。

把来源证据标成面向用户能懂的标签，不要在 HTML 里直接暴露“强/中/弱”这种内部口径：

- `多篇/专门笔记`：有专门长测评或多篇一致反馈
- `对比帖常见`：常出现在对比帖/决赛圈
- `补充候选`：只在合集、求推荐、预算补位里被提到
- `外部知名+价格验证`：不是小红书高频主线，但属于知名酒店，且价格匹配可靠
- `外部知名，价格待核`：知名酒店应列入视野，但自动价格匹配不可靠

### Step 2.5: 区域导读

如果目的地有明显区域差异，生成 `regionGuides[]`。区域导读应放在 HTML 的筛选器之前，因为它解释了筛选器里的地理标签。

每个区域至少写清：

- 酒店类型：城市海滩酒店、老牌 resort、机场中转、老城客栈、海岛 villa 等
- 整体感觉：便利、安静、亲子、夜生活、纯度假、离景点近等
- 适合谁：预算旅客、亲子、蜜月、晚到早走、第一次来、想去某景点
- 注意点：交通、吃饭、噪音、新旧、距离、价格跳涨

区域必须是真实地理区域或动线区域。不要把“预算内”“备选”“价格跳涨”“经典老牌”“养生/SPA”这类判断混进 `region` 或 `areaTag`；这些应放进 `category`、`priceStatus` 或 `sourceEvidenceLabel`。

### Step 3: 归一化酒店名

优先保留：

- 中文名
- 英文名
- Trip/携程常见展示名

如果中文名不稳定，可用：

```bash
opencli ctrip search '岘港 凯悦'
opencli ctrip search 'Peninsula Hotel Danang'
```

`ctrip search` 更适合做名字归一化，不要把它当完整价格源。

如果 `ctrip search` 或浏览器打开携程产生了可复用链接，把它保存为 `hotel.ctripUrl`。没有真实链接时留空，不要拼一个看似正确但未验证的详情页。

如果 `trip hotel-night-price` 返回的 `matchedHotel` 与目标酒店明显不是同一家：

- 不要把这个价格写入矩阵
- 将该晚价格留空
- 标记 `priceReliability: "mismatch_rejected"` 或 `manual_check_needed`
- 可以保留该酒店为“外部知名/价格待核”候选，但不要参与组合方案计算

### Step 4: 用单晚价命令做价格矩阵

核心原子命令：

```bash
opencli trip hotel-night-price 'Peninsula Hotel Danang' \
  --city 'Da Nang' \
  --check-in 2026-05-03 \
  --check-out 2026-05-04 \
  -f json
```

推荐字段：

- `price`
- `totalPrice`
- `roomType`
- `breakfast`
- `freeCancel`
- `availability`
- `detailUrl`

把 `detailUrl` 保存为 `hotel.tripUrl` 或放进 `hotel.sourceLinks[]`。价格矩阵和 HTML 都应复用这个链接，不要在 HTML 阶段重新猜链接。

每次抓价都要记录：

- `matchedHotel`
- `availability`
- `totalPrice`
- `roomType`
- `breakfast`
- `freeCancel`
- `detailUrl`
- `priceReliability`

矩阵要按“夜晚”展开，而不是只给前段/后段均价：

- `5/2`
- `5/3`
- `5/4`
- `5/5`
- `5/6`

如果某晚没抓到：

- 标空，不要瞎估
- 但可以保留 `5/4-5/7` 这种多晚均价作为辅助列

### Step 5: 组合推荐

不要先入为主假设切法。正确顺序是：

1. 先拿到酒店池
2. 再拉每一晚的矩阵
3. 最后让矩阵反推住法

输出时可以比较这些常见形态，但它们只是候选，不是预设答案：

- `5晚同住`
- `1+4`
- `2+3`
- `1+1+3`
- `2+1+2`
- 任何从矩阵里算出来更优的拆法

每个组合都要写清：

- 每晚住哪家
- 每晚单价
- 总价
- 平均每晚
- 为什么这么切

推荐逻辑通常按这几类输出：

- `最稳`
- `最省`
- `后半程体验最好`
- `只在包价出现时成立`

重点：用户的核心问题通常不是“在这几种切法里选哪种”，而是“根据矩阵，最值得的切法到底是什么”。

### Step 6: 生成 HTML

HTML 至少要包含：

- 行程背景和价格口径
- 区域导读：如果有明显区域差异，放在筛选器前面
- 筛选器：只用粗粒度字段，默认 `酒店类型 / 地理区域 / 来源证据`
- 总表：中文名 / 英文名 / 类型 / 区域 / 多晚价格 / 价格状态 / 来源证据 / 优缺点 / 链接
- 组合方案区：总价、每晚拆分、理由，默认放在酒店矩阵后面
- 外链：Trip、携程、小红书搜索、小红书笔记、其他来源链接

推荐交互：

- 价格列固定在表中
- 区域导读放在 filter 前面
- filter 放在酒店表前面，组合方案默认放在表格后面
- 支持多选
- 方案区支持按总价或均价排序

默认信息架构：

1. 背景和价格口径
2. 区域导读
3. 筛选器
4. 酒店价格矩阵
5. 组合方案

只有当用户明确说“直接拍板/先给结论”时，才把方案提前到矩阵之前。

筛选器不要暴露内部碎标签。`useCases`、`notes`、`priceStatus` 可以进表格，但默认不要作为筛选器，除非这些字段已经被人工整理成 2-4 个稳定选项。

可以直接用自带脚手架生成：

```bash
node /Users/haoyuebai/.codex/skills/opencli-travel-hotel-matrix/scripts/generate_hotel_matrix_html.mjs \
  --input /absolute/path/hotels.json \
  --output /absolute/path/hotel-matrix.html \
  --title 'Da Nang Hotel Matrix'
```

示例输入见：

[assets/sample-hotel-matrix.json](./assets/sample-hotel-matrix.json)

生成器只消费 JSON 里的链接字段。它不负责搜索，不负责推断 Ctrip 详情页，也不负责补小红书来源。

生成器是通用模板，不要求所有任务都长得一样。如果用户对页面结构提出反馈，允许基于同一 JSON 事实源生成定制 HTML；但定制不能破坏这些原则：

- 地理区域、价格判断、来源证据分字段保存
- 错配价格不能参与计算
- 来源链接必须来自真实采集
- 组合推荐必须能从矩阵价格反推

## Output Standard

最终结果至少要给用户这三层：

1. 一张完整酒店矩阵
2. 一份可点击的 HTML
3. 一组明确推荐方案，而不是只列酒店

如果用户已经很焦虑，优先直接拍板：

- `最推荐 3 套`
- `候补 3 套`
- `不建议优先选`

## Command Recipes

常用命令清单见：

[references/command-recipes.md](./references/command-recipes.md)

数据结构见：

[references/data-schema.md](./references/data-schema.md)
