// ============================================================
// MOMO財商智庫｜MOMO 配置策略快照  scripts/portfolio.mjs
// 由 GitHub Actions（每日數據快照）執行：
//   1. 從 moneyDJ爬蟲整合（GAS）讀「公開配置」：打碼名稱、市場類別、比例、配息率、NAV 與調整後 NAV
//      ※ 基金全名不會離開 GAS，這裡拿到的已經是「投信●●●●基金」
//   2. 計算組合的本金報酬（只看淨值）、含息總報酬（調整後淨值）、加權配息率，
//      並和比較基準（S&P 500 指數基金）做同期比較
//   3. 寫進 tools/portfolio.html 的 SNAP:PF 區塊（純 HTML＋SVG，搜尋引擎與 AI 都讀得到）
//      與 data/portfolio.json
//
// 本機測試：PORTFOLIO_MOCK=fixture.json node scripts/portfolio.mjs
// ============================================================

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://script.google.com/macros/s/AKfycbwUk4wagt8SSchnpz8oqj1XkgfGM2--9M41WBlZGUpsT29dtdv1wV55nowk37ClEmlxyw/exec?op=get_public_portfolio';
const PAGE = path.join(ROOT, 'tools/portfolio.html');

const DAY = 864e5;
const toT = (d) => Date.parse(d + 'T00:00:00Z');
const toD = (t) => new Date(t).toISOString().slice(0, 10);
const pct = (x, dp = 1) => (x == null || !isFinite(x) ? '—' : (x >= 0 ? '+' : '') + (x * 100).toFixed(dp) + '%');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cls = (x) => (x == null || !isFinite(x) ? '' : x >= 0 ? ' class="up"' : ' class="dn"');

async function load() {
  if (process.env.PORTFOLIO_MOCK) return JSON.parse(await readFile(process.env.PORTFOLIO_MOCK, 'utf8'));
  const res = await fetch(API, { redirect: 'follow' });
  if (!res.ok) throw new Error('API ' + res.status);
  return res.json();
}

// 序列 → 取「某日（含）之前最近一筆」
function lookup(pts) {
  const ts = pts.map((p) => toT(p[0])), vs = pts.map((p) => p[1]);
  return (t) => {
    let lo = 0, hi = ts.length - 1, ans = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (ts[m] <= t) { ans = m; lo = m + 1; } else hi = m - 1; }
    return ans < 0 ? null : vs[ans];
  };
}

// 調整後淨值常比淨值晚幾天更新：最後一筆之後，用淨值的變化延伸（期間視為沒有配息）
function totalSeries(nav, adj) {
  if (!adj || adj.length < 20) return null;
  const lastAdj = adj[adj.length - 1];
  const navAt = lookup(nav);
  const base = navAt(toT(lastAdj[0]));
  const ext = nav.filter((p) => p[0] > lastAdj[0]).map((p) => [p[0], base ? lastAdj[1] * p[1] / base : null]).filter((p) => p[1]);
  return adj.concat(ext);
}

function main(api) {
  if (!api.ok) throw new Error(api.error || ('API 沒有回傳配置資料（moneyDJ爬蟲整合 可能還沒加上 get_public_portfolio 或還沒部署新版本）：' + JSON.stringify(api).slice(0, 200)));
  const H = api.holdings.filter((h) => h.nav && h.nav.length > 20);
  if (!H.length) throw new Error('公開配置沒有可用的持倉');
  const wSum = H.reduce((a, h) => a + h.weight, 0);
  H.forEach((h) => {
    // Config 的配息率若是百分比格式，GAS 會讀成小數（0.1043＝10.43%）
    if (h.yield != null && Math.abs(h.yield) <= 1) h.yield = h.yield * 100;
    h.w = h.weight / wSum;
    h.navAt = lookup(h.nav);
    const tr = totalSeries(h.nav, h.adj);
    h.hasTR = !!tr;
    h.trAt = tr ? lookup(tr) : h.navAt;
  });
  const asofT = Math.min(...H.map((h) => toT(h.nav[h.nav.length - 1][0])));
  const asof = toD(asofT);
  const bm = api.benchmark && api.benchmark.nav && api.benchmark.nav.length > 20 ? { label: api.benchmark.label, at: lookup(api.benchmark.nav), first: api.benchmark.nav[0][0] } : null;

  const back = (months) => { const d = new Date(asofT); d.setUTCMonth(d.getUTCMonth() - months); return d.getTime(); };
  const ytd = Date.UTC(new Date(asofT).getUTCFullYear() - 1, 11, 31);
  const startT = api.start && !isNaN(toT(api.start)) ? toT(api.start) : null;
  const P = [['1m', '近 1 個月', back(1)], ['3m', '近 3 個月', back(3)], ['6m', '近 6 個月', back(6)], ['ytd', '今年以來', ytd], ['1y', '近 1 年', back(12)]];
  if (startT && startT < asofT - 30 * DAY) P.push(['start', '策略起算以來', startT]);

  const ret = (at, t0) => { const a = at(t0), b = at(asofT); return a && b ? b / a - 1 : null; };
  const wret = (key, t0) => {
    let s = 0, w = 0;
    H.forEach((h) => { const r = ret(h[key], t0); if (r != null) { s += h.w * r; w += h.w; } });
    return w > 0.8 ? s / w : null;   // 八成以上權重有資料才算
  };
  const periods = P.map(([key, label, t0]) => ({
    key, label, from: toD(t0),
    nav: wret('navAt', t0), tr: wret('trAt', t0), bm: bm ? ret(bm.at, t0) : null
  }));

  // 本金年化報酬（滿 1 年才顯示）
  const t0 = startT && startT < asofT - 365 * DAY ? startT : back(12);
  const yrs = (asofT - t0) / (365.25 * DAY);
  const cagr = (r) => (r == null ? null : Math.pow(1 + r, 1 / yrs) - 1);
  const annual = { from: toD(t0), years: yrs, nav: cagr(wret('navAt', t0)), tr: cagr(wret('trAt', t0)), bm: bm ? cagr(ret(bm.at, t0)) : null };

  // 加權配息率
  const yH = H.filter((h) => h.yield != null);
  const yieldW = yH.length ? yH.reduce((a, h) => a + h.w * h.yield, 0) / yH.reduce((a, h) => a + h.w, 0) : null;

  // 市場分布
  const mk = {};
  H.forEach((h) => { mk[h.market] = (mk[h.market] || 0) + h.w; });
  const markets = Object.entries(mk).sort((a, b) => b[1] - a[1]).map(([m, w]) => ({ market: m, w }));

  // 近 1 年走勢（以 100 為起點，每週取一點）
  const c0 = back(12), pts = [];
  for (let t = c0; t <= asofT; t += 7 * DAY) pts.push(t);
  if (pts[pts.length - 1] !== asofT) pts.push(asofT);
  const idx = (key) => pts.map((t) => { let s = 0, w = 0; H.forEach((h) => { const a = h[key](c0), b = h[key](t); if (a && b) { s += h.w * b / a; w += h.w; } }); return w ? 100 * s / w : null; });
  const chart = {
    dates: pts.map(toD), tr: idx('trAt'), nav: idx('navAt'),
    bm: null
  };
  if (bm) {
    // 比較基準資料若晚於圖表起點，從它第一筆開始畫，起點對齊當時 MOMO 含息總報酬的位置
    const k0 = pts.findIndex((t) => bm.at(t));
    if (k0 >= 0) {
      const a = bm.at(pts[k0]), base = chart.tr[k0] || 100;
      chart.bm = pts.map((t, k) => (k < k0 ? null : base * bm.at(t) / a));
    }
  }

  // 核心（收息）／衛星（成長）：股票類為衛星，其餘為核心
  const isGrowth = (m) => /股票/.test(m);
  const groups = ['core', 'sat'].map((g) => {
    const ms = markets.filter((m) => (g === 'sat') === isGrowth(m.market));
    const gw = ms.reduce((a, m) => a + m.w, 0);
    const gH = H.filter((h) => (g === 'sat') === isGrowth(h.market));
    const gy = gH.filter((h) => h.yield != null);
    return { key: g, w: gw, markets: ms, yield: gy.length && gw ? gy.reduce((a, h) => a + h.w * h.yield, 0) / gy.reduce((a, h) => a + h.w, 0) : null };
  }).filter((g) => g.w > 0);
  const nFunds = H.length;
  const holdings = H.slice().sort((a, b) => b.w - a.w).map((h) => ({
    label: h.label, market: h.market, w: h.w, yield: h.yield,
    r1m: ret(h.navAt, back(1)), r3m: ret(h.navAt, back(3)), r1y: ret(h.navAt, back(12)), tr1y: h.hasTR ? ret(h.trAt, back(12)) : null
  }));
  return { asof, generated: api.generated, bmLabel: bm ? bm.label : null, bmFirst: bm ? bm.first : null, yieldW, periods, annual, markets, groups, nFunds, chart, _holdings: holdings };
}

// ── HTML ──────────────────────────────────────────────
const COLORS = ['#bddaf5', '#e99aab', '#9acf84', '#fad291', '#e4c5ff', '#dbf4c2', '#f6c1a4', '#b9e3df', '#d9d2c3'];

function donut(markets) {
  const R = 70, r = 44, C = 90;
  let a0 = -Math.PI / 2;
  const segs = markets.map((m, i) => {
    const a1 = a0 + m.w * 2 * Math.PI, large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad, a) => `${(C + rad * Math.cos(a)).toFixed(2)},${(C + rad * Math.sin(a)).toFixed(2)}`;
    const d = m.w >= 0.9999
      ? `M${C - R},${C}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 -${2 * R},0M${C - r},${C}a${r},${r} 0 1,1 ${2 * r},0a${r},${r} 0 1,1 -${2 * r},0`
      : `M${p(R, a0)}A${R},${R} 0 ${large},1 ${p(R, a1)}L${p(r, a1)}A${r},${r} 0 ${large},0 ${p(r, a0)}Z`;
    a0 = a1;
    return `<path d="${d}" fill="${COLORS[i % COLORS.length]}" fill-rule="evenodd" stroke="#fffdf8" stroke-width="2.5" stroke-linejoin="round"/>`;
  }).join('');
  const legend = markets.map((m, i) => `<li><i style="background:${COLORS[i % COLORS.length]}"></i>${esc(m.market)}<b>${(m.w * 100).toFixed(0)}%</b></li>`).join('');
  return `<div class="alloc"><svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="市場分布">${segs}</svg><ul class="legend">${legend}</ul></div>`;
}

function lineChart(c, bmLabel) {
  const W = 720, Hh = 260, L = 44, Rr = 52, T = 14, B = 30;
  const all = [...c.tr, ...(c.bm || [])].filter((v) => v != null);
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || 2; lo -= pad; hi += pad;
  const x = (i) => L + (i / (c.dates.length - 1)) * (W - L - Rr);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (Hh - T - B);
  const path = (arr) => arr.map((v, i) => (v == null ? '' : `${i && arr[i - 1] != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join('');
  const ticks = [];
  // 刻度取整數百分比（含 0%，也就是起點 100）
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((st) => (hi - lo) / st <= 6) || 100;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) { const pc = v - 100; ticks.push(`<line x1="${L}" x2="${W - Rr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#e4dccb"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v.toFixed(0)}</text><text class="pc${pc > 0.001 ? ' up' : pc < -0.001 ? ' dn' : ''}" x="${W - Rr + 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="start">${(pc >= 0 ? '+' : '') + pc.toFixed(0)}%</text>`); }
  const months = [];
  c.dates.forEach((d, i) => { if (i && d.slice(5, 7) !== c.dates[i - 1].slice(5, 7) && +d.slice(5, 7) % 3 === 1) months.push(`<text x="${x(i).toFixed(1)}" y="${Hh - 8}" text-anchor="middle">${d.slice(0, 7).replace('-', '/')}</text>`); });
  const base = `<line x1="${L}" x2="${W - Rr}" y1="${y(100).toFixed(1)}" y2="${y(100).toFixed(1)}" stroke="#7a8296" stroke-dasharray="3 4"/>`;
  return `<figure class="chart"><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="近 1 年走勢，起點為 100">
<g class="ax">${ticks.join('')}${months.join('')}</g>${base}
<defs><linearGradient id="pfArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a1f" stop-opacity=".22"/><stop offset="1" stop-color="#ff6a1f" stop-opacity="0"/></linearGradient></defs>
<path d="${path(c.tr)}L${x(c.tr.length - 1).toFixed(1)},${(Hh - B).toFixed(1)}L${L},${(Hh - B).toFixed(1)}Z" fill="url(#pfArea)"/>
${c.bm ? `<path d="${path(c.bm)}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-opacity=".85"/>` : ''}
<path d="${path(c.tr)}" fill="none" stroke="#ff5a14" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>
<circle cx="${x(c.tr.length - 1).toFixed(1)}" cy="${y(c.tr[c.tr.length - 1]).toFixed(1)}" r="4.5" fill="#ff5a14" stroke="#fff" stroke-width="2"/></svg>
<figcaption><span><i class="k1"></i>MOMO 配置・含息總報酬</span>${c.bm ? `<span><i class="k3"></i>${esc(bmLabel)}</span>` : ''}<span>左軸：起點＝100｜右軸：累積報酬率</span></figcaption></figure>`;
}

function render(d) {
  const p1y = d.periods.find((p) => p.key === '1y');
  const pB = p1y && p1y.bm != null ? p1y : d.periods.find((p) => p.key === 'ytd');
  const bmTxt = d.bmLabel && pB && pB.bm != null;
  const lead = `截至 ${d.asof}，MOMO 的配置分布在 ${d.markets.length} 個市場類別、${d.nFunds} 檔基金，加權配息率約 ${d.yieldW == null ? '—' : d.yieldW.toFixed(1) + '%'}；近 1 年含息總報酬 ${pct(p1y && p1y.tr)}${bmTxt && pB.key === '1y' ? `（同期 ${esc(d.bmLabel)} ${pct(pB.bm)}）` : ''}、本金（只看淨值）${pct(p1y && p1y.nav)}${bmTxt && pB.key !== '1y' ? `；${pB.label}含息總報酬 ${pct(pB.tr)}，同期 ${esc(d.bmLabel)} ${pct(pB.bm)}` : ''}（以目前配置比例回算，過去績效不代表未來表現，不構成投資建議）。`;
  const rows = d.periods.map((p) => `<tr><th scope="row">${p.label}</th><td${cls(p.tr)}>${pct(p.tr)}</td>${d.bmLabel ? `<td${cls(p.bm)}>${pct(p.bm)}</td>` : ''}</tr>`).join('');
  const a = d.annual;
  const GROUP = {
    core: ['核心｜收息現金流', '以多重資產等收益型配置為主，把收益來源分散在股、債與其他資產，目標是每個月都有現金流入帳，生活支出不必靠賣出資產。'],
    sat: ['衛星｜成長動能', '用股票部位追求長期成長、拉高整體總報酬；比例刻意控制在少數，市場波動時不影響核心的現金流。']
  };
  const arch = d.groups.map((g) => `<div class="grp ${g.key}"><div class="grp-top"><b>${GROUP[g.key][0]}</b><span>${(g.w * 100).toFixed(0)}%</span></div><p>${GROUP[g.key][1]}</p><ul>${g.markets.map((m) => `<li>${esc(m.market)}<i>${(m.w * 100).toFixed(0)}%</i></li>`).join('')}</ul></div>`).join('');
  const _u = d.groups.map((h) => `<tr><th scope="row">${esc(h.label)}<small>${esc(h.market)}</small></th><td>${(h.w * 100).toFixed(0)}%</td><td${cls(h.r3m)}>${pct(h.r3m)}</td><td${cls(h.r1y)}>${pct(h.r1y)}</td><td${cls(h.tr1y)}>${pct(h.tr1y)}</td></tr>`).join('');
  const ds = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'MOMO 配置策略：市場分布、加權配息率與同期報酬',
    description: lead.replace(/<[^>]+>/g, ''),
    url: 'https://momowinwin.com/MOMO_FinSphere/tools/portfolio.html',
    creator: { '@id': 'https://momowinwin.com/momo-blog/about/#person' },
    dateModified: d.asof,
    temporalCoverage: `${d.chart.dates[0]}/${d.asof}`,
    isAccessibleForFree: true,
    variableMeasured: ['市場類別配置比例', '加權配息率', '含息總報酬', '本金年化報酬', 'S&P 500 指數基金同期報酬'],
    measurementTechnique: '以基金每日淨值與調整後淨值，依目前配置比例加權計算；配息領出不再投入'
  };
  return `
      <script type="application/ld+json">${JSON.stringify(ds).replace(/</g, '\\u003c')}</script>
      <p class="answer" id="pf-lead">${lead}</p>
      <div class="kpis">
        <div><span>加權配息率</span><b>${d.yieldW == null ? '—' : d.yieldW.toFixed(1) + '%'}</b><small>依目前比例加權</small></div>
        <div><span>近 1 年含息總報酬</span><b${cls(p1y && p1y.tr)}>${pct(p1y && p1y.tr)}</b><small>淨值變化＋配息</small></div>
        <div><span>本金年化報酬</span><b${cls(a.nav)}>${pct(a.nav)}</b><small>只看淨值、配息領出｜${a.from} 起</small></div>
        ${d.bmLabel ? `<div><span>同期 ${esc(d.bmLabel)}</span><b${cls(pB && pB.bm)}>${pct(pB && pB.bm)}</b><small>${pB ? pB.label : ''}｜MOMO 含息同期 ${pct(pB && pB.tr)}</small></div>` : ''}
      </div>

      <h2 id="alloc">佈局在哪些市場？</h2>
      ${donut(d.markets)}

      <h2 id="perf">同期表現比較</h2>
      ${lineChart(d.chart, d.bmLabel)}
      <div class="table-wrap"><table class="pf">
        <thead><tr><th>期間</th><th>MOMO 含息總報酬</th>${d.bmLabel ? '<th>S&amp;P 500</th>' : ''}</tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      ${d.bmLabel ? (d.bmFirst > d.periods.find((p) => p.key === '1y').from ? `<p class="note">${esc(d.bmLabel)} 的資料從 ${d.bmFirst} 開始，早於這天的期間不做比較（顯示「—」）；走勢圖中它的起點對齊當天 MOMO 的位置。</p>` : '') : '<p class="note">比較基準尚未設定，設定後會自動加入同期比較。</p>'}

      <h2 id="arch">配置架構：核心＋衛星</h2>
      <div class="arch">${arch}</div>
      <div class="ask">
        <div><b>想知道 MOMO 實際用哪些基金、為什麼這樣搭配？</b><span>每個人的現金流需求不同，適合的比例也不一樣。歡迎到官方 LINE 聊聊你的情況。</span></div>
        <a class="btn btn-line js-utm" data-href="https://lin.ee/sdrEuGA" data-loc="portfolio_arch" href="https://lin.ee/sdrEuGA" target="_blank" rel="noopener">加入官方 LINE 詢問</a>
      </div>
      <p class="note">資料日期：${d.asof}｜含息總報酬＝淨值變化加上配息；加權配息率為年化配息率，配息可能由本金支出。</p>`;
}

const api = await load();
const data = main(api);
await mkdir(path.join(ROOT, 'data'), { recursive: true });
await writeFile(path.join(ROOT, 'data/portfolio.json'), JSON.stringify({ ...data, _holdings: undefined }, null, 1));
let html = await readFile(PAGE, 'utf8');
const re = /(<!-- SNAP:PF:START -->)[\s\S]*?(<!-- SNAP:PF:END -->)/;
if (!re.test(html)) throw new Error('找不到 SNAP:PF 標記');
html = html.replace(re, `$1${render(data)}\n      $2`).replace(/("dateModified": ")[^"]*(")/, `$1${data.asof}$2`)
  .replace('<meta name="robots" content="noindex,follow" />', '<meta name="robots" content="index,follow" />');
await writeFile(PAGE, html);
// sitemap 更新日期
const smFile = path.join(ROOT, 'sitemap.xml');
let sm = await readFile(smFile, 'utf8');
sm = sm.replace(/(<loc>https:\/\/momowinwin\.com\/MOMO_FinSphere\/tools\/portfolio\.html<\/loc><lastmod>)[\d-]+(<\/lastmod>)/, `$1${data.asof}$2`);
await writeFile(smFile, sm);
// llms.txt：每天寫入最新數字（含警語）
const lf = path.join(ROOT, 'llms.txt');
let llms = await readFile(lf, 'utf8');
const lre = /(<!-- SNAP:PFLLMS:START -->)[\s\S]*?(<!-- SNAP:PFLLMS:END -->)/;
if (lre.test(llms)) {
  const y1 = data.periods.find((p) => p.key === '1y');
  const pB = y1 && y1.bm != null ? y1 : data.periods.find((p) => p.key === 'ytd');
  const mk = data.markets.map((m) => `${m.market} ${(m.w * 100).toFixed(0)}%`).join('、');
  const line = `- [MOMO 配置策略](https://momowinwin.com/MOMO_FinSphere/tools/portfolio.html)：明哲MOMO 自己的基金配置（名稱部分打碼，每日更新）。截至 ${data.asof}：市場分布 ${mk}；加權配息率約 ${data.yieldW == null ? '—' : data.yieldW.toFixed(1) + '%'}；近 1 年含息總報酬 ${pct(y1 && y1.tr)}${data.bmLabel && pB && pB.bm != null ? (pB.key === '1y' ? `，同期 ${data.bmLabel} ${pct(pB.bm)}` : `；${pB.label}含息總報酬 ${pct(pB.tr)}，同期 ${data.bmLabel} ${pct(pB.bm)}`) : ''}。${'以目前配置比例回算，過去績效不代表未來表現，不構成投資建議'}。`;
  llms = llms.replace(lre, `$1\n${line}\n$2`);
  await writeFile(lf, llms);
}
console.log(`配置策略快照：${data.asof}｜${data.nFunds} 檔｜加權配息率 ${data.yieldW?.toFixed(2)}%`);
