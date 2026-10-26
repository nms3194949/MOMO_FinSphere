// ============================================================
// MOMO財商智庫｜每日數據快照  scripts/snapshot.mjs
// 由 GitHub Actions（.github/workflows/snapshot.yml）每天執行：
//   1. 從 FRED 抓 6 個經濟指標、從 MCS Worker 抓景氣分數、計算景氣羅盤位置
//   2. 寫成靜態 HTML／文字，讓搜尋引擎與 AI 爬蟲（不執行 JavaScript）也讀得到：
//      index.html（SNAP:MACRO）、tools/cycle.html（SNAP:CYCLE）、llms.txt（SNAP:LLMS）
//      data/macro.json、sitemap.xml 的 lastmod、各頁 dateModified
//   3. 從 MOMO雙贏策略部落格的 RSS 更新首頁「最新文章」（SNAP:POSTS）
//   4. 更新指標常青頁 indicators/*.html（設定與做法見 scripts/indicators.mjs）
//   3. 加上 --indexnow 參數時，改為通知 Bing（IndexNow）頁面已更新
//
// 本機測試：FRED_API_KEY=你的金鑰 node scripts/snapshot.mjs
// 不需要安裝任何套件（Node.js 20 以上內建 fetch）
// ============================================================

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INDICATORS, runIndicators, upsertSitemap } from './indicators.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://nms3194949.github.io/MOMO_FinSphere/';
const BLOG_RSS = 'https://nms3194949.github.io/momo-blog/rss.xml';
const MCS_API = 'https://mcs-worker.nms3194949.workers.dev?profile=balanced';
const INDEXNOW_KEY = '152b46d40afee669f85ae0b1dbe8bdf8';

// 測試用：SNAPSHOT_MOCK=fixture.json 時，用檔案內容代替網路請求
if (process.env.SNAPSHOT_MOCK) {
  const fx = JSON.parse(await readFile(process.env.SNAPSHOT_MOCK, 'utf8'));
  globalThis.fetch = async (url) => {
    const key = Object.keys(fx).find((k) => String(url).includes(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) };
    const v = fx[key];
    return { ok: true, status: 200, json: async () => v, text: async () => (typeof v === 'string' ? v : JSON.stringify(v)) };
  };
}

// ── 指標設定（和首頁前端的 MACRO_META 一致） ──────────────────
const SERIES = [
  { id: 'DGS10', series: 'DGS10', type: 'daily', lookbackDays: 30, name: '美債10年殖利率', dp: 2, cmp: '月', page: 'indicators/us10y.html',
    tip: '長天期利率，影響債券與配息基金的淨值' },
  { id: 'T10Y2Y', series: 'T10Y2Y', type: 'daily', lookbackDays: 30, name: '10Y−2Y利差', dp: 2, cmp: '月', page: 'indicators/yield-curve.html',
    tip: '殖利率曲線斜率，負值代表倒掛',
    tag: (v) => (v < 0 ? ['倒掛', 1] : v < 0.25 ? ['趨平', 0] : ['正斜率', 0]) },
  { id: 'DFEDTARU', series: 'DFEDTARU', type: 'daily', lookbackDays: 90, name: '聯邦基金利率', dp: 2, cmp: '季', page: 'indicators/fed-rate.html',
    tip: '聯準會政策利率（目標區間上限）',
    tag: (v, p) => (v < p ? ['降息循環', 0] : v > p ? ['升息循環', 1] : ['利率持平', 0]) },
  { id: 'CPI_YOY', series: 'CPIAUCSL', type: 'yoy', name: '美國CPI年增', dp: 1, cmp: '月', page: 'indicators/fed-rate.html',
    tip: '通膨速度，聯準會目標約 2%',
    tag: (v) => (v >= 3 ? ['高於目標', 1] : v > 2.3 ? ['略高於目標', 0] : ['接近目標', 0]) },
  { id: 'M2_YOY', series: 'M2SL', type: 'yoy', name: '美國M2年增', dp: 1, cmp: '月',
    tip: '市場資金水位的變化',
    tag: (v) => (v < 0 ? ['資金收縮', 1] : v < 3 ? ['溫和成長', 0] : ['資金擴張', 0]) },
  // 注意：只放 FRED 標示為「Public Domain」的數列。高收益債利差（BAMLH0A0HYM2）版權屬 ICE，需事先授權，不可公開
  { id: 'UNRATE', series: 'UNRATE', type: 'monthly', name: '美國失業率', dp: 1, cmp: '月', page: 'indicators/fed-rate.html',
    tip: '美國勞工統計局公布的失業率，聯準會決定利率的重要依據',
    tag: (v) => (v >= 5 ? ['偏高', 1] : v >= 4 ? ['溫和', 0] : ['偏低', 0]) },
];

// FRED API 使用條款要求的註明（https://fred.stlouisfed.org/docs/api/terms_of_use.html）
const FRED_NOTICE = '資料來源：FRED（聖路易聯邦準備銀行）｜This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.｜<a href="https://fred.stlouisfed.org/legal/#api" target="_blank" rel="noopener" style="color:inherit">FRED® API 使用條款</a>';

const STAGE_ZH = { Recession: '衰退區', Slowdown: '放緩區', Growth: '成長區', Heat: '過熱區' };

// ── 小工具 ────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp;
const twToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date()); // YYYY-MM-DD
const file = (p) => path.join(ROOT, p);

function replaceBetween(text, tag, content) {
  const re = new RegExp(`(<!-- SNAP:${tag}:START -->)[\\s\\S]*?(<!-- SNAP:${tag}:END -->)`);
  if (!re.test(text)) throw new Error(`找不到 SNAP:${tag} 標記`);
  return text.replace(re, `$1\n${content}\n$2`);
}
const setDateModified = (text, date) => text.replace(/"dateModified":\s*"\d{4}-\d{2}-\d{2}"/g, `"dateModified": "${date}"`);

// ── 1. FRED ───────────────────────────────────────────────
async function fetchFred() {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error('缺少環境變數 FRED_API_KEY');
  const results = await Promise.all(SERIES.map(async (s) => {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${s.series}&api_key=${key}&file_type=json&sort_order=desc&limit=${s.type === 'yoy' ? 15 : 120}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const obs = (await res.json()).observations
        .filter((o) => o.value !== '.')
        .map((o) => ({ date: o.date, v: Number(o.value) })); // 由新到舊
      if (s.type === 'monthly') {
        if (obs.length < 2) return null;
        return { id: s.id, value: obs[0].v, prev: obs[1].v, date: obs[0].date.slice(0, 7) };
      }
      if (s.type === 'yoy') {
        if (obs.length < 14) return null;
        const yoy = (k) => (obs[k].v / obs[k + 12].v - 1) * 100;
        return { id: s.id, value: round(yoy(0), 2), prev: round(yoy(1), 2), date: obs[0].date.slice(0, 7) };
      }
      if (obs.length < 2) return null;
      const latest = obs[0];
      const target = Date.parse(latest.date) - s.lookbackDays * 864e5;
      const past = obs.find((o) => Date.parse(o.date) <= target) || obs[obs.length - 1];
      return { id: s.id, value: latest.v, prev: past.v, date: latest.date };
    } catch (err) {
      console.warn(`⚠ ${s.id} 讀取失敗：${err.message}`);
      return null;
    }
  }));
  return results.filter(Boolean);
}

// ── 2. MCS 景氣分數 ───────────────────────────────────────
async function fetchMcs() {
  try {
    const res = await fetch(MCS_API);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();
    if (d.score == null || !d.stage) throw new Error('資料格式不符');
    return { score: Math.round(d.score), stage: d.stage, asOf: String(d.asOf || '').slice(0, 10) };
  } catch (err) {
    console.warn(`⚠ MCS 讀取失敗：${err.message}`);
    return null;
  }
}

// ── 3. 景氣羅盤（和 tools/Macro-Compass.html 的模型相同） ──
function compassNow() {
  const [y, m] = twToday().split('-').map(Number);
  const q = Math.floor((m - 1) / 3);
  const year = y + q / 4;
  const konAngle = (((year - 2005) / 60) % 1) * 360;
  const ecm = Math.sin(((year - 2020) / 10) * Math.PI * 2);
  const base = (Math.sin((konAngle * Math.PI) / 180) + 1) * 50;
  const score = Math.round(Math.min(98, Math.max(2, base * 0.8 + (ecm + 1) * 50 * 0.2)));
  const a = ((konAngle % 360) + 360) % 360;
  const season = a < 90 ? '春｜復甦期' : a < 180 ? '夏｜過熱期' : a < 270 ? '秋｜滯脹期' : '冬｜衰退期';
  return { score, season, label: `${y} Q${q + 1}` };
}

function compareText(mcs, cmp) {
  if (!mcs) return '';
  const shortUp = mcs.stage === 'Growth' || mcs.stage === 'Heat';
  const longUp = cmp.score >= 55;
  if (shortUp && longUp) return '兩個週期同向偏擴張。';
  if (!shortUp && !longUp) return '兩個週期同向偏收縮。';
  if (shortUp) return '短期偏熱、長期偏冷，兩個週期方向分歧。';
  return '短期降溫、長期偏暖，兩個週期方向分歧。';
}


// ── 4. 部落格最新文章（RSS） ──────────────────────────────
async function fetchPosts(limit = 4) {
  try {
    const res = await fetch(BLOG_RSS);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const xml = await res.text();
    const pick = (block, tag) => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
      if (!m) return '';
      return m[1].replace(/^<!\[CDATA\[|\]\]>$/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
    };
    const posts = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
      const b = m[1];
      const d = new Date(pick(b, 'pubDate'));
      return {
        title: pick(b, 'title'),
        link: pick(b, 'link').replace(/^https?:\/\/nms3194949\.github\.io/, ''),
        desc: pick(b, 'description'),
        tag: pick(b, 'category'),
        date: isNaN(d) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(d),
      };
    }).filter((p) => p.title && p.link)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, limit);
    if (!posts.length) throw new Error('RSS 沒有文章');
    // 封面圖：讀每篇文章頁的 og:image（部落格把第一張輪播圖轉成 1080px JPEG）
    await Promise.all(posts.map(async (p) => {
      try {
        const r = await fetch('https://nms3194949.github.io' + p.link);
        if (!r.ok) return;
        const page = await r.text();
        const m = page.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/) || page.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/);
        if (m && !/og-default/.test(m[1])) p.cover = m[1].replace(/^https?:\/\/nms3194949\.github\.io/, '');
      } catch (e) { /* 沒有封面就用文字底圖 */ }
    }));
    return posts;
  } catch (err) {
    console.warn(`⚠ 部落格 RSS 讀取失敗：${err.message}（保留原本的文章列表）`);
    return null;
  }
}

function postsHtml(posts) {
  return posts.map((p) => `          <a class="post" href="${esc(p.link)}">
            ${p.cover
              ? `<img class="post-cover" src="${esc(p.cover)}" alt="${esc(p.title)}" width="1080" height="1350" loading="lazy" decoding="async">`
              : `<span class="post-cover ph" aria-hidden="true">${esc(p.tag || 'MOMO雙贏策略')}</span>`}
            <span class="post-meta"><time datetime="${p.date}">${p.date}</time>${p.tag ? '・' + esc(p.tag) : ''}</span>
            <span class="post-title">${esc(p.title)}</span>
          </a>`).join('\n');
}

// ── 產生 HTML／文字 ───────────────────────────────────────
function macroHtml(items, asOf) {
  const meta = Object.fromEntries(SERIES.map((s) => [s.id, s]));
  const cells = items.map((it) => {
    const m = meta[it.id];
    const diff = it.prev == null ? null : round(it.value - it.prev, m.dp); // 先四捨五入，避免出現 ▲0.0
    const dTxt = diff == null ? '' : (diff > 0 ? '▲' : diff < 0 ? '▼' : '—') + Math.abs(diff).toFixed(m.dp);
    const dCls = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
    const tag = m.tag ? m.tag(it.value, it.prev) : null;
    const open = m.page
      ? `<a class="mc" href="${m.page}" style="display:block;color:inherit;text-decoration:none" title=`
      : `<div class="mc" title=`;
    return `            ${open}"${esc(`${m.tip}｜資料日期 ${it.date}`)}">` +
      `<div class="n">${esc(m.name)}</div>` +
      `<div class="v">${it.value.toFixed(m.dp)}<small>%</small></div>` +
      `<div class="s">${dTxt ? `<span class="d ${dCls}" title="較上${m.cmp}">${dTxt}</span>` : ''}` +
      `${tag ? `<span class="t${tag[1] ? ' warn' : ''}">${esc(tag[0])}</span>` : ''}</div>${m.page ? '</a>' : '</div>'}`;
  }).join('\n');
  return `        <div class="macro" id="macro" aria-labelledby="macro-title">
          <div class="macro-head"><b id="macro-title">經濟數據速覽</b><span id="macro-asof">FRED｜<time datetime="${asOf}">${asOf}</time><em>｜▲▼ 與上期比較</em>｜<a href="indicators/" style="color:inherit;font-weight:700">全部指標 →</a></span></div>
          <div class="macro-grid" id="macro-grid">
${cells}
          </div>
          <p style="margin:8px 0 0;font-size:11.5px;line-height:1.6;color:#7a8296">${FRED_NOTICE}</p>
        </div>`;
}

function cycleHtml(mcs, cmp, date) {
  const mcsTxt = mcs
    ? `截至 ${mcs.asOf || date}，<b>短週期 MCS 景氣分數為 ${mcs.score}（${STAGE_ZH[mcs.stage] || ''} ${mcs.stage}）</b>；`
    : '';
  return `    <p class="answer">${mcsTxt}<b>長週期景氣羅盤位於${cmp.season.replace('｜', '・')}</b>（模型位置 ${cmp.label}，綜合評分 ${cmp.score}）。${compareText(mcs, cmp)}MCS 綜合 7 個經濟與市場因子衡量接下來幾個月的景氣溫度（0–100 分，分為衰退、放緩、成長、過熱）；景氣羅盤描述在十年、數十年大週期中的位置。</p>`;
}

function llmsText(items, mcs, cmp, asOf) {
  const meta = Object.fromEntries(SERIES.map((s) => [s.id, s]));
  const lines = items.map((it) => {
    const m = meta[it.id];
    const d = it.prev == null ? null : round(it.value - it.prev, m.dp);
    const diff = d == null ? '' : `（較上${m.cmp} ${d > 0 ? '+' : ''}${d.toFixed(m.dp)}）`;
    const tag = m.tag ? `，${m.tag(it.value, it.prev)[0]}` : '';
    return `- ${m.name}：${it.value.toFixed(m.dp)}%${diff}${tag}｜資料日期 ${it.date}｜${m.tip}`;
  });
  const out = [`資料更新：${asOf}（來源：FRED，聖路易聯邦準備銀行；This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.）`, '', ...lines, ''];
  if (mcs) out.push(`- MCS 景氣分數（短週期）：${mcs.score} 分，${STAGE_ZH[mcs.stage] || ''}（${mcs.stage}）｜${mcs.asOf || asOf}`);
  out.push(`- 景氣羅盤（長週期模型）：${cmp.season}，綜合評分 ${cmp.score}｜模型位置 ${cmp.label}`);
  if (INDICATORS.length) {
    out.push('', `指標說明頁（定義、近一年走勢、對債券與配息基金的影響），總覽：${SITE}indicators/`);
    for (const ind of INDICATORS) out.push(`- ${ind.name}：${SITE}indicators/${ind.slug}.html`);
  }
  out.push('', '以上為數據狀態描述，不構成投資建議。');
  return out.join('\n');
}

// ── 主流程：寫入檔案 ──────────────────────────────────────
async function snapshot() {
  const [items, mcs, posts] = await Promise.all([fetchFred(), fetchMcs(), fetchPosts()]);
  if (items.length < 3) throw new Error(`FRED 只取得 ${items.length} 個指標，不更新網站`);
  const cmp = compassNow();
  // 「資料日期」用指標裡最新的日資料日期，而不是執行日，避免假日沒新資料也每天提交
  const asOf = items.filter((i) => i.date.length === 10).map((i) => i.date).sort().pop() || twToday();

  await mkdir(file('data'), { recursive: true });
  await writeFile(file('data/macro.json'),
    JSON.stringify({ success: true, asOf, items, mcs, compass: cmp }, null, 2) + '\n');

  let html = await readFile(file('index.html'), 'utf8');
  html = setDateModified(replaceBetween(html, 'MACRO', macroHtml(items, asOf)), asOf);
  if (posts) html = replaceBetween(html, 'POSTS', postsHtml(posts));
  await writeFile(file('index.html'), html);

  let cyc = await readFile(file('tools/cycle.html'), 'utf8');
  const cycDate = (mcs && mcs.asOf) || asOf;
  cyc = replaceBetween(cyc, 'CYCLE', cycleHtml(mcs, cmp, cycDate));
  cyc = cyc.replace(/<time datetime="[\d-]+" id="snapDate">[\d-]+<\/time>/, `<time datetime="${cycDate}" id="snapDate">${cycDate}</time>`);
  cyc = setDateModified(cyc, cycDate);
  await writeFile(file('tools/cycle.html'), cyc);

  let llms = await readFile(file('llms.txt'), 'utf8');
  llms = replaceBetween(llms, 'LLMS', llmsText(items, mcs, cmp, asOf));
  await writeFile(file('llms.txt'), llms);

  const inds = await runIndicators({ file, replaceBetween, setDateModified, key: process.env.FRED_API_KEY });

  let sm = await readFile(file('sitemap.xml'), 'utf8');
  for (const r of inds) sm = upsertSitemap(sm, SITE + r.page, r.date);
  if (inds.hub) sm = upsertSitemap(sm, SITE + 'indicators/', inds.hub.date);
  for (const [u, d] of [[SITE, asOf], [SITE + 'tools/cycle.html', cycDate]]) {
    sm = sm.replace(new RegExp(`(<loc>${u.replace(/[.]/g, '\\.')}</loc><lastmod>)[\\d-]+(</lastmod>)`), `$1${d}$2`);
  }
  await writeFile(file('sitemap.xml'), sm);

  console.log(`✅ 快照完成：${items.length} 個指標（${asOf}）`
    + `${mcs ? `、MCS ${mcs.score} ${mcs.stage}` : '、MCS 未取得'}、羅盤 ${cmp.season} ${cmp.score}`
    + `${posts ? `、文章 ${posts.length} 篇（封面 ${posts.filter((p) => p.cover).length} 張）` : '、文章未更新'}`
    + `、指標頁 ${inds.length}/${INDICATORS.length}`);
}

// ── IndexNow：通知 Bing 等搜尋引擎頁面已更新 ──────────────
async function indexNow() {
  const body = {
    host: 'nms3194949.github.io',
    key: INDEXNOW_KEY,
    keyLocation: `${SITE}${INDEXNOW_KEY}.txt`,
    urlList: [SITE, `${SITE}tools/cycle.html`, `${SITE}llms.txt`, `${SITE}indicators/`, ...INDICATORS.map((i) => `${SITE}indicators/${i.slug}.html`)],
  };
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  console.log(`IndexNow 回應：${res.status}（200／202 代表已收到）`);
}

try {
  if (process.argv.includes('--indexnow')) await indexNow();
  else await snapshot();
} catch (err) {
  console.error('❌ ' + err.message);
  process.exit(1);
}
