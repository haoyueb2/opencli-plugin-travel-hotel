# Hotel Matrix Data Schema

The HTML generator is intentionally data-driven. During research, keep a working JSON draft and update it as links, prices, evidence, regions, and combinations are discovered.

Recommended working file names:

- `hotel-candidates.json`
- `hotel-matrix.json`

## Design Principles

- Keep geography separate from judgment. `areaTag` and `region` must be real places or route zones, not values such as "budget", "backup", "price jump", or "classic".
- Keep source evidence separate from recommendation. Use `sourceEvidenceLabel` to explain why a hotel is in the pool, and use `priceStatus` / `priceReliability` for booking risk.
- Expose only coarse filter dimensions in HTML. Good filters are `category`, `areaTag`, and `sourceEvidenceLabel`. Do not expose every internal tag as a filter.
- Store every link when it is discovered. The HTML generator should not invent Trip, Ctrip, Xiaohongshu, or review links.

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
  "regionGuides": [],
  "hotels": [],
  "combos": []
}
```

## Region Guide Fields

Use `regionGuides[]` when region choice matters. These cards should sit before filters and the hotel matrix, because they help the user understand what the filters mean.

```json
{
  "name": "美溪核心段",
  "hotelStyle": "城市海滩酒店、海景楼、性价比酒店",
  "vibe": "Most convenient beach base with restaurants, cafes, and easy ride-hailing.",
  "bestFor": "First-time visitors who want beach access and low friction.",
  "watch": "Not a secluded resort zone; public beach and city-hotel feel.",
  "exampleHotels": ["岘港萨拉海滩酒店", "岘港 TMS 海滩酒店"]
}
```

## Hotel Fields

```json
{
  "nameZh": "岘港佩尼苏拉酒店",
  "nameEn": "Peninsula Hotel Danang",
  "category": "预算海边",
  "region": "美溪北段",
  "areaTag": "美溪北段",
  "locationSummary": "Short location summary",
  "priceStatus": "预算内",
  "priceReliability": "matched",
  "sourceEvidenceLabel": "对比帖常见",
  "tripUrl": "https://www.trip.com/...",
  "ctripUrl": "https://hotels.ctrip.com/...",
  "nightlyPrices": {
    "5/2": 559,
    "5/3": 534
  },
  "lateStayAvg": 572,
  "notes": ["Optional internal notes"],
  "xiaohongshu": {
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

### Field Notes

- `category`: coarse hotel type for filtering, such as `budget_beach`, `brand_seaview`, `resort`, `luxury_splurge`, `family_theme`, or localized labels.
- `areaTag`: geographic filter label. It must be a real zone, neighborhood, beach section, island, airport area, old town area, etc.
- `priceStatus`: human-readable price judgment, such as `budget_fit`, `borderline`, `late_stay_value`, `price_jump`, `sold_out_partial`, or localized labels.
- `priceReliability`: use `matched`, `name_normalized`, `manual_check_needed`, `mismatch_rejected`, `sold_out`, or `unknown`.
- `sourceEvidenceLabel`: human-readable source basis, such as `多篇/专门笔记`, `对比帖常见`, `外部知名+价格验证`, or `补充候选`.
- Legacy `xiaohongshu.strength` may be read as a fallback, but new reports should prefer `sourceEvidenceLabel`.
- Legacy `useCases` can remain for internal reasoning, but do not expose it as a default HTML filter unless the values are intentionally curated.

## Link Policy

Capture links at the moment they are discovered:

- Save Trip links from `opencli trip hotel-night-price` output `detailUrl`.
- Save Xiaohongshu note URLs from `opencli xiaohongshu search` and `opencli xiaohongshu note`.
- Save Xiaohongshu search URLs when a hotel has no strong note yet.
- Save Ctrip URLs only when they came from a real Ctrip search/detail page. Do not invent Ctrip detail URLs.
- Put any extra source in `sourceLinks[]`.

The HTML generator reads these fields. It should not perform searches or invent links.

## Price Match Policy

When using `opencli trip hotel-night-price`, compare the requested hotel name with `matchedHotel`.

- If the match is correct, save the price and set `priceReliability` to `matched`.
- If the command matched a different hotel, do not save that price as fact. Leave the night blank, add a note, and set `priceReliability` to `mismatch_rejected` or `manual_check_needed`.
- If a hotel is famous but price matching is unreliable, keep it in the hotel pool as a context candidate, but do not use it in combination math.

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
