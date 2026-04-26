#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.error(
    'Usage: node generate_hotel_matrix_html.mjs --input hotels.json --output report.html [--title "Da Nang Hotel Matrix"]',
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

function slug(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
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
    const nightly = hotel.nightlyPrices || {};
    for (const key of Object.keys(nightly)) keys.add(key);
  }
  return [...keys].sort();
}

function computeComboTotals(combo) {
  const nightly = Array.isArray(combo.nightlyBreakdown) ? combo.nightlyBreakdown : [];
  const total = nightly.reduce((sum, item) => sum + (toNumber(item.price) || 0), 0);
  const avg = nightly.length ? total / nightly.length : 0;
  return { total, avg };
}

function renderFilterChips(items, attr) {
  return items
    .map((item) => `<button class="chip" type="button" data-filter="${escapeHtml(attr)}" data-value="${escapeHtml(item)}">${escapeHtml(item)}</button>`)
    .join('');
}

function renderHotelRow(hotel, nightColumns) {
  const nightly = hotel.nightlyPrices || {};
  const tags = (hotel.useCases || []).join('|');
  const xhs = hotel.xiaohongshu || {};
  const pros = Array.isArray(xhs.pros) ? xhs.pros : [];
  const cons = Array.isArray(xhs.cons) ? xhs.cons : [];
  const noteLinks = Array.isArray(xhs.noteLinks) ? xhs.noteLinks : [];

  return `
    <tr
      data-region="${escapeHtml(hotel.region || '')}"
      data-strength="${escapeHtml(xhs.strength || '')}"
      data-use-cases="${escapeHtml(tags)}"
    >
      <td class="sticky hotel-cell">
        <div class="hotel-name">${escapeHtml(hotel.nameZh || '')}</div>
        <div class="hotel-sub">${escapeHtml(hotel.nameEn || '')}</div>
        ${hotel.tripUrl ? `<div class="hotel-link"><a href="${escapeHtml(hotel.tripUrl)}" target="_blank" rel="noreferrer">Trip</a></div>` : ''}
      </td>
      <td>${escapeHtml(hotel.region || '-')}</td>
      <td>${escapeHtml(hotel.locationSummary || '-')}</td>
      ${nightColumns.map((night) => `<td class="price">${formatMoney(nightly[night])}</td>`).join('')}
      <td class="price">${formatMoney(hotel.lateStayAvg)}</td>
      <td><span class="badge badge-${escapeHtml((xhs.strength || 'unknown').toLowerCase())}">${escapeHtml(xhs.strength || '-')}</span></td>
      <td>${pros.length ? `<ul>${pros.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '-'}</td>
      <td>${cons.length ? `<ul>${cons.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '-'}</td>
      <td>${hotel.useCases?.length ? `<ul>${hotel.useCases.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '-'}</td>
      <td>${noteLinks.length ? noteLinks.map((item) => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.label || '小红书')}</a>`).join('<br/>') : '-'}</td>
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
  const nightColumns = buildNightColumns(hotels);
  const regions = [...new Set(hotels.map((item) => item.region).filter(Boolean))].sort();
  const strengths = [...new Set(hotels.map((item) => item.xiaohongshu?.strength).filter(Boolean))];
  const useCases = [...new Set(hotels.flatMap((item) => item.useCases || []).filter(Boolean))];

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #f5f1e8;
      --panel: rgba(255,255,255,0.82);
      --ink: #1f1a17;
      --muted: #6f655d;
      --line: rgba(31,26,23,0.12);
      --accent: #0d7a63;
      --accent-2: #d97a37;
      --strong: #0d7a63;
      --mid: #c57a1f;
      --weak: #8d5fd3;
      --shadow: 0 18px 50px rgba(52, 39, 28, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "SF Pro Display", "PingFang SC", "Noto Sans SC", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(217,122,55,0.22), transparent 28%),
        radial-gradient(circle at top right, rgba(13,122,99,0.18), transparent 26%),
        linear-gradient(180deg, #f7f0e5 0%, #f1ede6 100%);
    }
    .page {
      max-width: 1440px;
      margin: 0 auto;
      padding: 28px 20px 60px;
    }
    .hero, .panel {
      backdrop-filter: blur(14px);
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 24px;
      box-shadow: var(--shadow);
    }
    .hero {
      padding: 28px;
      margin-bottom: 18px;
    }
    .hero h1 {
      margin: 0 0 10px;
      font-size: clamp(28px, 4vw, 44px);
      line-height: 1.02;
      letter-spacing: -0.04em;
    }
    .hero p {
      margin: 0;
      color: var(--muted);
      max-width: 900px;
      line-height: 1.7;
    }
    .layout {
      display: grid;
      grid-template-columns: 1.1fr 2fr;
      gap: 18px;
      margin-bottom: 18px;
    }
    .panel {
      padding: 22px;
    }
    h2 {
      margin: 0 0 14px;
      font-size: 22px;
      letter-spacing: -0.02em;
    }
    .filters {
      display: grid;
      gap: 14px;
    }
    .filter-group h3 {
      margin: 0 0 8px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .chip {
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.9);
      color: var(--ink);
      border-radius: 999px;
      padding: 8px 12px;
      cursor: pointer;
      font: inherit;
    }
    .chip.active {
      background: var(--ink);
      color: white;
      border-color: var(--ink);
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .meta-card {
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 16px;
      background: rgba(255,255,255,0.76);
    }
    .meta-card strong {
      display: block;
      font-size: 24px;
      margin-bottom: 4px;
    }
    .meta-card span { color: var(--muted); }
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }
    .toolbar select {
      border-radius: 12px;
      border: 1px solid var(--line);
      padding: 8px 10px;
      background: white;
      font: inherit;
    }
    .combo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
    }
    .combo-card {
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 18px;
      background: rgba(255,255,255,0.82);
    }
    .combo-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }
    .combo-card h3 {
      margin: 0 0 6px;
      font-size: 20px;
    }
    .combo-type, .combo-reason { color: var(--muted); }
    .combo-price {
      text-align: right;
      font-weight: 700;
      white-space: nowrap;
    }
    .combo-list {
      margin: 12px 0 0;
      padding-left: 18px;
      line-height: 1.65;
    }
    .table-wrap {
      overflow: auto;
      border-radius: 20px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.74);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 1320px;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      vertical-align: top;
      text-align: left;
      padding: 14px 12px;
      font-size: 14px;
    }
    th {
      position: sticky;
      top: 0;
      z-index: 3;
      background: #fbf8f2;
      white-space: nowrap;
    }
    .sticky {
      position: sticky;
      left: 0;
      z-index: 2;
      background: #fbf8f2;
    }
    .hotel-cell {
      min-width: 220px;
      box-shadow: 10px 0 18px rgba(30,20,10,0.04);
    }
    .hotel-name { font-weight: 700; margin-bottom: 4px; }
    .hotel-sub, .hotel-link a { color: var(--muted); font-size: 12px; }
    td ul { margin: 0; padding-left: 18px; line-height: 1.6; }
    td.price { font-variant-numeric: tabular-nums; font-weight: 700; white-space: nowrap; }
    .badge {
      display: inline-block;
      border-radius: 999px;
      padding: 4px 10px;
      color: white;
      font-size: 12px;
      font-weight: 700;
    }
    .badge-强, .badge-strong { background: var(--strong); }
    .badge-中, .badge-mid { background: var(--mid); }
    .badge-弱, .badge-weak { background: var(--weak); }
    .empty { color: var(--muted); }
    @media (max-width: 980px) {
      .layout { grid-template-columns: 1fr; }
      .meta-grid { grid-template-columns: 1fr; }
      .page { padding: 18px 14px 48px; }
      .hero, .panel { border-radius: 18px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(data.summary || '这份页面用于把酒店池、小红书口碑、按夜价格矩阵和入住组合放到同一页里，方便快速比较与收口。')}</p>
    </section>

    <section class="layout">
      <div class="panel">
        <h2>筛选器</h2>
        <div class="filters">
          <div class="filter-group">
            <h3>区域</h3>
            <div class="chips">${renderFilterChips(regions, 'region')}</div>
          </div>
          <div class="filter-group">
            <h3>小红书强度</h3>
            <div class="chips">${renderFilterChips(strengths, 'strength')}</div>
          </div>
          <div class="filter-group">
            <h3>用途</h3>
            <div class="chips">${renderFilterChips(useCases, 'use-case')}</div>
          </div>
        </div>
      </div>

      <div class="panel">
        <h2>概览</h2>
        <div class="meta-grid">
          <div class="meta-card">
            <strong>${hotels.length}</strong>
            <span>酒店总数</span>
          </div>
          <div class="meta-card">
            <strong>${combos.length}</strong>
            <span>组合方案</span>
          </div>
          <div class="meta-card">
            <strong>${nightColumns.length}</strong>
            <span>单晚价格列</span>
          </div>
        </div>
      </div>
    </section>

    <section class="panel" style="margin-bottom:18px;">
      <div class="toolbar">
        <h2>组合方案</h2>
        <label>排序
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

    <section class="panel">
      <h2>酒店价格矩阵</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="sticky">酒店</th>
              <th>区域</th>
              <th>位置</th>
              ${nightColumns.map((night) => `<th>${escapeHtml(night)}</th>`).join('')}
              <th>后段均价</th>
              <th>小红书强度</th>
              <th>优点</th>
              <th>缺点</th>
              <th>用途</th>
              <th>链接</th>
            </tr>
          </thead>
          <tbody id="hotel-body">
            ${hotels.map((hotel) => renderHotelRow(hotel, nightColumns)).join('')}
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <script>
    const active = { region: new Set(), strength: new Set(), 'use-case': new Set() };
    const chips = [...document.querySelectorAll('.chip')];
    const rows = [...document.querySelectorAll('#hotel-body tr')];
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
      const values = String(rowValue || '').split('|').filter(Boolean);
      return values.some((value) => selected.has(value));
    }

    function filterRows() {
      for (const row of rows) {
        const visible =
          matchSet(row.dataset.region, active.region) &&
          matchSet(row.dataset.strength, active.strength) &&
          matchSet(row.dataset.useCases, active['use-case']);
        row.style.display = visible ? '' : 'none';
      }
    }

    function sortCombos() {
      const cards = [...comboGrid.querySelectorAll('.combo-card')];
      const key = sortSelect.value;
      cards.sort((a, b) => Number(a.dataset[key]) - Number(b.dataset[key]));
      cards.forEach((card) => comboGrid.appendChild(card));
    }

    chips.forEach((btn) => btn.addEventListener('click', () => toggleChip(btn)));
    sortSelect.addEventListener('change', sortCombos);
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
