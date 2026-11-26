// ============================================================
// MOMO財商智庫｜MOMO 市場共振指數（MRI）快照  scripts/mri.mjs
// 由 GitHub Actions（每日數據快照）執行：
//   1. 從 moneyDJ爬蟲整合（GAS）讀 ?op=get_mri（MRI_Lab 分頁的結果；代理基金名稱不會離開 GAS）
//   2. 寫進首頁 index.html 的 SNAP:MRI（儀表指針卡片）
//      與 indicators/mri.html 的 SNAP:MRIPAGE（指針、六資產、走勢圖、燈號分組統計）
//   3. 更新 data/mri.json、sitemap.xml、llms.txt（SNAP:MRILLMS）
// API 失敗時沿用上一次的 data/mri.json（第一次用 data/mri-seed.json）。
// 本機測試：MRI_MOCK=data/mri-seed.json node scripts/mri.mjs
// ============================================================

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://script.google.com/macros/s/AKfycbwUk4wagt8SSchnpz8oqj1XkgfGM2--9M41WBlZGUpsT29dtdv1wV55nowk37ClEmlxyw/exec?op=get_mri';
const URL_ = 'https://momowinwin.com/MOMO_FinSphere/indicators/mri.html';
const F = (p) => path.join(ROOT, p);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (x, dp = 1) => (x == null || !isFinite(x) ? '—' : (x >= 0 ? '+' : '') + (x * 100).toFixed(dp) + '%');
const pc0 = (x) => (x == null || !isFinite(x) ? '—' : Math.round(x * 100) + '%');

export const BANDS = [
  { max: 40, key: 'g', name: '共振偏低', icon: '🟢', color: '#2f9e5a', note: '下跌沒有跨市場擴散，多數資產各走各的' },
  { max: 60, key: 'y', name: '一般波動', icon: '🟡', color: '#e0b84a', note: '有零星同步下跌，屬於正常波動範圍' },
  { max: 80, key: 'o', name: '共振升高', icon: '🟠', color: '#e8873a', note: '多項資產開始一起跌，分散效果變弱' },
  { max: 95, key: 'r', name: '高度共振', icon: '🔴', color: '#d64545', note: '股、債、金多數同步下跌，市場壓力明顯' },
  { max: 100.01, key: 'x', name: '歷史極端', icon: '🔴', color: '#8f1d1d', note: '同步下跌強度落在近 5 年最高的 5%' }
];
export const band = (v) => BANDS.find((b) => v < b.max) || BANDS[BANDS.length - 1];

// ---------- 半圓儀表（0～100，指針） ----------
export function gauge(v, { w = 260, dark = true, id = 'g' } = {}) {
  const cx = 130, cy = 128, r = 104, sw = 22;
  const P = (val, rad) => { const a = Math.PI * (1 - val / 100); return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)]; };
  const arc = (a, b) => { const [x1, y1] = P(a, r), [x2, y2] = P(b, r); return `M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)}`; };
  let lo = 0;
  const segs = BANDS.map((b) => { const hi = Math.min(100, b.max); const s = `<path d="${arc(lo + 0.6, hi - 0.6)}" stroke="${b.color}" stroke-width="${sw}" fill="none"/>`; lo = hi; return s; }).join('');
  const tick = dark ? '#7a8296' : '#7a8296';
  const ticks = [0, 40, 60, 80, 95, 100].map((t) => { const [x, y] = P(t, r + sw / 2 + 10); return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="11" fill="${tick}" text-anchor="middle">${t}</text>`; }).join('');
  const val = Math.max(0, Math.min(100, v));
  const ang = -90 + val * 1.8;
  const needle = dark ? '#ffffff' : '#0c152a';
  return `<svg class="mri-gauge" viewBox="-10 0 280 150" width="${w}" role="img" aria-labelledby="${id}-t"><title id="${id}-t">MRI 儀表：${val.toFixed(1)}，${band(val).name}</title>`
    + segs + ticks
    + `<g transform="rotate(${ang.toFixed(1)} ${cx} ${cy})"><path d="M${cx - 5},${cy} L${cx},${cy - r + 6} L${cx + 5},${cy} Z" fill="${needle}"/></g>`
    + `<circle cx="${cx}" cy="${cy}" r="9" fill="${needle}"/><circle cx="${cx}" cy="${cy}" r="4" fill="${dark ? '#0c152a' : '#fffdf8'}"/></svg>`;
}

// ---------- 首頁卡片 ----------
function heroCard(d) {
  const b = band(d.value), H = d.history, n = H.length;
  const prev = n > 1 ? H[n - 2][1] : null, wk = n > 5 ? H[n - 6][1] : null;
  const chips = d.assets.map((a) => { const x = d.components[a.key]; const on = x != null && x >= 1; return `<span class="mri-a${on ? ' on' : ''}" title="${esc(a.label)}：下跌強度 ${x == null ? 'N/A' : x.toFixed(2)}">${esc(a.label)}</span>`; }).join('');
  const chg = prev == null ? '' : `前一日 ${prev.toFixed(1)}${wk != null ? `｜一週前 ${wk.toFixed(1)}` : ''}`;
  return `
          <a class="mri-card" href="indicators/mri.html" aria-label="MOMO 市場共振指數 ${d.value.toFixed(1)}，${b.name}，了解 MRI">
            <div class="mri-hd"><b>MOMO 市場共振指數 MRI</b><time datetime="${d.as_of}">${d.as_of}</time></div>
            ${gauge(d.value, { w: 240, dark: true, id: 'mri-h' })}
            <div class="mri-val"><strong>${d.value.toFixed(1)}</strong><span class="mri-band b-${b.key}">${b.icon} ${b.name}</span></div>
            <p class="mri-note">${esc(b.note)}${d.participating_assets ? `｜今天 ${d.participating_assets} 類資產明顯下跌` : ''}</p>
            <div class="mri-assets">${chips}</div>
            <div class="mri-ft"><span>${chg}</span><span class="go">了解 MRI →</span></div>
          </a>
          `;
}

// ---------- 走勢圖 ----------
const MA = 10;   // 走勢圖的平滑天數（只影響圖，不改變 MRI 本身）
const EVENTS = [['2020-02-24', '2020 疫情'], ['2022-09-19', '2022 升息'], ['2025-04-04', '2025 關稅'], ['2026-11-17', '2026/11']];
function chart(H, { id, title }) {
  const W = 760, Ht = 220, L = 34, R = 10, T = 12, B = 26, iw = W - L - R, ih = Ht - T - B;
  const t0 = Date.parse(H[0][0]), t1 = Date.parse(H[H.length - 1][0]), span = Math.max(1, t1 - t0);
  const X = (d) => L + (Date.parse(d) - t0) / span * iw, Y = (v) => T + (1 - v / 100) * ih;
  let lo = 0;
  const bands = BANDS.map((b) => { const hi = Math.min(100, b.max); const r = `<rect x="${L}" y="${Y(hi).toFixed(1)}" width="${iw}" height="${(Y(lo) - Y(hi)).toFixed(1)}" fill="${b.color}" opacity=".10"/>`; lo = hi; return r; }).join('');
  const grid = [0, 40, 60, 80, 95, 100].map((v) => `<line x1="${L}" x2="${L + iw}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="#e4dccb" stroke-width="1"/>${v === 95 ? '' : `<text x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" font-size="10" fill="#7a8296" text-anchor="end">${v}</text>`}`).join('');
  const long = span > 3 * 365 * 864e5;
  const ticks = [];
  const s = new Date(t0), e = new Date(t1);
  if (long) { for (let y = s.getUTCFullYear() + 1; y <= e.getUTCFullYear(); y++) ticks.push([`${y}-01-01`, String(y)]); }
  else { const c = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1)); while (c <= e) { if (c.getUTCMonth() % 2 === 0) ticks.push([c.toISOString().slice(0, 10), `${c.getUTCFullYear() % 100}/${c.getUTCMonth() + 1}`]); c.setUTCMonth(c.getUTCMonth() + 1); } }
  const xt = ticks.map(([d, l]) => `<text x="${X(d).toFixed(1)}" y="${Ht - 8}" font-size="10" fill="#7a8296" text-anchor="middle">${l}</text>`).join('');
  const pts = H.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ');
  const mpts = H.filter((p) => p[3] != null).map((p) => `${X(p[0]).toFixed(1)},${Y(p[3]).toFixed(1)}`).join(' ');
  const ev = EVENTS.filter(([d]) => Date.parse(d) >= t0 && Date.parse(d) <= t1).map(([d, l]) => `<line x1="${X(d).toFixed(1)}" x2="${X(d).toFixed(1)}" y1="${T}" y2="${T + ih}" stroke="#0c152a" stroke-dasharray="3 3" opacity=".45"/><text x="${(X(d) > L + iw - 60 ? X(d) - 4 : X(d) + 4).toFixed(1)}" y="${T + 11}" font-size="10" fill="#0c152a" text-anchor="${X(d) > L + iw - 60 ? 'end' : 'start'}">${l}</text>`).join('');
  return `<figure class="mri-chart"><figcaption>${esc(title)}<span class="lg"><i class="lg-ma"></i>${MA} 日平均</span><span class="lg"><i class="lg-d"></i>每日數值</span></figcaption><svg id="${id}" viewBox="0 0 ${W} ${Ht}" role="img" aria-label="${esc(title)}" data-t0="${t0}" data-t1="${t1}" data-l="${L}" data-iw="${iw}">${bands}${grid}${xt}${ev}<polyline points="${pts}" fill="none" stroke="#9aa3b5" stroke-width="${long ? 0.5 : 0.9}" stroke-linejoin="round" opacity="${long ? 0.45 : 0.7}"/><polyline points="${mpts}" fill="none" stroke="#0c152a" stroke-width="${long ? 1.6 : 2.4}" stroke-linejoin="round"/><g class="mri-hover" style="display:none"><line y1="${T}" y2="${T + ih}" stroke="#a88a3d"/><circle r="4" fill="#a88a3d"/></g></svg><div class="mri-tip" hidden></div></figure>`;
}

// ---------- 說明頁數據區 ----------
function pageBlock(d) {
  const b = band(d.value), H = d.history, n = H.length;
  const prev = n > 1 ? H[n - 2] : null, wk = n > 5 ? H[n - 6] : null, mo = n > 21 ? H[n - 22] : null;
  const comp = d.assets.map((a) => {
    const x = d.components[a.key], w = x == null ? 0 : Math.min(100, x / 4 * 100);
    return `<div class="cp${x != null && x >= 1 ? ' on' : ''}"><span class="cl">${esc(a.label)}</span><span class="cb"><i style="width:${w.toFixed(0)}%"></i></span><span class="cv">${x == null ? 'N/A' : x.toFixed(2)}</span></div>`;
  }).join('');
  const HM = H.map((p, i) => { if (i < MA - 1) return [p[0], p[1], p[2], null]; let t = 0; for (let k = i - MA + 1; k <= i; k++) t += H[k][1]; return [p[0], p[1], p[2], Math.round(t / MA * 10) / 10]; });
  const last1y = HM.filter((p) => Date.parse(p[0]) >= Date.parse(d.as_of) - 365 * 864e5);
  const longChart = Date.parse(d.as_of) - Date.parse(H[0][0]) > 3 * 365 * 864e5;
  const rows = (d.summary || []).map((s) => `<tr${s.band === '全部' ? ' class="all"' : ''}><td>${esc(s.band)}</td><td>${s.days.toLocaleString('en-US')}</td><td>${pct(s.f20)}</td><td>${pc0(s.up20)}</td><td>${pct(s.f60)}</td><td>${pc0(s.up60)}</td><td>${pct(s.worst60)}</td></tr>`).join('');
  return `
      <section class="mri-now" aria-labelledby="now-t">
        <h2 id="now-t" class="sr">今天的 MRI</h2>
        <div class="now-g">${gauge(d.value, { w: 300, dark: false, id: 'mri-p' })}
          <div class="now-v"><strong>${d.value.toFixed(1)}</strong><span class="mri-band b-${b.key}">${b.icon} ${b.name}</span><p>${esc(b.note)}</p><p class="asof">資料日期 <time datetime="${d.as_of}">${d.as_of}</time>｜方法版本 v${esc(d.method_version)}</p></div>
        </div>
        <div class="now-k">
          <div><span>前一日</span><b>${prev ? prev[1].toFixed(1) : '—'}</b></div>
          <div><span>一週前</span><b>${wk ? wk[1].toFixed(1) : '—'}</b></div>
          <div><span>一個月前</span><b>${mo ? mo[1].toFixed(1) : '—'}</b></div>
          <div><span>明顯下跌資產</span><b>${d.participating_assets} / 6</b></div>
        </div>
        <h3>六類資產今天的下跌強度</h3>
        <p class="hint">數值是近 5 個交易日的跌幅除以該資產平常的波動；1 以上代表「比平常明顯的下跌」，0 代表沒有下跌。</p>
        <div class="comp">${comp}</div>
      </section>
      <section aria-labelledby="hist-t">
        <h2 id="hist-t">歷史走勢</h2>
        ${chart(last1y, { id: 'mri-c1', title: '近一年 MRI' })}
        ${longChart ? chart(HM, { id: 'mri-c2', title: `${H[0][0].slice(0, 4)} 年至今 MRI（虛線為重大事件）` }) : ''}
      </section>
      <script type="application/json" id="mri-data">${JSON.stringify({ c1: last1y.map((p) => [p[0], p[1], p[3]]), c2: longChart ? HM.map((p) => [p[0], p[1], p[3]]) : [] })}</script>
      ${rows ? `<section aria-labelledby="bt-t">
        <h2 id="bt-t">燈號分組的歷史統計</h2>
        <div class="risk"><b>投資風險提示</b>：以下為 ${esc(d.sample)} 的<b>樣本內歷史回測</b>，以六類資產代理標的等權平均計算；前瞻報酬期間重疊、天數不獨立，<b>不代表未來結果，也不是進出場建議</b>。投資一定有風險，基金投資有賺有賠，申購前應詳閱公開說明書。</div>
        <div class="tw"><table class="bt"><thead><tr><th>MRI 燈號</th><th>天數</th><th>之後 20 日平均</th><th>20 日上漲比例</th><th>之後 60 日平均</th><th>60 日上漲比例</th><th>60 日最差</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="hint">怎麼讀：各燈號之後的平均報酬差異不大，<b>單看 MRI 數值不能判斷進場時機</b>。比較不同的是「歷史極端」：之後 60 日上漲比例明顯低於全部樣本，代表極端共振出現時，市場通常還在震盪，不一定是底部。</p>
      </section>` : ''}`;
}

// ---------- main ----------
async function load() {
  if (process.env.MRI_MOCK) return { d: JSON.parse(await readFile(process.env.MRI_MOCK, 'utf8')), live: false };
  try {
    const res = await fetch(API, { redirect: 'follow' });
    const j = await res.json();
    if (j && j.ok && j.history && j.history.length) return { d: j, live: true };
    console.warn('MRI API 未回傳資料：' + JSON.stringify(j).slice(0, 200));
  } catch (e) { console.warn('MRI API 失敗：' + e.message); }
  const prevFile = existsSync(F('data/mri.json')) ? 'data/mri.json' : 'data/mri-seed.json';
  console.warn('沿用 ' + prevFile);
  return { d: JSON.parse(await readFile(F(prevFile), 'utf8')), live: false };
}

const { d, live } = await load();
if (live) await writeFile(F('data/mri.json'), JSON.stringify(d));

const rep = (html, tag, body) => {
  const re = new RegExp(`(<!-- SNAP:${tag}:START -->)[\\s\\S]*?(<!-- SNAP:${tag}:END -->)`);
  if (!re.test(html)) throw new Error('找不到 SNAP:' + tag);
  return html.replace(re, `$1${body}$2`);
};

let home = await readFile(F('index.html'), 'utf8');
home = rep(home, 'MRI', heroCard(d));
await writeFile(F('index.html'), home);

const hb = band(d.value);
let hub = await readFile(F('indicators/index.html'), 'utf8');
hub = rep(hub, 'MRIHUB', `
        <a class="ind" href="mri.html">
          <span class="ind-name">MOMO 市場共振指數（MRI）</span>
          <span class="ind-val">${d.value.toFixed(1)}</span>
          <span class="ind-meta"><span class="tag">${hb.icon} ${hb.name}</span></span>
          <span class="ind-desc">MOMO 自主設計：美股、台股、歐股、高收益債、公債、黃金是否一起下跌（0～100）。</span>
          <span class="ind-foot"><span>資料日期 <time datetime="${d.as_of}">${d.as_of.replace(/-/g, '/')}</time></span><span class="go">看說明 →</span></span>
        </a>
    `);
await writeFile(F('indicators/index.html'), hub);

let page = await readFile(F('indicators/mri.html'), 'utf8');
page = rep(page, 'MRIPAGE', pageBlock(d))
  .replace(/(<span class="js-mri-v">)[^<]*(<\/span>)/g, `$1${d.value.toFixed(1)}$2`)
  .replace(/(<span class="js-mri-b">)[^<]*(<\/span>)/g, `$1${band(d.value).name}$2`)
  .replace(/(<span class="js-mri-d">)[^<]*(<\/span>)/g, `$1${d.as_of}$2`)
  .replace(/("dateModified": ")[^"]*(")/, `$1${d.as_of}$2`);
await writeFile(F('indicators/mri.html'), page);

let sm = await readFile(F('sitemap.xml'), 'utf8');
if (!sm.includes(URL_)) sm = sm.replace('</urlset>', `  <url><loc>${URL_}</loc><lastmod>${d.as_of}</lastmod></url>\n</urlset>`);
sm = sm.replace(new RegExp(`(<loc>${URL_.replace(/[.]/g, '\\.')}</loc><lastmod>)[\\d-]+(</lastmod>)`), `$1${d.as_of}$2`);
await writeFile(F('sitemap.xml'), sm);

let llms = await readFile(F('llms.txt'), 'utf8');
const b = band(d.value);
const line = `- [MOMO 市場共振指數 MRI](${URL_})：MOMO 自主設計的市場狀態溫度計（0～100），衡量美股、台股、歐股、高收益債、美國公債、黃金六類資產是否「一起下跌」。截至 ${d.as_of}，MRI 為 ${d.value.toFixed(1)}（${b.name}），${d.participating_assets} 類資產明顯下跌。MRI 是描述性指標，不是崩盤機率或買賣訊號；歷史回測為樣本內研究，不代表未來結果。`;
const lre = /(<!-- SNAP:MRILLMS:START -->)[\s\S]*?(<!-- SNAP:MRILLMS:END -->)/;
llms = lre.test(llms) ? llms.replace(lre, `$1\n${line}\n$2`) : llms.includes('<!-- SNAP:DHLLMS:END -->') ? llms.replace('<!-- SNAP:DHLLMS:END -->', `<!-- SNAP:DHLLMS:END -->\n<!-- SNAP:MRILLMS:START -->\n${line}\n<!-- SNAP:MRILLMS:END -->`) : llms.trimEnd() + `\n\n<!-- SNAP:MRILLMS:START -->\n${line}\n<!-- SNAP:MRILLMS:END -->\n`;
await writeFile(F('llms.txt'), llms);

console.log(`MRI 快照：${d.as_of}｜${d.value}（${b.name}）｜${d.history.length} 筆${live ? '' : '（沿用舊資料）'}`);
