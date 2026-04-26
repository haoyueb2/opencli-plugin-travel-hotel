---
name: opencli-travel-hotel-matrix
description: 用 opencli 做旅游酒店攻略。适用于“先用小红书搜热门酒店，再用 Trip 单晚价格做矩阵，最后生成 HTML 和入住组合建议”的任务，前提是本机可用 opencli。
---

# OpenCLI Travel Hotel Matrix

## Overview

这个 skill 用来把“模糊的订酒店问题”收敛成一个可执行的研究流程：

1. 用 `opencli xiaohongshu` 找高频酒店和真实优缺点
2. 用 `opencli ctrip search` 或人工归一化中文名/英文名
3. 用 `opencli trip hotel-night-price` 拉单晚最低可订价
4. 拼成价格矩阵
5. 生成带筛选、链接、方案比较的 HTML

这个 skill 适合：

- 旅游城市酒店选择
- 海景酒店 / 度假村 / 市区酒店分段住法比较
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
- 是否优先海景 / resort / 市区便利
- 是否有必须住某一区域的硬约束
- 是否存在晚到/早走这种让第一晚或最后一晚可以降配的情况

如果用户没有说清楚，优先补这几个，不要一开始就搜太散。

### Step 2: 从小红书拉“酒店池”

先搜合集，再搜单酒店测评。

```bash
opencli xiaohongshu search '岘港 酒店 攻略'
opencli xiaohongshu search '岘港 海景酒店 推荐'
opencli xiaohongshu search '岘港 酒店 测评 凯悦 富丽华 TMS 萨拉 佩尼苏拉'
```

然后对高频酒店继续看 note：

```bash
opencli xiaohongshu note '<note-url>'
```

输出时不要只写一句“早餐不错”。至少提炼这些维度：

- 位置
- 海景/沙滩距离
- 早餐
- 泳池/设施
- 隔音/噪音
- 新旧程度
- 周边吃饭是否方便
- 是否常见负面点

把小红书证据强度标成：

- `强`：有专门长测评或多篇一致反馈
- `中`：常出现在对比帖/决赛圈
- `弱`：只在合集或求推荐里被提到

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

- 总表：中文名 / 英文名 / 区域 / 多晚价格 / 小红书证据 / 优缺点
- 组合方案区：总价、每晚拆分、理由
- 筛选器：区域、用途、小红书强弱
- 外链：Trip 或携程可点击链接

推荐交互：

- 价格列固定在表中
- filter 放在酒店表前面
- 支持多选
- 方案区支持按总价或均价排序

可以直接用自带脚手架生成：

```bash
node /Users/haoyuebai/.codex/skills/opencli-travel-hotel-matrix/scripts/generate_hotel_matrix_html.mjs \
  --input /absolute/path/hotels.json \
  --output /absolute/path/hotel-matrix.html \
  --title 'Da Nang Hotel Matrix'
```

示例输入见：

[assets/sample-hotel-matrix.json](./assets/sample-hotel-matrix.json)

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
