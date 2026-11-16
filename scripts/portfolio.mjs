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
  const bm = api.benchmark && api.benchmark.nav && api.benchmark.nav.length > 20 ? { label: api.benchmark.label, at: lookup(api.benchmark.nav) } : null;

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
    bm: bm ? pts.map((t) => { const a = bm.at(c0), b = bm.at(t); return a && b ? 100 * b / a : null; }) : null
  };

  const holdings = H.slice().sort((a, b) => b.w - a.w).map((h) => ({
    label: h.label, market: h.market, w: h.w, yield: h.yield,
    r1m: ret(h.navAt, back(1)), r3m: ret(h.navAt, back(3)), r1y: ret(h.navAt, back(12)), tr1y: h.hasTR ? ret(h.trAt, back(12)) : null
  }));
  return { asof, generated: api.generated, bmLabel: bm ? bm.label : null, yieldW, periods, annual, markets, holdings, chart };
}

// ── HTML ──────────────────────────────────────────────
const COLORS = ['#0c152a', '#a88a3d', '#4f7cac', '#7a9e7e', '#c0714f', '#8a6fb0', '#b7a57a', '#5b8f95', '#9a9a9a'];

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
    return `<path d="${d}" fill="${COLORS[i % COLORS.length]}" fill-rule="evenodd"/>`;
  }).join('');
  const legend = markets.map((m, i) => `<li><i style="background:${COLORS[i % COLORS.length]}"></i>${esc(m.market)}<b>${(m.w * 100).toFixed(0)}%</b></li>`).join('');
  return `<div class="alloc"><svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="市場分布">${segs}</svg><ul class="legend">${legend}</ul></div>`;
}

function lineChart(c, bmLabel) {
  const W = 720, Hh = 260, L = 44, Rr = 12, T = 14, B = 30;
  const all = [...c.tr, ...c.nav, ...(c.bm || [])].filter((v) => v != null);
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || 2; lo -= pad; hi += pad;
  const x = (i) => L + (i / (c.dates.length - 1)) * (W - L - Rr);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (Hh - T - B);
  const path = (arr) => arr.map((v, i) => (v == null ? '' : `${i && arr[i - 1] != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join('');
  const ticks = [];
  const step = (hi - lo) / 4;
  for (let k = 0; k <= 4; k++) { const v = lo + step * k; ticks.push(`<line x1="${L}" x2="${W - Rr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#e4dccb"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v.toFixed(0)}</text>`); }
  const months = [];
  c.dates.forEach((d, i) => { if (i && d.slice(5, 7) !== c.dates[i - 1].slice(5, 7) && +d.slice(5, 7) % 3 === 1) months.push(`<text x="${x(i).toFixed(1)}" y="${Hh - 8}" text-anchor="middle">${d.slice(0, 7).replace('-', '/')}</text>`); });
  const base = `<line x1="${L}" x2="${W - Rr}" y1="${y(100).toFixed(1)}" y2="${y(100).toFixed(1)}" stroke="#7a8296" stroke-dasharray="3 4"/>`;
  return `<figure class="chart"><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="近 1 年走勢，起點為 100">
<g class="ax">${ticks.join('')}${months.join('')}</g>${base}
${c.bm ? `<path d="${path(c.bm)}" fill="none" stroke="#9aa3b5" stroke-width="2"/>` : ''}
<path d="${path(c.nav)}" fill="none" stroke="#a88a3d" stroke-width="2" stroke-dasharray="6 4"/>
<path d="${path(c.tr)}" fill="none" stroke="#0c152a" stroke-width="2.6"/></svg>
<figcaption><span><i class="k1"></i>MOMO 配置・含息總報酬</span><span><i class="k2"></i>MOMO 配置・本金（只看淨值）</span>${c.bm ? `<span><i class="k3"></i>${esc(bmLabel)}</span>` : ''}<span>起點＝100</span></figcaption></figure>`;
}

function render(d) {
  const p1y = d.periods.find((p) => p.key === '1y');
  const lead = `截至 ${d.asof}，MOMO 的配置分布在 ${d.markets.length} 個市場類別、${d.holdings.length} 檔基金，加權配息率約 ${d.yieldW == null ? '—' : d.yieldW.toFixed(1) + '%'}；近 1 年含息總報酬 ${pct(p1y && p1y.tr)}、本金（只看淨值）${pct(p1y && p1y.nav)}${d.bmLabel && p1y && p1y.bm != null ? `，同期 ${esc(d.bmLabel)} ${pct(p1y.bm)}` : ''}。`;
  const rows = d.periods.map((p) => `<tr><th scope="row">${p.label}</th><td${cls(p.tr)}>${pct(p.tr)}</td><td${cls(p.nav)}>${pct(p.nav)}</td>${d.bmLabel ? `<td${cls(p.bm)}>${pct(p.bm)}</td>` : ''}</tr>`).join('');
  const a = d.annual;
  const hold = d.holdings.map((h) => `<tr><th scope="row">${esc(h.label)}<small>${esc(h.market)}</small></th><td>${(h.w * 100).toFixed(0)}%</td><td>${h.yield == null ? '—' : h.yield.toFixed(1) + '%'}</td><td${cls(h.r3m)}>${pct(h.r3m)}</td><td${cls(h.r1y)}>${pct(h.r1y)}</td><td${cls(h.tr1y)}>${pct(h.tr1y)}</td></tr>`).join('');
  return `
      <p class="answer" id="pf-lead">${lead}</p>
      <div class="kpis">
        <div><span>加權配息率</span><b>${d.yieldW == null ? '—' : d.yieldW.toFixed(1) + '%'}</b><small>依目前比例加權</small></div>
        <div><span>近 1 年含息總報酬</span><b${cls(p1y && p1y.tr)}>${pct(p1y && p1y.tr)}</b><small>淨值變化＋配息</small></div>
        <div><span>本金年化報酬</span><b${cls(a.nav)}>${pct(a.nav)}</b><small>只看淨值、配息領出｜${a.from} 起</small></div>
        ${d.bmLabel ? `<div><span>同期 ${esc(d.bmLabel)}</span><b${cls(p1y && p1y.bm)}>${pct(p1y && p1y.bm)}</b><small>近 1 年</small></div>` : ''}
      </div>

      <h2 id="alloc">佈局在哪些市場？</h2>
      ${donut(d.markets)}

      <h2 id="perf">同期表現比較</h2>
      ${lineChart(d.chart, d.bmLabel)}
      <div class="table-wrap"><table class="pf">
        <thead><tr><th>期間</th><th>含息總報酬</th><th>本金</th>${d.bmLabel ? '<th>S&amp;P 500</th>' : ''}</tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      ${d.bmLabel ? '' : '<p class="note">比較基準尚未設定，設定後會自動加入同期比較。</p>'}

      <h2 id="holdings">目前持有的基金</h2>
      <div class="table-wrap"><table class="pf hold">
        <thead><tr><th>基金（部分打碼）</th><th>比例</th><th>配息率</th><th>近 3 月</th><th>近 1 年</th><th>近 1 年含息</th></tr></thead>
        <tbody>${hold}</tbody>
      </table></div>
      <p class="note">資料日期：${d.asof}｜「近 3 月」「近 1 年」為淨值報酬，不含配息；「含息」為淨值變化加上配息。配息率為年化配息率，配息可能由本金支出。</p>`;
}

const api = await load();
const data = main(api);
await mkdir(path.join(ROOT, 'data'), { recursive: true });
await writeFile(path.join(ROOT, 'data/portfolio.json'), JSON.stringify(data, null, 1));
let html = await readFile(PAGE, 'utf8');
const re = /(<!-- SNAP:PF:START -->)[\s\S]*?(<!-- SNAP:PF:END -->)/;
if (!re.test(html)) throw new Error('找不到 SNAP:PF 標記');
html = html.replace(re, `$1${render(data)}\n      $2`).replace(/("dateModified": ")[^"]*(")/, `$1${data.asof}$2`)
  .replace('<meta name="robots" content="noindex,follow" />', '<meta name="robots" content="index,follow" />');
await writeFile(PAGE, html);
console.log(`配置策略快照：${data.asof}｜${data.holdings.length} 檔｜加權配息率 ${data.yieldW?.toFixed(2)}%`);
