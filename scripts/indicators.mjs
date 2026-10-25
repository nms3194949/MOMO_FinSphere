// ============================================================
// MOMO財商智庫｜指標常青頁  scripts/indicators.mjs
// 由 scripts/snapshot.mjs 每天呼叫：
//   1. 從 FRED 抓每個指標近 1 年的日資料
//   2. 更新 indicators/<slug>.html 裡的 SNAP 區塊（開頭答案、數據卡、走勢圖、月度表）
//   3. 寫出 data/indicators/<slug>.json，更新 dateModified、資料期間、sitemap
// 新增指標：在 INDICATORS 加一筆設定，並建立對應的 indicators/<slug>.html（含 SNAP 標記）
// ============================================================

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

export const INDICATORS = [
  {
    slug: 'us10y',
    series: 'DGS10',
    name: '美國 10 年期公債殖利率',
    short: '美債10年殖利率',
    unit: '%',
    dp: 2,
    // 開頭答案的主詞
    lead: '美國 10 年期公債殖利率',
  },
];

// ── 小工具 ────────────────────────────────────────────────
const DAY = 864e5;
const ts = (d) => Date.parse(d + 'T00:00:00Z');
const fmtDate = (d) => d.replace(/-/g, '/');
const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const pp = (x, dp) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(dp)}`;
const dirText = (x, dp) => (x > 0 ? `上升 ${Math.abs(x).toFixed(dp)}` : x < 0 ? `下降 ${Math.abs(x).toFixed(dp)}` : '持平，變動 0');

// 找出「某日當天或之前」最近的一筆
const onOrBefore = (obs, t) => {
  for (let i = obs.length - 1; i >= 0; i--) if (ts(obs[i].date) <= t) return obs[i];
  return null;
};

async function fetchHistory(series, key) {
  const start = new Date(Date.now() - 400 * DAY).toISOString().slice(0, 10);
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${key}&file_type=json&observation_start=${start}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return (await res.json()).observations
    .filter((o) => o.value !== '.')
    .map((o) => ({ date: o.date, v: Number(o.value) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function analyse(ind, all) {
  const latest = all[all.length - 1];
  const lt = ts(latest.date);
  const year = all.filter((o) => ts(o.date) > lt - 365 * DAY);
  const m1 = onOrBefore(all, lt - 30 * DAY);
  const y1 = onOrBefore(all, lt - 365 * DAY);
  let hi = year[0], lo = year[0];
  for (const o of year) { if (o.v > hi.v) hi = o; if (o.v < lo.v) lo = o; }
  // 月底值：每個月最後一筆
  const byMonth = new Map();
  for (const o of all) byMonth.set(o.date.slice(0, 7), o);
  const months = [...byMonth.entries()].map(([m, o]) => ({ month: m, date: o.date, v: o.v }));
  const rows = months.slice(-13).map((r, i, a) => ({ ...r, chg: i ? r.v - a[i - 1].v : null })).slice(-12).reverse();
  return {
    latest, year, hi, lo, rows,
    d1m: m1 ? latest.v - m1.v : null,
    d1y: y1 ? latest.v - y1.v : null,
    from: year[0].date,
  };
}

// ── 產生各區塊 HTML ───────────────────────────────────────
function answerHtml(ind, a) {
  const { latest, d1m, d1y, hi, lo } = a;
  const u = ind.unit;
  return `      <p class="answer">截至 <time datetime="${latest.date}">${fmtDate(latest.date)}</time>，${ind.lead}為 <b>${latest.v.toFixed(ind.dp)}${u}</b>`
    + `${d1m != null ? `，較一個月前${dirText(d1m, ind.dp)} 個百分點` : ''}`
    + `${d1y != null ? `，較一年前${dirText(d1y, ind.dp)} 個百分點` : ''}。`
    + `近一年最高 ${hi.v.toFixed(ind.dp)}${u}（${fmtDate(hi.date)}）、最低 ${lo.v.toFixed(ind.dp)}${u}（${fmtDate(lo.date)}）。</p>`;
}

function statsHtml(ind, a) {
  const u = ind.unit;
  const card = (k, v, sub, cls = '') => `        <div class="stat${cls}"><div class="k">${k}</div><div class="v">${v}</div><div class="sub">${sub}</div></div>`;
  const chg = (x) => (x == null ? '—' : `${pp(x, ind.dp)}<small> 個百分點</small>`);
  const cls = (x) => (x > 0 ? ' up' : x < 0 ? ' down' : '');
  return [
    '      <div class="stats">',
    card('最新', `${a.latest.v.toFixed(ind.dp)}<small>${u}</small>`, `資料日期 ${fmtDate(a.latest.date)}`, ' main'),
    card('較一個月前', chg(a.d1m), '約 30 天', cls(a.d1m)),
    card('較一年前', chg(a.d1y), '約 365 天', cls(a.d1y)),
    card('近一年區間', `${a.lo.v.toFixed(ind.dp)}–${a.hi.v.toFixed(ind.dp)}<small>${u}</small>`, `低 ${md(a.lo.date)}・高 ${md(a.hi.date)}`),
    '      </div>',
  ].join('\n');
}

function chartSvg(ind, a) {
  const W = 960, H = 320, L = 84, R = 24, T = 24, B = 44;
  const pts = a.year;
  const t0 = ts(pts[0].date), t1 = ts(pts[pts.length - 1].date);
  let min = Math.min(...pts.map((p) => p.v)), max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  // 刻度：取 0.25 / 0.5 的倍數
  const step = span > 2 ? 0.5 : span > 0.8 ? 0.25 : 0.1;
  min = Math.floor((min - span * 0.08) / step) * step;
  max = Math.ceil((max + span * 0.08) / step) * step;
  const x = (t) => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(ts(p.date)).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const area = `${line}L${x(t1).toFixed(1)},${(H - B).toFixed(1)}L${x(t0).toFixed(1)},${(H - B).toFixed(1)}Z`;
  const grid = [];
  for (let v = min; v <= max + 1e-9; v += step) {
    grid.push(`<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="g"/>`
      + `<text x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" class="yl">${v.toFixed(step < 0.25 ? 1 : 2)}</text>`);
  }
  // X 軸：每隔一個月標示
  const xl = [];
  const d = new Date(t0); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
  let k = 0;
  while (d.getTime() <= t1) {
    if (k % 2 === 0) {
      const lab = d.getUTCMonth() === 0 ? `${d.getUTCFullYear()}/1` : `${d.getUTCMonth() + 1}月`;
      xl.push(`<text x="${x(d.getTime()).toFixed(1)}" y="${H - 14}" class="xl">${lab}</text>`);
    }
    d.setUTCMonth(d.getUTCMonth() + 1); k++;
  }
  const lx = x(t1), ly = y(a.latest.v);
  const mark = (o, cls) => `<circle cx="${x(ts(o.date)).toFixed(1)}" cy="${y(o.v).toFixed(1)}" r="3.5" class="${cls}"/>`;
  return `      <figure class="chart">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="chartTitle chartDesc" preserveAspectRatio="none">
          <title id="chartTitle">${ind.name}近一年走勢</title>
          <desc id="chartDesc">${fmtDate(a.from)} 至 ${fmtDate(a.latest.date)}，最高 ${a.hi.v.toFixed(ind.dp)}${ind.unit}（${fmtDate(a.hi.date)}），最低 ${a.lo.v.toFixed(ind.dp)}${ind.unit}（${fmtDate(a.lo.date)}），最新 ${a.latest.v.toFixed(ind.dp)}${ind.unit}。</desc>
          ${grid.join('\n          ')}
          <path d="${area}" class="a"/>
          <path d="${line}" class="l"/>
          ${mark(a.hi, 'hi')}${mark(a.lo, 'lo')}
          <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="5" class="last"/>
          ${xl.join('')}
        </svg>
        <figcaption>單位：${ind.unit}｜日資料｜${fmtDate(a.from)}–${fmtDate(a.latest.date)}｜● 最新 ${a.latest.v.toFixed(ind.dp)}${ind.unit}　▲ 最高 ${a.hi.v.toFixed(ind.dp)}　▼ 最低 ${a.lo.v.toFixed(ind.dp)}｜資料來源：FRED</figcaption>
      </figure>`;
}

function tableHtml(ind, a) {
  const rows = a.rows.map((r, i) => {
    const partial = i === 0 && r.date.slice(8) !== lastDayOfMonth(r.month);
    const label = partial ? `${r.month.replace('-', '/')}（至${md(r.date)}）` : r.month.replace('-', '/');
    const chg = r.chg == null ? '—' : pp(r.chg, ind.dp);
    const cls = r.chg > 0 ? ' class="up"' : r.chg < 0 ? ' class="down"' : '';
    return `            <tr><td>${label}</td><td>${r.v.toFixed(ind.dp)}${ind.unit}</td><td${cls}>${chg}</td></tr>`;
  }).join('\n');
  return `      <div class="table-wrap">
        <table class="mtable">
          <caption>${ind.name}：近 12 個月月底值（較上月單位：百分點）</caption>
          <thead><tr><th>月份</th><th>月底值</th><th>較上月</th></tr></thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>`;
}

function lastDayOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0');
}

// ── 主流程 ────────────────────────────────────────────────
export async function runIndicators({ file, replaceBetween, setDateModified, key }) {
  const done = [];
  for (const ind of INDICATORS) {
    const page = `indicators/${ind.slug}.html`;
    if (!existsSync(file(page))) { console.warn(`⚠ 找不到 ${page}，略過`); continue; }
    try {
      const all = await fetchHistory(ind.series, key);
      if (all.length < 200) throw new Error(`資料只有 ${all.length} 筆`);
      const a = analyse(ind, all);

      await mkdir(file('data/indicators'), { recursive: true });
      await writeFile(file(`data/indicators/${ind.slug}.json`), JSON.stringify({
        name: ind.name, series: ind.series, unit: ind.unit, source: `https://fred.stlouisfed.org/series/${ind.series}`,
        asOf: a.latest.date, latest: a.latest.v,
        change1m: a.d1m == null ? null : Number(a.d1m.toFixed(4)), change1y: a.d1y == null ? null : Number(a.d1y.toFixed(4)),
        high1y: { date: a.hi.date, value: a.hi.v }, low1y: { date: a.lo.date, value: a.lo.v },
        observations: a.year.map((o) => [o.date, o.v]),
      }) + '\n');

      let html = await readFile(file(page), 'utf8');
      html = replaceBetween(html, 'IND_ANSWER', answerHtml(ind, a));
      html = replaceBetween(html, 'IND_STATS', statsHtml(ind, a));
      html = replaceBetween(html, 'IND_CHART', chartSvg(ind, a));
      html = replaceBetween(html, 'IND_TABLE', tableHtml(ind, a));
      html = html.replace(/<time datetime="[\d-]+" id="indDate">[^<]*<\/time>/, `<time datetime="${a.latest.date}" id="indDate">${fmtDate(a.latest.date)}</time>`);
      html = html.replace(/"temporalCoverage":\s*"[^"]*"/, `"temporalCoverage": "${a.from}/${a.latest.date}"`);
      html = setDateModified(html, a.latest.date);
      await writeFile(file(page), html);

      done.push({ ind, page, date: a.latest.date, value: a.latest.v, d1m: a.d1m });
      console.log(`  ↳ 指標頁 ${ind.short}：${a.latest.v.toFixed(ind.dp)}${ind.unit}（${a.latest.date}，近一年 ${a.year.length} 筆）`);
    } catch (err) {
      console.warn(`⚠ 指標頁 ${ind.short} 更新失敗：${err.message}（保留原內容）`);
    }
  }
  return done;
}

// sitemap：沒有就新增網址，有就更新 lastmod
export function upsertSitemap(sm, url, date) {
  const re = new RegExp(`(<loc>${url.replace(/[.]/g, '\\.')}</loc><lastmod>)[\\d-]+(</lastmod>)`);
  if (re.test(sm)) return sm.replace(re, `$1${date}$2`);
  return sm.replace('</urlset>', `  <url><loc>${url}</loc><lastmod>${date}</lastmod></url>\n</urlset>`);
}
