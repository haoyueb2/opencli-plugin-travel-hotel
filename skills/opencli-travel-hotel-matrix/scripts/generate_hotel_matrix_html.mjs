#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.error(
    'Usage: node generate_hotel_matrix_html.mjs --input hotels.json --output report.html [--title "Hotel Matrix"]',
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = { title: 'Hotel Matrix' };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') args.input = argv[++i];
    else if (arg === '--output') args.output = argv[++i];
    else if (arg === '--title') args.title = argv[++i];
    else if (arg === '--help' || arg === '-h') usage();
    else throw new Error(`Unknown arg: ${arg}`);
  }
  if (!args.input || !args.output) usage();
  return args;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toNumber(value) {
  if (value == null || value === '') return null;
  const cleaned = String(value).replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function formatMoney(value) {
  const num = toNumber(value);
  if (num == null) return '-';
  return `¥${Math.round(num)}`;
}

function buildNightColumns(hotels) {
  const keys = new Set();
  for (const hotel of hotels) {
    for (const key of Object.keys(hotel.nightlyPrices || {})) keys.add(key);
  }
  return [...keys].sort();
}

function average(values) {
  const nums = values.map(toNumber).filter((item) => item != null);
  if (!nums.length) return null;
  return nums.reduce((sum, item) => sum + item, 0) / nums.length;
}

function computeComboTotals(combo) {
  const nightly = Array.isArray(combo.nightlyBreakdown) ? combo.nightlyBreakdown : [];
  const total = nightly.reduce((sum, item) => sum + (toNumber(item.price) || 0), 0);
  const avg = nightly.length ? total / nightly.length : 0;
  return { total, avg };
}

function xhsStrengthLabel(strength) {
  if (strength === '强') return '多篇/专门笔记';
  if (strength === '中') return '对比帖常见';
  if (strength === '弱') return '补充候选';
  return '';
}

function hotelCategory(hotel) {
  return hotel.category || hotel.hotelType || '未分类';
}

function hotelArea(hotel) {
  return hotel.areaTag || hotel.region || '';
}

function hotelEvidence(hotel) {
  return hotel.sourceEvidenceLabel || hotel.evidenceLabel || xhsStrengthLabel(hotel.xiaohongshu?.strength) || '未标注';
}

function renderFilterChips(items, attr) {
  return items
    .map((item) => `<button class="chip" type="button" data-filter="${escapeHtml(attr)}" data-value="${escapeHtml(item)}">${escapeHtml(item)}</button>`)
    .join('');
}

function buildHotelLinks(hotel) {
  const links = [];
  const push = (label, url) => {
    if (url) links.push({ label, url });
  };

  push('Trip', hotel.tripUrl);
  push('Ctrip', hotel.ctripUrl);
  push('小红书搜索', hotel.xiaohongshu?.searchUrl);

  for (const item of hotel.xiaohongshu?.noteLinks || []) {
    push(item.label || '小红书笔记', item.url);
  }

  for (const item of hotel.sourceLinks || []) {
    push(item.label || item.source || 'Source', item.url);
  }

  const seen = new Set();
  return links.filter((item) => {
    const key = `${item.label}|${item.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderRegionGuide(region, hotels) {
  const matching = hotels.filter((hotel) => hotelArea(hotel) === region.name);
  const examples = region.exampleHotels || matching.slice(0, 3).map((hotel) => hotel.nameZh || hotel.nameEn).filter(Boolean);
  return `
    <article class="region-card">
      <div class="region-head">
        <h3>${escapeHtml(region.name || '')}</h3>
        <span>${matching.length ? `${matching.length} 家候选` : ''}</span>
      </div>
      <dl>
        ${region.hotelStyle ? `<div><dt>酒店类型</dt><dd>${escapeHtml(region.hotelStyle)}</dd></div>` : ''}
        ${region.vibe ? `<div><dt>整体感觉</dt><dd>${escapeHtml(region.vibe)}</dd></div>` : ''}
        ${region.bestFor ? `<div><dt>适合</dt><dd>${escapeHtml(region.bestFor)}</dd></div>` : ''}
        ${region.watch ? `<div><dt>注意</dt><dd>${escapeHtml(region.watch)}</dd></div>` : ''}
      </dl>
      ${examples.length ? `<p class="examples">本表例子：${examples.map(escapeHtml).join(' / ')}</p>` : ''}
    </article>
  `;
}

function renderHotelRow(hotel, nightColumns) {
  const nightly = hotel.nightlyPrices || {};
  const pros = Array.isArray(hotel.xiaohongshu?.pros) ? hotel.xiaohongshu.pros : [];
  const cons = Array.isArray(hotel.xiaohongshu?.cons) ? hotel.xiaohongshu.cons : [];
  const links = buildHotelLinks(hotel);
  const allNightValues = nightColumns.map((night) => nightly[night]);
  const completeTotal = allNightValues.every((value) => toNumber(value) != null)
    ? allNightValues.reduce((sum, value) => sum + toNumber(value), 0)
    : null;
  const avgPrice = hotel.lateStayAvg ?? average(allNightValues);

  return `
    <tr
      data-category="${escapeHtml(hotelCategory(hotel))}"
      data-area="${escapeHtml(hotelArea(hotel))}"
      data-evidence="${escapeHtml(hotelEvidence(hotel))}"
    >
      <td class="sticky hotel-cell">
        <div class="hotel-name">${escapeHtml(hotel.nameZh || hotel.nameEn || '')}</div>
        <div class="hotel-sub">${escapeHtml(hotel.nameEn || '')}</div>
        ${links.length ? `<div class="hotel-link">${links.slice(0, 4).map((item) => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)}</a>`).join(' · ')}</div>` : ''}
      </td>
      <td><span class="pill">${escapeHtml(hotelCategory(hotel))}</span></td>
      <td>${escapeHtml(hotel.region || hotelArea(hotel) || '-')}</td>
      ${nightColumns.map((night) => `<td class="price">${formatMoney(nightly[night])}</td>`).join('')}
      <td class="price">${formatMoney(completeTotal)}</td>
      <td class="price">${formatMoney(avgPrice)}</td>
      <td>${escapeHtml(hotel.priceStatus || hotel.priceReliability || '-')}</td>
      <td>${escapeHtml(hotelEvidence(hotel))}</td>
      <td>${escapeHtml(hotel.locationSummary || '-')}</td>
      <td>${pros.length ? `<ul>${pros.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '-'}</td>
      <td>${cons.length ? `<ul>${cons.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '-'}</td>
      <td>${links.length ? links.map((item) => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)}</a>`).join('<br/>') : '-'}</td>
    </tr>
  `;
}

function renderComboCard(combo) {
  const { total, avg } = computeComboTotals(combo);
  const breakdown = Array.isArray(combo.nightlyBreakdown) ? combo.nightlyBreakdown : [];
  return `
    <article class="combo-card" data-total="${total}" data-avg="${avg}">
      <div class="combo-head">
        <div>
          <h3>${escapeHtml(combo.name || '')}</h3>
          <p class="combo-type">${escapeHtml(combo.type || '')}</p>
        </div>
        <div class="combo-price">
          <div>总价 ${formatMoney(total)}</div>
          <div>均价 ${formatMoney(avg)}</div>
        </div>
      </div>
      <p class="combo-reason">${escapeHtml(combo.reason || '')}</p>
      <ul class="combo-list">
        ${breakdown.map((item) => `<li><strong>${escapeHtml(item.night || '')}</strong> · ${escapeHtml(item.hotelZh || item.hotel || '')} · ${formatMoney(item.price)}</li>`).join('')}
      </ul>
    </article>
  `;
}

function renderHtml(data, title) {
  const hotels = Array.isArray(data.hotels) ? data.hotels : [];
  const combos = Array.isArray(data.combos) ? data.combos : [];
  const regionGuides = Array.isArray(data.regionGuides) ? data.regionGuides : [];
  const nightColumns = buildNightColumns(hotels);
  const categories = [...new Set(hotels.map(hotelCategory).filter(Boolean))];
  const areas = [...new Set(hotels.map(hotelArea).filter(Boolean))];
  const evidences = [...new Set(hotels.map(hotelEvidence).filter(Boolean))];

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #f7f7f4;
      --panel: #ffffff;
      --ink: #1f2528;
      --muted: #667176;
      --line: #dfe3df;
      --accent: #1f7a6b;
      --warm: #b86135;
      --soft: #eef4f1;
      --warn: #f7eee7;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", sans-serif;
      color: var(--ink);
      background: var(--bg);
    }
    .page { max-width: 1480px; margin: 0 auto; padding: 28px 20px 52px; }
    .hero { padding-bottom: 18px; border-bottom: 1px solid var(--line); }
    .hero h1 { margin: 0 0 8px; font-size: 30px; line-height: 1.2; letter-spacing: 0; }
    .hero p { margin: 0; color: var(--muted); line-height: 1.7; max-width: 980px; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 18px 0; }
    .metric, .filters, .region-card, .panel, .combo-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .metric { padding: 14px; }
    .metric strong { display: block; font-size: 22px; margin-bottom: 4px; }
    .metric span { color: var(--muted); font-size: 13px; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin: 18px 0 8px; flex-wrap: wrap; }
    h2 { margin: 0; font-size: 20px; letter-spacing: 0; }
    .note { color: var(--muted); font-size: 13px; }
    .region-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .region-card { padding: 14px; }
    .region-head { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
    .region-head h3 { margin: 0; font-size: 15px; letter-spacing: 0; }
    .region-head span, .examples { color: var(--muted); font-size: 12px; }
    .region-card dl { display: grid; gap: 8px; margin: 0; }
    .region-card dt { color: var(--muted); font-size: 12px; }
    .region-card dd { margin: 0; font-size: 13px; line-height: 1.55; }
    .examples { margin: 10px 0 0; color: var(--accent); line-height: 1.5; }
    .filters { padding: 16px; margin: 18px 0 14px; }
    .filter-row { display: grid; grid-template-columns: 110px 1fr; gap: 12px; padding: 8px 0; border-bottom: 1px solid #edf0ed; }
    .filter-row:last-child { border-bottom: 0; }
    .filter-label { color: var(--muted); font-size: 13px; padding-top: 7px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      border: 1px solid var(--line);
      background: #fff;
      color: var(--ink);
      border-radius: 8px;
      padding: 7px 10px;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
    }
    .chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
    .legend { background: var(--warn); border: 1px solid #edd6c6; border-radius: 8px; padding: 12px; color: #6e4d39; margin: 12px 0 0; font-size: 13px; line-height: 1.7; }
    .panel { padding: 0; overflow: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 1320px; }
    th, td { border-bottom: 1px solid #edf0ed; vertical-align: top; text-align: left; padding: 11px 12px; font-size: 13px; line-height: 1.45; }
    th { position: sticky; top: 0; z-index: 3; background: #f2f5f2; white-space: nowrap; }
    .sticky { position: sticky; left: 0; z-index: 2; background: #fff; }
    th.sticky { z-index: 4; background: #f2f5f2; }
    .hotel-cell { min-width: 250px; box-shadow: 10px 0 18px rgba(30,20,10,0.04); }
    .hotel-name { font-weight: 700; margin-bottom: 4px; }
    .hotel-sub, .hotel-link a { color: var(--muted); font-size: 12px; }
    .hotel-link { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 7px; }
    td ul { margin: 0; padding-left: 18px; line-height: 1.6; }
    td.price { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; white-space: nowrap; }
    .pill { display: inline-flex; border-radius: 999px; background: var(--soft); color: var(--accent); padding: 4px 8px; white-space: nowrap; }
    a { color: #116b8f; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .combo-section { margin-top: 28px; }
    .combo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
    .combo-card { padding: 16px; }
    .combo-head { display: flex; justify-content: space-between; gap: 12px; }
    .combo-card h3 { margin: 0 0 6px; font-size: 18px; letter-spacing: 0; }
    .combo-type, .combo-reason { color: var(--muted); line-height: 1.6; }
    .combo-price { text-align: right; font-weight: 700; white-space: nowrap; }
    .combo-list { margin: 12px 0 0; padding-left: 18px; line-height: 1.65; }
    .hidden { display: none; }
    @media (max-width: 900px) {
      .page { padding: 18px 12px 40px; }
      .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .region-grid { grid-template-columns: 1fr; }
      .filter-row { grid-template-columns: 1fr; gap: 6px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(data.summary || '这份页面用于把酒店池、来源证据、按夜价格矩阵和入住组合放到同一页里，方便快速比较与收口。')}</p>
    </section>

    <section class="summary">
      <div class="metric"><strong>${hotels.length}</strong><span>酒店总数</span></div>
      <div class="metric"><strong>${combos.length}</strong><span>组合方案</span></div>
      <div class="metric"><strong>${nightColumns.length}</strong><span>单晚价格列</span></div>
      <div class="metric"><strong>${areas.length}</strong><span>地理区域</span></div>
    </section>

    ${regionGuides.length ? `
    <section class="region-guide">
      <div class="toolbar">
        <h2>区域怎么选</h2>
        <div class="note">先按区域气质排除，再回到价格矩阵看具体酒店</div>
      </div>
      <div class="region-grid">
        ${regionGuides.map((region) => renderRegionGuide(region, hotels)).join('')}
      </div>
    </section>` : ''}

    <section class="filters">
      <div class="filter-row"><div class="filter-label">酒店类型</div><div class="chips">${renderFilterChips(categories, 'category')}</div></div>
      <div class="filter-row"><div class="filter-label">地理区域</div><div class="chips">${renderFilterChips(areas, 'area')}</div></div>
      <div class="filter-row"><div class="filter-label">来源证据</div><div class="chips">${renderFilterChips(evidences, 'evidence')}</div></div>
      <div class="legend">筛选只使用粗粒度字段。地理区域应是真实位置，不应混入预算、备选、跳价、经典老牌等判断标签；这些判断放在表格里的价格状态或来源证据列。</div>
    </section>

    <div class="toolbar">
      <h2>酒店价格矩阵</h2>
      <div class="note" id="countText">${hotels.length} 家酒店</div>
    </div>
    <section class="panel">
      <table>
        <thead>
          <tr>
            <th class="sticky">酒店</th>
            <th>类型</th>
            <th>位置</th>
            ${nightColumns.map((night) => `<th>${escapeHtml(night)}</th>`).join('')}
            <th>合计</th>
            <th>可订均价</th>
            <th>价格状态</th>
            <th>来源证据</th>
            <th>定位</th>
            <th>优点</th>
            <th>注意</th>
            <th>链接</th>
          </tr>
        </thead>
        <tbody id="hotel-body">
          ${hotels.map((hotel) => renderHotelRow(hotel, nightColumns)).join('')}
        </tbody>
      </table>
    </section>

    <section class="combo-section">
      <div class="toolbar">
        <h2>组合方案</h2>
        <label class="note">排序
          <select id="combo-sort">
            <option value="total">按总价</option>
            <option value="avg">按均价</option>
          </select>
        </label>
      </div>
      <div id="combo-grid" class="combo-grid">
        ${combos.map(renderComboCard).join('')}
      </div>
    </section>
  </main>

  <script>
    const active = { category: new Set(), area: new Set(), evidence: new Set() };
    const chips = [...document.querySelectorAll('.chip')];
    const rows = [...document.querySelectorAll('#hotel-body tr')];
    const countText = document.getElementById('countText');
    const comboGrid = document.getElementById('combo-grid');
    const sortSelect = document.getElementById('combo-sort');

    function toggleChip(btn) {
      const key = btn.dataset.filter;
      const value = btn.dataset.value;
      const set = active[key];
      if (set.has(value)) {
        set.delete(value);
        btn.classList.remove('active');
      } else {
        set.add(value);
        btn.classList.add('active');
      }
      filterRows();
    }

    function matchSet(rowValue, selected) {
      if (!selected.size) return true;
      return selected.has(String(rowValue || ''));
    }

    function filterRows() {
      let visibleCount = 0;
      for (const row of rows) {
        const visible =
          matchSet(row.dataset.category, active.category) &&
          matchSet(row.dataset.area, active.area) &&
          matchSet(row.dataset.evidence, active.evidence);
        row.classList.toggle('hidden', !visible);
        if (visible) visibleCount += 1;
      }
      countText.textContent = visibleCount + ' 家酒店';
    }

    function sortCombos() {
      if (!comboGrid || !sortSelect) return;
      const cards = [...comboGrid.querySelectorAll('.combo-card')];
      const key = sortSelect.value;
      cards.sort((a, b) => Number(a.dataset[key]) - Number(b.dataset[key]));
      cards.forEach((card) => comboGrid.appendChild(card));
    }

    chips.forEach((btn) => btn.addEventListener('click', () => toggleChip(btn)));
    if (sortSelect) sortSelect.addEventListener('change', sortCombos);
    sortCombos();
  </script>
</body>
</html>`;
}

function main() {
  const args = parseArgs(process.argv);
  const raw = fs.readFileSync(args.input, 'utf8');
  const data = JSON.parse(raw);
  const html = renderHtml(data, args.title);
  fs.writeFileSync(args.output, html, 'utf8');
  console.log(`Wrote ${path.resolve(args.output)}`);
}

main();
