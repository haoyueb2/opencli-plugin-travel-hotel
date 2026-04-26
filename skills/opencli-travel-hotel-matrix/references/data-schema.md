# Hotel Matrix Data Schema

The HTML generator is intentionally data-driven. During research, keep a working JSON draft and update it as links and prices are discovered.

Recommended working file names:

- `hotel-candidates.json`
- `hotel-matrix.json`

## Top Level

```json
{
  "summary": "Short report summary",
  "tripContext": {
    "city": "Da Nang",
    "checkIn": "2026-05-02",
    "checkOut": "2026-05-07",
    "budgetPerNight": 800,
    "travelIntent": ["beach", "relax", "day trip to Hoi An"],
    "switchTolerance": "one_or_two_switches"
  },
  "hotels": [],
  "combos": []
}
```

## Hotel Fields

```json
{
  "nameZh": "岘港佩尼苏拉酒店",
  "nameEn": "Peninsula Hotel Danang",
  "region": "美溪北段",
  "locationSummary": "Short location summary",
  "tripUrl": "https://www.trip.com/...",
  "ctripUrl": "https://hotels.ctrip.com/...",
  "nightlyPrices": {
    "5/2": 559,
    "5/3": 534
  },
  "lateStayAvg": 572,
  "useCases": ["后段主住", "最平衡"],
  "xiaohongshu": {
    "strength": "强",
    "searchUrl": "https://www.xiaohongshu.com/search_result?...",
    "pros": ["早餐稳定", "位置方便"],
    "cons": ["周末可能贵"],
    "noteLinks": [
      {
        "label": "小红书测评",
        "url": "https://www.xiaohongshu.com/..."
      }
    ]
  },
  "sourceLinks": [
    {
      "label": "Trip 价格页",
      "url": "https://www.trip.com/..."
    }
  ]
}
```

## Link Policy

Capture links at the moment they are discovered:

- Save Trip links from `opencli trip hotel-night-price` output `detailUrl`.
- Save Xiaohongshu note URLs from `opencli xiaohongshu search` and `opencli xiaohongshu note`.
- Save Xiaohongshu search URLs when a hotel has no strong note yet.
- Save Ctrip URLs only when they came from a real Ctrip search/detail page. Do not invent Ctrip detail URLs.
- Put any extra source in `sourceLinks[]`.

The HTML generator reads these fields. It should not perform searches or invent links.

## Combo Fields

```json
{
  "name": "最稳",
  "type": "matrix-derived",
  "reason": "Why this combination wins",
  "nightlyBreakdown": [
    {
      "night": "5/2",
      "hotelZh": "Example Hotel",
      "price": 384
    }
  ]
}
```
