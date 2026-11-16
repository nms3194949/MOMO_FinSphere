// ============================================================
// MOMO財商智庫｜配息基金健康度報告  scripts/dividend-health.mjs
// 由 GitHub Actions（每日數據快照）執行：
//   從 moneyDJ爬蟲整合（GAS）讀 get_dividend_report：每檔只有類別與數字（不含名稱）
//   → 依類別統計 → 寫進 tools/dividend-health.html 的 SNAP:DH，並更新 sitemap、llms.txt
// 本機測試：DH_MOCK=fixture.json node scripts/dividend-health.mjs
// ============================================================

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://script.google.com/macros/s/AKfycbwUk4wagt8SSchnpz8oqj1XkgfGM2--9M41WBlZGUpsT29dtdv1wV55nowk37ClEmlxyw/exec?op=get_dividend_report';
const PAGE = path.join(ROOT, 'tools/dividend-health.html');
const URL_ = 'https://momowinwin.com/MOMO_FinSphere/tools/dividend-health.html';
const DIS = '統計範圍為 MOMO 追蹤中的配息基金，過去績效不代表未來表現，不構成投資建議';
const ORDER = ['非投資等級債', '新興市場債', '多元債券', '多重資產', '股票'];

const pct = (x, dp = 1) => (x == null || !isFinite(x) ? '—' : (x >= 0 ? '+' : '') + (x * 100).toFixed(dp) + '%');
const pc0 = (x) => (x == null || !isFinite(x) ? '—' : Math.round(x * 100) + '%');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cls = (x) => (x == null || !isFinite(x) ? '' : x >= 0 ? ' class="up"' : ' class="dn"');
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const share = (arr, f) => { const v = arr.filter((x) => x != null); return v.length ? v.filter(f).length / v.length : null; };

async function load() {
  if (process.env.DH_MOCK) return JSON.parse(await readFile(process.env.DH_MOCK, 'utf8'));
  const res = await fetch(API, { redirect: 'follow' });
  if (!res.ok) throw new Error('API ' + res.status);
  return res.json();
}

function stats(fs) {
  const y = fs.map((f) => f.yield).filter((v) => v != null && isFinite(v)).map((v) => v / 100);
  const nav = fs.map((f) => f.nav1y).filter((v) => v != null);
  const tr = fs.map((f) => f.tr1y).filter((v) => v != null);
  const gap = fs.filter((f) => f.yield != null && f.tr1y != null);
  return {
    n: fs.length,
    yield: mean(y),
    cut: share(fs.map((f) => f.cut), (v) => v === true),
    navDown: share(fs.map((f) => f.nav1y), (v) => v < 0),
    nav: mean(nav),
    tr: mean(tr),
    overPay: gap.length ? gap.filter((f) => f.yield / 100 > f.tr1y).length / gap.length : null
  };
}

function bars(cats) {
  const max = Math.max(0.01, ...cats.flatMap((c) => [c.s.yield || 0, Math.abs(c.s.tr || 0)]));
  const w = (v) => Math.min(100, (Math.abs(v || 0) / max) * 58);
  return `<div class="bars" role="img" aria-label="各類型平均配息率與近一年含息總報酬">
${cats.map((c) => `<div class="row"><div class="lab">${esc(c.cat)}<small>${c.s.n} 檔</small></div><div>
<div class="b y"><i style="width:${w(c.s.yield).toFixed(1)}%"></i><span style="left:calc(${w(c.s.yield).toFixed(1)}% + 6px)">配息率 ${pc0(c.s.yield)}</span></div>
<div class="b t"><i class="${(c.s.tr || 0) < 0 ? 'neg' : ''}" style="width:${w(c.s.tr).toFixed(1)}%"></i><span style="left:calc(${w(c.s.tr).toFixed(1)}% + 6px)">含息總報酬 ${pct(c.s.tr)}</span></div>
</div></div>`).join('\n')}
<div class="key"><span><i style="background:#fad291"></i>平均年化配息率</span><span><i style="background:#bddaf5"></i>近一年含息總報酬</span></div></div>`;
}

function render(d) {
  const a = d.all;
  const lead = `截至 ${d.asof}，MOMO 追蹤的 ${a.n} 檔配息基金平均年化配息率約 ${pc0(a.yield)}；近一年有 ${pc0(a.cut)} 調降過配息，${pc0(a.navDown)} 的淨值下跌，${pc0(a.overPay)} 的配息率高於近一年含息總報酬（多配的部分來自本金）（${DIS}）。`;
  const rows = d.cats.map((c) => `<tr><th scope="row">${esc(c.cat)}<small>${c.s.n} 檔</small></th><td>${pc0(c.s.yield)}</td><td>${pc0(c.s.cut)}</td><td${cls(c.s.nav)}>${pct(c.s.nav)}</td><td${cls(c.s.tr)}>${pct(c.s.tr)}</td></tr>`).join('');
  const best = d.cats.filter((c) => c.s.tr != null && c.s.yield != null).sort((x, y) => (y.s.tr - y.s.yield) - (x.s.tr - x.s.yield));
  const ds = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: '配息基金健康度：各類型配息率、配息調降比例與含息總報酬',
    description: lead, url: URL_,
    creator: { '@id': 'https://momowinwin.com/momo-blog/about/#person' },
    dateModified: d.asof, isAccessibleForFree: true,
    variableMeasured: ['平均年化配息率', '近一年配息調降比例', '近一年淨值變化', '近一年含息總報酬'],
    measurementTechnique: '依 MOMO 基金資料庫的每日淨值、調整後淨值與每次配息紀錄，依類別計算；每檔基金只取一個級別'
  };
  return `
      <script type="application/ld+json">${JSON.stringify(ds).replace(/</g, '\\u003c')}</script>
      <p class="answer" id="dh-lead">${lead}</p>
      <div class="kpis">
        <div><span>平均年化配息率</span><b>${pc0(a.yield)}</b><small>${a.n} 檔配息基金</small></div>
        <div><span>近一年調降配息</span><b>${pc0(a.cut)}</b><small>最新配息比一年前少 1% 以上</small></div>
        <div><span>近一年淨值下跌</span><b>${pc0(a.navDown)}</b><small>不含配息的淨值變化</small></div>
        <div><span>配息率高於含息報酬</span><b>${pc0(a.overPay)}</b><small>多配的部分來自本金</small></div>
      </div>

      <h2 id="cats">各類型配息基金比較</h2>
      ${bars(d.cats)}
      <div class="table-wrap" style="margin-top:12px"><table class="pf">
        <thead><tr><th>類型</th><th>平均配息率</th><th>近一年調降</th><th>淨值變化</th><th>含息總報酬</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="note">資料日期：${d.asof}｜淨值變化與含息總報酬為近一年、各類型簡單平均；含息總報酬＝淨值變化加上配息。</p>

      <h2 id="read">怎麼看這份報告？</h2>
      <p>把同一類的<b>平均配息率</b>和<b>含息總報酬</b>放在一起看：含息總報酬高於配息率，代表配息大致來自收益，淨值也比較撐得住；配息率高於含息總報酬，多配出去的部分就是在領回本金，淨值會跟著往下。${best.length ? `近一年表現最穩的是「${esc(best[0].cat)}」，含息總報酬比配息率${best[0].s.tr >= best[0].s.yield ? '高' : '低'} ${Math.abs((best[0].s.tr - best[0].s.yield) * 100).toFixed(1)} 個百分點；落差最大的是「${esc(best[best.length - 1].cat)}」。` : ''}</p>
      <p>「調降配息」不一定是壞事，常是基金公司讓配息回到實際收益的水準；真正要留意的，是配息率長期高於含息總報酬、淨值一路往下的情況。</p>`;
}

const api = await load();
if (!api.ok) throw new Error(api.error || ('API 沒有回傳配息資料（moneyDJ爬蟲整合 可能還沒加上 get_dividend_report 或還沒部署新版本）：' + JSON.stringify(api).slice(0, 200)));
const funds = api.funds.filter((f) => f.yield != null || f.nav1y != null);
if (funds.length < 5) throw new Error('可用的基金太少：' + funds.length);
const cats = ORDER.concat([...new Set(funds.map((f) => f.cat))].filter((c) => !ORDER.includes(c)))
  .map((cat) => ({ cat, s: stats(funds.filter((f) => f.cat === cat)) })).filter((c) => c.s.n > 0);
const data = { asof: api.asof, all: stats(funds), cats };

let html = await readFile(PAGE, 'utf8');
const re = /(<!-- SNAP:DH:START -->)[\s\S]*?(<!-- SNAP:DH:END -->)/;
html = html.replace(re, `$1${render(data)}\n      $2`)
  .replace(/("dateModified": ")[^"]*(")/, `$1${data.asof}$2`)
  .replace('<meta name="robots" content="noindex,follow" />', '<meta name="robots" content="index,follow" />');
await writeFile(PAGE, html);

const smFile = path.join(ROOT, 'sitemap.xml');
let sm = await readFile(smFile, 'utf8');
if (!sm.includes(URL_)) sm = sm.replace('</urlset>', `  <url><loc>${URL_}</loc><lastmod>${data.asof}</lastmod></url>\n</urlset>`);
sm = sm.replace(new RegExp(`(<loc>${URL_.replace(/[.]/g, '\\.')}</loc><lastmod>)[\\d-]+(</lastmod>)`), `$1${data.asof}$2`);
await writeFile(smFile, sm);

const lf = path.join(ROOT, 'llms.txt');
let llms = await readFile(lf, 'utf8');
const a = data.all;
const line = `- [配息基金健康度報告](${URL_})：MOMO 原創數據，每月更新。截至 ${data.asof}，追蹤的 ${a.n} 檔配息基金平均年化配息率約 ${pc0(a.yield)}；近一年 ${pc0(a.cut)} 調降過配息、${pc0(a.navDown)} 淨值下跌、${pc0(a.overPay)} 配息率高於含息總報酬。各類型：${data.cats.map((c) => `${c.cat} 配息率 ${pc0(c.s.yield)}／含息總報酬 ${pct(c.s.tr)}`).join('；')}。${DIS}。`;
const lre = /(<!-- SNAP:DHLLMS:START -->)[\s\S]*?(<!-- SNAP:DHLLMS:END -->)/;
llms = lre.test(llms) ? llms.replace(lre, `$1\n${line}\n$2`) : llms.replace('<!-- SNAP:PFLLMS:END -->', `<!-- SNAP:PFLLMS:END -->\n<!-- SNAP:DHLLMS:START -->\n${line}\n<!-- SNAP:DHLLMS:END -->`);
await writeFile(lf, llms);
console.log(`配息健康度快照：${data.asof}｜${a.n} 檔｜平均配息率 ${pc0(a.yield)}｜近一年調降 ${pc0(a.cut)}`);
