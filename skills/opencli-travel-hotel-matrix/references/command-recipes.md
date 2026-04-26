# Command Recipes

## 小红书

```bash
opencli xiaohongshu search '岘港 酒店 攻略'
opencli xiaohongshu search '岘港 海景酒店 推荐'
opencli xiaohongshu search '岘港 凯悦 富丽华 TMS 萨拉 佩尼苏拉 酒店'
opencli xiaohongshu note '<note-url>'
```

## 名字归一化

```bash
opencli ctrip search '岘港 凯悦'
opencli ctrip search 'Peninsula Hotel Danang'
opencli ctrip search 'Naman Retreat'
```

## Trip 单晚价

```bash
opencli trip hotel-night-price 'Peninsula Hotel Danang' \
  --city 'Da Nang' \
  --check-in 2026-05-03 \
  --check-out 2026-05-04 \
  -f json
```

```bash
opencli trip hotel-night-price 'Paris Deli Danang Beach Hotel' \
  --city 'Da Nang' \
  --check-in 2026-05-03 \
  --check-out 2026-05-04 \
  -f json
```

## 建议的矩阵节奏

对每家酒店分别查：

- `D1 -> D2`
- `D2 -> D3`
- `D3 -> D4`
- `D4 -> D5`
- `D5 -> D6`

然后再额外查：

- `后 3 晚均价`
- `前 2 晚均价`

## HTML 输出建议

HTML 里建议保留这些列：

- 中文名
- 英文名
- 区域
- `5/2`
- `5/3`
- `5/4`
- `5/5`
- `5/6`
- `5/4-5/7均价`
- 小红书强度
- 小红书优点
- 小红书缺点
- 用途判断
- 外链
