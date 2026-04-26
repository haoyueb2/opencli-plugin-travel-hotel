import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, CliError } from '@jackwener/opencli/errors';
import { randomUUID } from 'node:crypto';

const HOME_URL = 'https://www.trip.com/hotels/?locale=en-US';

function ensurePage(page) {
  if (!page) throw new CliError('BROWSER_REQUIRED', 'trip hotel-night-price requires a browser session');
  return page;
}

function normalizeDate(value, argName) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ArgumentError(`${argName} must be in YYYY-MM-DD format`);
  }
  return raw;
}

function toTripQueryDate(value) {
  return value.replace(/-/g, '/');
}

function toTripDisplayDate(value) {
  const dt = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

function buildBootstrapUrl(currency) {
  const url = new URL(HOME_URL);
  url.searchParams.set('curr', currency);
  return url.toString();
}

function buildListUrl(baseUrl, { checkIn, checkOut, adults, children, currency }) {
  const url = new URL(baseUrl);
  url.searchParams.set('checkin', toTripQueryDate(checkIn));
  url.searchParams.set('checkout', toTripQueryDate(checkOut));
  url.searchParams.set('adult', String(adults));
  url.searchParams.set('children', String(children));
  url.searchParams.set('curr', currency);
  url.searchParams.set('barCurr', currency);
  return url.toString();
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\u1e00-\u1eff\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreHotelResult(result, hotel, cityHint) {
  const hotelNeedle = normalizeText(hotel);
  const cityNeedle = normalizeText(cityHint);
  const resultWord = normalizeText(result?.resultWord);
  const content = normalizeText(result?.content);
  let score = 0;
  if ((result?.resultType || '') === 'H') score += 200;
  if (resultWord === hotelNeedle) score += 1000;
  if (resultWord.includes(hotelNeedle) || hotelNeedle.includes(resultWord)) score += 400;
  const hotelTokens = hotelNeedle.split(' ').filter(Boolean);
  score += hotelTokens.filter((token) => resultWord.includes(token)).length * 25;
  if (cityNeedle && content.includes(cityNeedle)) score += 100;
  return score;
}

function buildKeywordRequest(hotel, currency) {
  const clientId = `${Date.now()}.${Math.random().toString(36).slice(2, 12)}`;
  const pid = randomUUID();
  const traceLogID = randomUUID().replace(/-/g, '').slice(0, 14);
  return {
    code: 0,
    codeType: '',
    keyWord: hotel,
    searchType: 'D',
    scenicCode: 0,
    cityCodeOfUser: 0,
    searchConditions: [
      { type: 'D_PROVINCE', value: 'T' },
      { type: 'SupportNormalSearch', value: 'T' },
      { type: 'DisplayTagIcon', value: 'F' },
    ],
    head: {
      platform: 'PC',
      clientId,
      bu: 'ibu',
      group: 'TRIP',
      aid: '2175',
      sid: '957196',
      ouid: '',
      caid: '2175',
      csid: '957196',
      couid: '',
      region: 'US',
      locale: 'en-US',
      timeZone: '8',
      currency,
      p: '76224787609',
      pageID: '10320668150',
      deviceID: 'PC',
      clientVersion: '0',
      frontend: {
        vid: clientId,
        sessionID: '1',
        pvid: '1',
      },
      extension: [
        { name: 'cityId', value: '' },
        { name: 'checkIn', value: '' },
        { name: 'checkOut', value: '' },
        { name: 'region', value: 'US' },
      ],
      tripSub1: '',
      qid: '',
      pid,
      hotelExtension: {},
      cid: clientId,
      traceLogID,
      ticket: '',
      href: buildBootstrapUrl(currency),
    },
  };
}

function buildKeywordEndpoint() {
  const clientId = `${Date.now()}.${Math.random().toString(36).slice(2, 12)}`;
  const trace = Buffer.from(randomUUID()).toString('base64url');
  return `https://www.trip.com/htls/getKeyWordSearch?htl_customtraceid=${trace}&x-traceID=${clientId}-${Date.now()}-${Math.floor(Math.random() * 1e10)}`;
}

async function fetchKeywordResults(hotel, currency) {
  const response = await fetch(buildKeywordEndpoint(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      accept: 'application/json, text/plain, */*',
      origin: 'https://www.trip.com',
      referer: buildBootstrapUrl(currency),
      'user-agent': 'Mozilla/5.0',
    },
    body: JSON.stringify(buildKeywordRequest(hotel, currency)),
  });
  if (!response.ok) {
    throw new CliError('KEYWORD_HTTP_FAILED', `Trip keyword search failed with HTTP ${response.status}`);
  }
  const json = await response.json();
  return Array.isArray(json?.keyWordSearchResults) ? json.keyWordSearchResults : [];
}

function pickBestKeywordResult(results, hotel, cityHint) {
  const ranked = results
    .map((result) => ({ result, score: scoreHotelResult(result, hotel, cityHint) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) {
    throw new CliError('NO_SUGGESTION', 'Trip keyword search did not return a matching hotel');
  }
  return ranked[0].result;
}

function buildSearchCoordinate(result) {
  const infos = Array.isArray(result?.coordinateInfos) ? result.coordinateInfos : [];
  const byType = new Map(infos.map((info) => [String(info.coordinateType || '').toUpperCase(), info]));
  const ordered = ['BAIDU', 'GAODE', 'GOOGLE', 'NORMAL'];
  return ordered.map((type) => {
    const info = byType.get(type) || {};
    const lat = Number.isFinite(Number(info.latitude)) ? Number(info.latitude) : -1;
    const lon = Number.isFinite(Number(info.longitude)) ? Number(info.longitude) : -1;
    const accuracy = Number.isFinite(Number(info.accuracy)) ? Number(info.accuracy) : 0;
    return `${type}_${lat}_${lon}_${accuracy}`;
  }).join('|');
}

function pickPrimaryLatLon(result) {
  const infos = Array.isArray(result?.coordinateInfos) ? result.coordinateInfos : [];
  const preferred = infos.find((info) => String(info.coordinateType || '').toUpperCase() === 'NORMAL')
    || infos.find((info) => String(info.coordinateType || '').toUpperCase() === 'GOOGLE')
    || infos[0]
    || {};
  return {
    lat: Number.isFinite(Number(preferred.latitude)) ? Number(preferred.latitude) : -1,
    lon: Number.isFinite(Number(preferred.longitude)) ? Number(preferred.longitude) : -1,
  };
}

function buildSearchValue(result) {
  const filterID = String(result?.item?.data?.filterID || '');
  const type = String(result?.item?.data?.type || '');
  const value = String(result?.item?.data?.value || result?.code || '');
  const subType = String(result?.item?.data?.subType || '1');
  if (!filterID || !type || !value) {
    throw new CliError('SEARCH_VALUE_MISSING', 'Trip keyword result did not include filter metadata');
  }
  return `${filterID}*${type}*${value}*${subType}`;
}

function buildInitialListUrl(result, { checkIn, checkOut, adults, children, currency }) {
  const url = new URL('https://www.trip.com/hotels/list');
  const cityId = String(result?.city?.geoCode || '');
  const cityName = String(result?.city?.enusName || result?.city?.currentLocaleName || '');
  const provinceId = String(result?.province?.geoCode || 0);
  const countryId = String(result?.country?.geoCode || 0);
  const { lat, lon } = pickPrimaryLatLon(result);
  url.searchParams.set('city', cityId);
  url.searchParams.set('cityName', cityName);
  url.searchParams.set('provinceId', provinceId);
  url.searchParams.set('countryId', countryId);
  url.searchParams.set('districtId', '0');
  url.searchParams.set('checkin', toTripQueryDate(checkIn));
  url.searchParams.set('checkout', toTripQueryDate(checkOut));
  url.searchParams.set('lowPrice', '0');
  url.searchParams.set('highPrice', '-1');
  url.searchParams.set('barCurr', currency);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('searchType', 'H');
  url.searchParams.set('searchWord', String(result?.resultWord || ''));
  url.searchParams.set('searchValue', buildSearchValue(result));
  url.searchParams.set('searchCoordinate', buildSearchCoordinate(result));
  url.searchParams.set('crn', '1');
  url.searchParams.set('adult', String(adults));
  url.searchParams.set('children', String(children));
  url.searchParams.set('searchBoxArg', 't');
  url.searchParams.set('travelPurpose', '0');
  url.searchParams.set('ctm_ref', 'ix_sb_dl');
  url.searchParams.set('domestic', 'false');
  url.searchParams.set('locale', 'en-US');
  url.searchParams.set('curr', currency);
  return url.toString();
}

function buildWaitForListScript(checkInLabel, checkOutLabel) {
  return `
    (async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        const inVal = document.querySelector('#checkInInput')?.value || '';
        const outVal = document.querySelector('#checkOutInput')?.value || '';
        const hasCards = document.querySelectorAll('div.hotel-card').length > 0;
        if (inVal === ${JSON.stringify(checkInLabel)} && outVal === ${JSON.stringify(checkOutLabel)} && hasCards) {
          return { ok: true, inVal, outVal, count: document.querySelectorAll('div.hotel-card').length };
        }
        await sleep(250);
      }
      return {
        ok: false,
        inVal: document.querySelector('#checkInInput')?.value || '',
        outVal: document.querySelector('#checkOutInput')?.value || '',
        count: document.querySelectorAll('div.hotel-card').length,
      };
    })()
  `;
}

function buildExtractScript(hotel, cityHint, checkIn, checkOut, currency) {
  return `
    (() => {
      const normalize = (value) => String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\\u00c0-\\u024f\\u1e00-\\u1eff\\u4e00-\\u9fff]+/g, ' ')
        .replace(/\\s+/g, ' ')
        .trim();
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const extractMoney = (value) => {
        const match = clean(value).match(/CNY\\s*([0-9,]+)/i);
        return match ? match[1].replace(/,/g, '') : '';
      };

      const hotelNeedle = normalize(${JSON.stringify(hotel)});
      const cityNeedle = normalize(${JSON.stringify(cityHint)});
      const cards = [...document.querySelectorAll('div.hotel-card')];

      const scored = cards.map((card) => {
        const name = clean(card.querySelector('a.hotelName')?.textContent || '');
        const text = clean(card.innerText || '');
        const normName = normalize(name);
        let score = 0;
        if (normName === hotelNeedle) score += 1000;
        if (normName.includes(hotelNeedle) || hotelNeedle.includes(normName)) score += 400;
        const hotelTokens = hotelNeedle.split(' ').filter(Boolean);
        score += hotelTokens.filter((token) => normName.includes(token)).length * 25;
        if (cityNeedle && normalize(text).includes(cityNeedle)) score += 40;
        return { card, name, text, score };
      }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);

      if (!scored.length) {
        return { ok: false, code: 'HOTEL_NOT_FOUND', error: 'Target hotel card not found on Trip results page' };
      }

      const best = scored[0];
      const card = best.card;
      const detailUrl = new URL(card.querySelector('a.hotelName')?.getAttribute('href') || '', location.origin).toString();
      const roomType = clean(card.querySelector('.room-name')?.textContent || card.querySelector('.room-left-info')?.textContent || '');
      const originalPrice = clean(card.querySelector('.price-line .delete')?.textContent || '');
      const currentPrice = clean(card.querySelector('.price-line .sale')?.textContent || '');
      const totalText = clean(card.querySelector('.price-explain')?.textContent || '');
      const soldOut = /No rooms available for your selected dates/i.test(best.text);
      const breakfast = /Breakfast included/i.test(best.text);
      const freeCancel = /Free Cancellation/i.test(best.text);
      const payLater = /Book now, pay later/i.test(best.text);
      const note = soldOut
        ? clean((best.text.match(/No rooms available for your selected dates\\.?(.+)/i) || [,''])[1])
        : '';

      return {
        ok: true,
        hotel: ${JSON.stringify(hotel)},
        matchedHotel: best.name,
        city: ${JSON.stringify(cityHint || '')},
        checkIn: ${JSON.stringify(checkIn)},
        checkOut: ${JSON.stringify(checkOut)},
        roomType,
        price: currentPrice || extractMoney(totalText),
        originalPrice,
        totalPrice: extractMoney(totalText),
        currency: ${JSON.stringify(currency)},
        breakfast: breakfast ? 'yes' : 'no',
        freeCancel: freeCancel ? 'yes' : 'no',
        payLater: payLater ? 'yes' : 'no',
        availability: soldOut ? 'sold_out' : 'available',
        note,
        detailUrl,
      };
    })()
  `;
}

cli({
  site: 'trip',
  name: 'hotel-night-price',
  description: '搜索 Trip 单晚酒店价格（按酒店名 + 城市 + 入住日期）',
  domain: 'www.trip.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'hotel', positional: true, required: true, help: 'Hotel name to search on Trip' },
    { name: 'check-in', required: true, help: 'Check-in date in YYYY-MM-DD' },
    { name: 'check-out', required: true, help: 'Check-out date in YYYY-MM-DD' },
    { name: 'city', default: '', help: 'Optional city hint, e.g. Da Nang' },
    { name: 'adults', type: 'int', default: 2, help: 'Adults count' },
    { name: 'children', type: 'int', default: 0, help: 'Children count' },
    { name: 'currency', default: 'CNY', help: 'Currency code shown on Trip.com' },
  ],
  columns: [
    'hotel',
    'matchedHotel',
    'city',
    'checkIn',
    'checkOut',
    'roomType',
    'price',
    'originalPrice',
    'totalPrice',
    'currency',
    'breakfast',
    'freeCancel',
    'payLater',
    'availability',
    'note',
    'detailUrl',
  ],
  func: async (page, kwargs) => {
    const browserPage = ensurePage(page);
    const hotel = String(kwargs.hotel || '').trim();
    if (!hotel) throw new ArgumentError('hotel cannot be empty');

    const checkIn = normalizeDate(kwargs['check-in'], 'check-in');
    const checkOut = normalizeDate(kwargs['check-out'], 'check-out');
    if (checkIn >= checkOut) {
      throw new ArgumentError('check-out must be after check-in');
    }

    const city = String(kwargs.city || '').trim();
    const adults = Math.max(1, Number(kwargs.adults) || 2);
    const children = Math.max(0, Number(kwargs.children) || 0);
    const currency = String(kwargs.currency || 'CNY').trim().toUpperCase() || 'CNY';

    const keywordResults = await fetchKeywordResults(hotel, currency);
    const picked = pickBestKeywordResult(keywordResults, hotel, city);
    const checkInLabel = toTripDisplayDate(checkIn);
    const checkOutLabel = toTripDisplayDate(checkOut);
    const finalUrl = buildInitialListUrl(picked, { checkIn, checkOut, adults, children, currency });
    await browserPage.goto(finalUrl, { waitUntil: 'load', settleMs: 3000 });

    const ready = await browserPage.evaluate(buildWaitForListScript(checkInLabel, checkOutLabel));
    if (!ready?.ok) {
      throw new CliError(
        'LIST_NOT_READY',
        `Trip result page did not stabilize for ${checkInLabel} -> ${checkOutLabel}`,
      );
    }

    const extracted = await browserPage.evaluate(buildExtractScript(hotel, city, checkIn, checkOut, currency));
    if (!extracted?.ok) {
      throw new CliError(extracted?.code || 'EXTRACT_FAILED', extracted?.error || 'Failed to extract hotel price');
    }

    return [extracted];
  },
});
