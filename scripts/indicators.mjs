// ============================================================
// MOMO財商智庫｜指標常青頁  scripts/indicators.mjs
// 由 scripts/snapshot.mjs 每天呼叫：
//   1. 從 FRED 抓每個指標需要的數列（近 1 年；CPI 多抓一年用來算年增率）
//   2. 更新 indicators/<slug>.html 裡的 SNAP 區塊（開頭答案、數據卡、走勢圖、月度表）
//   3. 寫出 data/indicators/<slug>.json，更新 dateModified、資料期間、sitemap
// 新增指標：在 INDICATORS 加一筆設定，並建立對應的 indicators/<slug>.html（含 SNAP 標記）
// ============================================================

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// ── 小工具 ────────────────────────────────────────────────
const DAY = 864e5;
const ts = (d) => Date.parse(d + 'T00:00:00Z');
const fmtDate = (d) => d.replace(/-/g, '/');
const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const ym = (d) => `${d.slice(0, 4)} 年 ${Number(d.slice(5, 7))} 月`;
const pp = (x, dp) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(dp)}`;
const dirText = (x, dp) => (Math.abs(x) < 10 ** -dp / 2 ? '持平' : x > 0 ? `上升 ${Math.abs(x).toFixed(dp)} 個百分點` : `下降 ${Math.abs(x).toFixed(dp)} 個百分點`);
const f = (v, dp) => v.toFixed(dp);

const onOrBefore = (obs, t) => {
  for (let i = obs.length - 1; i >= 0; i--) if (ts(obs[i].date) <= t) return obs[i];
  return null;
};

// 殖利率曲線狀態
const curveState = (v) => (v < 0 ? '倒掛' : v < 0.25 ? '接近平坦' : '正斜率');
// 高收益債利差水準（與首頁標籤一致）
const hyState = (v) => (v >= 5 ? '偏高' : v >= 3.5 ? '正常區間' : '偏低');

// ── 指標設定 ──────────────────────────────────────────────
export const INDICATORS = [
  {
    slug: 'us10y',
    name: '美國 10 年期公債殖利率',
    short: '美債10年殖利率',
    main: 'DGS10',
    fetch: ['DGS10'],
    dp: 2,
    answer: (x) => {
      const a = x.DGS10;
      return `截至 ${t(a.latest.date)}，美國 10 年期公債殖利率為 <b>${f(a.latest.v, 2)}%</b>`
        + `，較一個月前${dirText(a.d1m, 2)}，較一年前${dirText(a.d1y, 2)}。`
        + `近一年最高 ${f(a.hi.v, 2)}%（${fmtDate(a.hi.date)}）、最低 ${f(a.lo.v, 2)}%（${fmtDate(a.lo.date)}）。`;
    },
    stats: (x) => defaultStats(x.DGS10, 2),
    hub: (x) => ({ value: `${f(x.DGS10.latest.v, 2)}%`, tag: rangeTag(x.DGS10), desc: '全球資產定價的基準利率，影響債券與配息基金淨值。' }),
    chart: { lines: [{ id: 'DGS10', label: '10 年期殖利率' }] },
    table: { cols: [{ th: '月底值', id: 'DGS10', fmt: (v) => `${f(v, 2)}%` }], chg: 'DGS10' },
  },
  {
    slug: 'yield-curve',
    name: '美國 10 年期減 2 年期公債利差',
    short: '10Y−2Y利差',
    main: 'T10Y2Y',
    fetch: ['T10Y2Y', 'DGS10', 'DGS2'],
    dp: 2,
    answer: (x) => {
      const a = x.T10Y2Y;
      const yl = x.DGS10 && x.DGS2 ? `（10 年期 ${f(x.DGS10.latest.v, 2)}%、2 年期 ${f(x.DGS2.latest.v, 2)}%）` : '';
      return `截至 ${t(a.latest.date)}，美國 10 年期減 2 年期公債利差為 <b>${f(a.latest.v, 2)} 個百分點</b>${yl}，殖利率曲線呈<b>${curveState(a.latest.v)}</b>。`
        + `較一年前${dirText(a.d1y, 2)}；近一年最高 ${f(a.hi.v, 2)}（${fmtDate(a.hi.date)}）、最低 ${f(a.lo.v, 2)}（${fmtDate(a.lo.date)}）。`;
    },
    stats: (x) => {
      const a = x.T10Y2Y;
      return [
        card('最新利差', `${f(a.latest.v, 2)}<small> 個百分點</small>`, `資料日期 ${fmtDate(a.latest.date)}`, ' main'),
        card('曲線狀態', curveState(a.latest.v), a.latest.v < 0 ? '短天期利率高於長天期' : '長天期利率高於短天期', a.latest.v < 0 ? ' up' : ''),
        card('10 年期／2 年期', x.DGS10 && x.DGS2 ? `${f(x.DGS10.latest.v, 2)}<small>%</small>／${f(x.DGS2.latest.v, 2)}<small>%</small>` : '—', '公債殖利率'),
        card('近一年區間', `${f(a.lo.v, 2)}～${f(a.hi.v, 2)}`, `低 ${md(a.lo.date)}・高 ${md(a.hi.date)}`),
      ];
    },
    hub: (x) => ({ value: `${f(x.T10Y2Y.latest.v, 2)}`, unit: '個百分點', tag: curveState(x.T10Y2Y.latest.v), warn: x.T10Y2Y.latest.v < 0, desc: '殖利率曲線的斜率，小於 0 代表倒掛，常被視為景氣轉弱的提前訊號。' }),
    chart: { lines: [{ id: 'T10Y2Y', label: '10 年減 2 年利差' }], zero: true },
    table: {
      cols: [
        { th: '利差', id: 'T10Y2Y', fmt: (v) => f(v, 2) },
        { th: '狀態', id: 'T10Y2Y', fmt: (v) => curveState(v) },
      ],
      chg: 'T10Y2Y',
    },
  },
  // 高收益債利差（BAMLH0A0HYM2）版權屬 ICE，需事先授權才能公開，所以 hy-spread.html 改為純觀念頁，不自動更新數據
  {
    slug: 'fed-rate',
    name: '美國聯邦基金利率與通膨',
    short: '聯邦基金利率',
    main: 'DFEDTARU',
    fetch: ['DFEDTARU', 'DFEDTARL', 'CPIAUCSL', 'UNRATE'],
    dp: 2,
    answer: (x) => {
      const u = x.DFEDTARU, l = x.DFEDTARL, c = x.CPI_YOY;
      const range = l ? `${f(l.latest.v, 2)}%–${f(u.latest.v, 2)}%` : `${f(u.latest.v, 2)}%`;
      let s = `截至 ${t(u.latest.date)}，美國聯邦基金利率目標區間為 <b>${range}</b>，較一年前${dirText(u.d1y, 2)}（近一年調整 ${moves(u)} 次）。`;
      if (c) {
        const gap = c.latest.v - 2;
        s += `最新公布的 CPI 年增率為 <b>${f(c.latest.v, 1)}%</b>（${ym(c.latest.date)}），`
          + (Math.abs(gap) < 0.3 ? '接近聯準會約 2% 的長期目標。' : gap > 0 ? '高於聯準會約 2% 的長期目標。' : '低於聯準會約 2% 的長期目標。');
      }
      if (x.UNRATE) s += `失業率為 <b>${f(x.UNRATE.latest.v, 1)}%</b>（${ym(x.UNRATE.latest.date)}）。`;
      return s;
    },
    stats: (x) => {
      const u = x.DFEDTARU, l = x.DFEDTARL, c = x.CPI_YOY;
      return [
        card('目標區間', l ? `${f(l.latest.v, 2)}–${f(u.latest.v, 2)}<small>%</small>` : `${f(u.latest.v, 2)}<small>%</small>`, `資料日期 ${fmtDate(u.latest.date)}`, ' main'),
        card('較一年前', u.d1y == null ? '—' : `${pp(u.d1y, 2)}<small> 個百分點</small>`, '以區間上限計算', cls(u.d1y)),
        card('CPI 年增率', c ? `${f(c.latest.v, 1)}<small>%</small>` : '—', c ? `${ym(c.latest.date)}・目標約 2%` : ''),
        x.UNRATE ? card('失業率', `${f(x.UNRATE.latest.v, 1)}<small>%</small>`, `${ym(x.UNRATE.latest.date)}・較上月 ${x.UNRATE.d1m == null ? '—' : pp(x.UNRATE.d1m, 1)}`)
          : card('近一年調整', `${moves(u)}<small> 次</small>`, '利率目標變動次數'),
      ];
    },
    hub: (x) => ({
      value: x.DFEDTARL ? `${f(x.DFEDTARL.latest.v, 2)}–${f(x.DFEDTARU.latest.v, 2)}%` : `${f(x.DFEDTARU.latest.v, 2)}%`,
      tag: x.CPI_YOY ? `CPI ${f(x.CPI_YOY.latest.v, 1)}%` : '', warn: x.CPI_YOY && x.CPI_YOY.latest.v >= 3,
      desc: '美國的政策利率，搭配 CPI 年增率觀察升息與降息的方向。',
    }),
    chart: {
      lines: [
        { id: 'DFEDTARU', label: '聯邦基金利率（上限）' },
        { id: 'CPI_YOY', label: 'CPI 年增率', cls: 'l2', dots: true },
      ],
    },
    table: {
      cols: [
        { th: '目標區間', fmt: (v, row, x) => {
          const lo = monthEnd(x.DFEDTARL, row.month);
          return lo == null ? `${f(v, 2)}%` : `${f(lo, 2)}–${f(v, 2)}%`;
        }, id: 'DFEDTARU' },
        { th: 'CPI 年增率', fmt: (v, row, x) => {
          const c = monthEnd(x.CPI_YOY, row.month);
          return c == null ? '尚未公布' : `${f(c, 1)}%`;
        }, id: 'DFEDTARU' },
      ],
    },
  },
];

// 目前數值在近一年區間的位置
function rangeTag(a) {
  const span = a.hi.v - a.lo.v || 1;
  const p = (a.latest.v - a.lo.v) / span;
  return p >= 0.8 ? '近一年高檔' : p <= 0.2 ? '近一年低檔' : '近一年中段';
}

function sparkline(a, zero) {
  const W = 240, H = 56, P = 4;
  const pts = a.year;
  const vals = pts.map((p) => p.v); if (zero) vals.push(0);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const t0 = ts(pts[0].date), t1 = ts(pts[pts.length - 1].date);
  const X = (tt) => P + ((tt - t0) / (t1 - t0 || 1)) * (W - 2 * P);
  const Y = (v) => P + (1 - (v - min) / span) * (H - 2 * P);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(ts(p.date)).toFixed(1)},${Y(p.v).toFixed(1)}`).join('');
  const z = zero && min < 0 && max > 0 ? `<line x1="${P}" x2="${W - P}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" class="sz"/>` : '';
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${z}<path d="${d}"/><circle cx="${X(ts(last.date)).toFixed(1)}" cy="${Y(last.v).toFixed(1)}" r="3"/></svg>`;
}

const HY_CARD = `        <a class="ind" href="hy-spread.html">
          <span class="ind-name">美國高收益債利差</span>
          <span class="ind-val" style="font-size:22px">觀念說明</span>
          <span class="ind-meta"><span class="tag">信用風險</span></span>
          <span class="ind-desc">信用風險的溫度計：利差擴大代表市場越擔心企業違約。數據版權屬 ICE，本站提供觀念說明，最新數值請見 FRED。</span>
          <span class="ind-foot"><span>觀念頁</span><span class="go">看說明 →</span></span>
        </a>`;

function hubHtml(done) {
  return done.map(({ ind, page, x }) => {
    const h = ind.hub(x);
    const main = x[ind.main];
    const d1m = main.d1m;
    const chg = d1m == null ? '' : `<span class="chg${d1m > 0 ? ' up' : d1m < 0 ? ' down' : ''}">較上月 ${pp(d1m, ind.dp)}</span>`;
    return `        <a class="ind" href="${page.replace('indicators/', '')}">
          <span class="ind-name">${ind.name}</span>
          <span class="ind-val">${h.value}${h.unit ? `<small> ${h.unit}</small>` : ''}</span>
          <span class="ind-meta">${chg}${h.tag ? `<span class="tag${h.warn ? ' warn' : ''}">${h.tag}</span>` : ''}</span>
          ${sparkline(main, ind.chart.zero)}
          <span class="ind-desc">${h.desc}</span>
          <span class="ind-foot"><span>資料日期 <time datetime="${main.latest.date}">${fmtDate(main.latest.date)}</time></span><span class="go">看說明 →</span></span>
        </a>`;
  }).join('\n') + '\n' + HY_CARD;
}

// ── 共用：分析一條數列 ────────────────────────────────────
function analyse(all) {
  const latest = all[all.length - 1];
  const lt = ts(latest.date);
  const year = all.filter((o) => ts(o.date) > lt - 365 * DAY);
  const m1 = onOrBefore(all, lt - 30 * DAY);
  const y1 = onOrBefore(all, lt - 365 * DAY);
  let hi = year[0], lo = year[0];
  for (const o of year) { if (o.v > hi.v) hi = o; if (o.v < lo.v) lo = o; }
  const byMonth = new Map();
  for (const o of all) byMonth.set(o.date.slice(0, 7), o);
  return {
    all, latest, year, hi, lo, byMonth,
    d1m: m1 ? latest.v - m1.v : null,
    d1y: y1 ? latest.v - y1.v : null,
    from: year[0].date,
  };
}

const monthEnd = (a, month) => (a && a.byMonth.get(month) ? a.byMonth.get(month).v : null);
const moves = (a) => { let n = 0; for (let i = 1; i < a.year.length; i++) if (a.year[i].v !== a.year[i - 1].v) n++; return n; };
const cls = (x) => (x > 0 ? ' up' : x < 0 ? ' down' : '');
const t = (d) => `<time datetime="${d}">${fmtDate(d)}</time>`;
const card = (k, v, sub, c = '') => `        <div class="stat${c}"><div class="k">${k}</div><div class="v">${v}</div><div class="sub">${sub}</div></div>`;

function defaultStats(a, dp, unitWord = '') {
  const unit = unitWord || '<small>%</small>';
  const chg = (x) => (x == null ? '—' : `${pp(x, dp)}<small> 個百分點</small>`);
  return [
    card('最新', `${f(a.latest.v, dp)}${unitWord ? `<small>${unitWord}</small>` : unit}`, `資料日期 ${fmtDate(a.latest.date)}`, ' main'),
    card('較一個月前', chg(a.d1m), '約 30 天', cls(a.d1m)),
    card('較一年前', chg(a.d1y), '約 365 天', cls(a.d1y)),
    card('近一年區間', `${f(a.lo.v, dp)}～${f(a.hi.v, dp)}`, `低 ${md(a.lo.date)}・高 ${md(a.hi.date)}`),
  ];
}

// CPI 指數 → 年增率（月資料）
function cpiYoy(obs) {
  const map = new Map(obs.map((o) => [o.date.slice(0, 7), o.v]));
  const out = [];
  for (const o of obs) {
    const [y, m] = o.date.split('-');
    const prev = map.get(`${Number(y) - 1}-${m}`);
    if (prev) out.push({ date: o.date, v: Math.round((o.v / prev - 1) * 1000) / 10 });
  }
  return out;
}

async function fetchSeries(id, key) {
  const days = id === 'CPIAUCSL' ? 800 : 400;
  const start = new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${key}&file_type=json&observation_start=${start}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${id} HTTP ${res.status}`);
  return (await res.json()).observations
    .filter((o) => o.value !== '.')
    .map((o) => ({ date: o.date, v: Number(o.value) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ── 走勢圖（SVG，直接寫進網頁） ───────────────────────────
function chartSvg(ind, x) {
  const W = 960, H = 320, L = 84, R = 24, T = 24, B = 44;
  const main = x[ind.main];
  const lines = ind.chart.lines.filter((l) => x[l.id]).map((l) => ({ ...l, pts: x[l.id].year }));
  const t0 = ts(main.year[0].date), t1 = ts(main.latest.date);
  const vals = lines.flatMap((l) => l.pts.filter((p) => ts(p.date) >= t0).map((p) => p.v));
  if (ind.chart.zero) vals.push(0);
  let min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const step = span > 4 ? 1 : span > 2 ? 0.5 : span > 0.8 ? 0.25 : 0.1;
  min = Math.floor((min - span * 0.08) / step) * step;
  max = Math.ceil((max + span * 0.08) / step) * step;
  const X = (tt) => L + ((Math.min(Math.max(tt, t0), t1) - t0) / (t1 - t0 || 1)) * (W - L - R);
  const Y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const grid = [];
  for (let v = min; v <= max + 1e-9; v += step) {
    const vv = Math.abs(v) < 1e-9 ? 0 : v;
    grid.push(`<line x1="${L}" x2="${W - R}" y1="${Y(vv).toFixed(1)}" y2="${Y(vv).toFixed(1)}" class="${ind.chart.zero && vv === 0 ? 'z' : 'g'}"/>`
      + `<text x="${L - 8}" y="${(Y(vv) + 4).toFixed(1)}" class="yl">${vv.toFixed(step < 0.25 ? 1 : step < 1 ? 2 : 0)}</text>`);
  }
  const xl = [];
  const d = new Date(t0); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
  let k = 0;
  while (d.getTime() <= t1) {
    if (k % 2 === 0) {
      const lab = d.getUTCMonth() === 0 ? `${d.getUTCFullYear()}/1` : `${d.getUTCMonth() + 1}月`;
      xl.push(`<text x="${X(d.getTime()).toFixed(1)}" y="${H - 14}" class="xl">${lab}</text>`);
    }
    d.setUTCMonth(d.getUTCMonth() + 1); k++;
  }
  const paths = lines.map((l, i) => {
    const pts = l.pts.filter((p) => ts(p.date) >= t0 - 31 * DAY);
    const line = pts.map((p, j) => `${j ? 'L' : 'M'}${X(ts(p.date)).toFixed(1)},${Y(p.v).toFixed(1)}`).join('');
    const c = l.cls || 'l';
    let out = '';
    if (i === 0 && !ind.chart.zero && lines.length === 1) {
      out += `<path d="${line}L${X(t1).toFixed(1)},${(H - B).toFixed(1)}L${X(t0).toFixed(1)},${(H - B).toFixed(1)}Z" class="a"/>`;
    }
    out += `<path d="${line}" class="${c}"/>`;
    if (l.dots) out += pts.map((p) => `<circle cx="${X(ts(p.date)).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3" class="d2"/>`).join('');
    return out;
  }).join('\n          ');
  const mark = (o, c) => `<circle cx="${X(ts(o.date)).toFixed(1)}" cy="${Y(o.v).toFixed(1)}" r="3.5" class="${c}"/>`;
  const legend = lines.length > 1
    ? lines.map((l) => `<span class="lg ${l.cls || 'l'}">${l.label}</span>`).join('') + '｜'
    : '';
  const u = ind.slug === 'us10y' || ind.slug === 'fed-rate' ? '%' : '百分點';
  return `      <figure class="chart">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="chartTitle chartDesc" preserveAspectRatio="none">
          <title id="chartTitle">${ind.name}近一年走勢</title>
          <desc id="chartDesc">${fmtDate(main.from)} 至 ${fmtDate(main.latest.date)}，最高 ${f(main.hi.v, ind.dp)}（${fmtDate(main.hi.date)}），最低 ${f(main.lo.v, ind.dp)}（${fmtDate(main.lo.date)}），最新 ${f(main.latest.v, ind.dp)}。</desc>
          ${grid.join('\n          ')}
          ${paths}
          ${lines.length === 1 ? mark(main.hi, 'hi') + mark(main.lo, 'lo') : ''}
          <circle cx="${X(t1).toFixed(1)}" cy="${Y(main.latest.v).toFixed(1)}" r="5" class="last"/>
          ${xl.join('')}
        </svg>
        <figcaption>${legend}單位：${u}｜${fmtDate(main.from)}–${fmtDate(main.latest.date)}｜● 最新 ${f(main.latest.v, ind.dp)}${lines.length === 1 ? `　▲ 最高 ${f(main.hi.v, ind.dp)}　▼ 最低 ${f(main.lo.v, ind.dp)}` : ''}｜資料來源：FRED（This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.）</figcaption>
      </figure>`;
}

// ── 近 12 個月表格 ────────────────────────────────────────
function lastDayOfMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  return String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, '0');
}

function tableHtml(ind, x) {
  const main = x[ind.main];
  const months = [...main.byMonth.entries()].map(([month, o]) => ({ month, date: o.date, v: o.v }));
  const rows = months.slice(-13).map((r, i, a) => ({ ...r, prev: i ? a[i - 1] : null })).slice(-12).reverse();
  const head = ['月份', ...ind.table.cols.map((c) => c.th), ...(ind.table.chg ? ['較上月'] : [])];
  const body = rows.map((r, i) => {
    const partial = i === 0 && r.date.slice(8) !== lastDayOfMonth(r.month);
    const label = partial ? `${r.month.replace('-', '/')}（至${md(r.date)}）` : r.month.replace('-', '/');
    const cells = ind.table.cols.map((c) => {
      const v = monthEnd(x[c.id], r.month);
      return `<td>${v == null ? '—' : c.fmt(v, r, x)}</td>`;
    });
    if (ind.table.chg) {
      const a = x[ind.table.chg];
      const v = monthEnd(a, r.month);
      const pv = r.prev ? monthEnd(a, r.prev.month) : null;
      const ch = v == null || pv == null ? null : v - pv;
      cells.push(`<td${ch > 0 ? ' class="up"' : ch < 0 ? ' class="down"' : ''}>${ch == null ? '—' : pp(ch, ind.dp)}</td>`);
    }
    return `            <tr><td>${label}</td>${cells.join('')}</tr>`;
  }).join('\n');
  return `      <div class="table-wrap">
        <table class="mtable">
          <caption>${ind.name}：近 12 個月月底值${ind.table.chg ? '（較上月單位：百分點）' : ''}</caption>
          <thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>
${body}
          </tbody>
        </table>
      </div>`;
}

// ── 主流程 ────────────────────────────────────────────────
export async function runIndicators({ file, replaceBetween, setDateModified, key }) {
  const done = [];
  const cache = new Map(); // 同一數列只抓一次
  const get = (id) => { if (!cache.has(id)) cache.set(id, fetchSeries(id, key)); return cache.get(id); };

  for (const ind of INDICATORS) {
    const page = `indicators/${ind.slug}.html`;
    if (!existsSync(file(page))) { console.warn(`⚠ 找不到 ${page}，略過`); continue; }
    try {
      const x = {};
      for (const id of ind.fetch) {
        try {
          const obs = await get(id);
          if (id === 'CPIAUCSL') { const yoy = cpiYoy(obs); if (yoy.length >= 13) x.CPI_YOY = analyse(yoy); continue; }
          if (id === 'UNRATE') { if (obs.length >= 2) { const a = analyse(obs); a.d1m = obs[obs.length - 1].v - obs[obs.length - 2].v; x.UNRATE = a; } continue; }
          if (obs.length >= 30) x[id] = analyse(obs);
        } catch (err) {
          if (id === ind.main) throw err;
          console.warn(`  ⚠ ${ind.short} 的輔助數列 ${id} 讀取失敗：${err.message}`);
        }
      }
      const main = x[ind.main];
      if (!main || main.all.length < 200) throw new Error(`主要數列 ${ind.main} 資料不足`);

      await mkdir(file('data/indicators'), { recursive: true });
      const series = {};
      for (const [id, a] of Object.entries(x)) series[id] = a.year.map((o) => [o.date, o.v]);
      await writeFile(file(`data/indicators/${ind.slug}.json`), JSON.stringify({
        name: ind.name, main: ind.main, asOf: main.latest.date, latest: main.latest.v,
        change1m: main.d1m == null ? null : Number(main.d1m.toFixed(4)),
        change1y: main.d1y == null ? null : Number(main.d1y.toFixed(4)),
        high1y: { date: main.hi.date, value: main.hi.v }, low1y: { date: main.lo.date, value: main.lo.v },
        source: ind.fetch.map((id) => `https://fred.stlouisfed.org/series/${id}`),
        series,
      }) + '\n');

      let html = await readFile(file(page), 'utf8');
      html = replaceBetween(html, 'IND_ANSWER', `      <p class="answer">${ind.answer(x)}</p>`);
      html = replaceBetween(html, 'IND_STATS', ['      <div class="stats">', ...ind.stats(x), '      </div>'].join('\n'));
      html = replaceBetween(html, 'IND_CHART', chartSvg(ind, x));
      html = replaceBetween(html, 'IND_TABLE', tableHtml(ind, x));
      html = html.replace(/<time datetime="[\d-]+" id="indDate">[^<]*<\/time>/, `<time datetime="${main.latest.date}" id="indDate">${fmtDate(main.latest.date)}</time>`);
      html = html.replace(/"temporalCoverage":\s*"[^"]*"/, `"temporalCoverage": "${main.from}/${main.latest.date}"`);
      html = setDateModified(html, main.latest.date);
      await writeFile(file(page), html);

      done.push({ ind, page, x, date: main.latest.date });
      console.log(`  ↳ 指標頁 ${ind.short}：${f(main.latest.v, ind.dp)}（${main.latest.date}，近一年 ${main.year.length} 筆）`);
    } catch (err) {
      console.warn(`⚠ 指標頁 ${ind.short} 更新失敗：${err.message}（保留原內容）`);
    }
  }
  // 總覽頁：4 個指標都更新成功才改寫，避免少了卡片
  const hub = 'indicators/index.html';
  if (existsSync(file(hub)) && done.length === INDICATORS.length) {
    const latest = done.map((r) => r.date).sort().pop();
    let html = await readFile(file(hub), 'utf8');
    html = replaceBetween(html, 'IND_HUB', hubHtml(done));
    html = html.replace(/<time datetime="[\d-]+" id="indDate">[^<]*<\/time>/, `<time datetime="${latest}" id="indDate">${fmtDate(latest)}</time>`);
    html = setDateModified(html, latest);
    await writeFile(file(hub), html);
    done.hub = { page: hub, date: latest };
    console.log('  ↳ 指標總覽頁已更新');
  }
  return done;
}

// sitemap：沒有就新增網址，有就更新 lastmod
export function upsertSitemap(sm, url, date) {
  const re = new RegExp(`(<loc>${url.replace(/[.]/g, '\\.')}</loc><lastmod>)[\\d-]+(</lastmod>)`);
  if (re.test(sm)) return sm.replace(re, `$1${date}$2`);
  return sm.replace('</urlset>', `  <url><loc>${url}</loc><lastmod>${date}</lastmod></url>\n</urlset>`);
}
