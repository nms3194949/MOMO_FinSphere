// 指標數據檢查：確認 4 個指標常青頁需要的近 1 年 FRED 數據都抓得到
// 只讀取、不修改任何檔案。執行：FRED_API_KEY=金鑰 node scripts/check-indicators.mjs
const KEY = process.env.FRED_API_KEY;
if (!KEY) { console.error('❌ 缺少 FRED_API_KEY'); process.exit(1); }

const SERIES = [
  ['DGS10',        '美債10年殖利率', 'daily'],
  ['DGS2',         '美債2年殖利率', 'daily'],
  ['T10Y2Y',       '10年−2年利差', 'daily'],
  ['UNRATE',       '美國失業率', 'monthly'],
  ['DFEDTARU',     '聯邦基金利率上限', 'daily'],
  ['DFEDTARL',     '聯邦基金利率下限', 'daily'],
  ['CPIAUCSL',     'CPI（算年增率用）', 'monthly'],
];

const today = new Date();
const start = new Date(today); start.setDate(start.getDate() - 400); // 1 年＋緩衝（CPI 年增率要多 12 個月）
const startStr = start.toISOString().slice(0, 10);
const startCpi = new Date(today); startCpi.setMonth(startCpi.getMonth() - 26);

let ok = 0;
console.log(`檢查日期：${today.toISOString().slice(0, 10)}（抓取 ${startStr} 起的資料）\n`);
for (const [id, name, freq] of SERIES) {
  const from = freq === 'monthly' ? startCpi.toISOString().slice(0, 10) : startStr;
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${KEY}&file_type=json&observation_start=${from}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const obs = (await res.json()).observations.filter((o) => o.value !== '.');
    if (!obs.length) throw new Error('沒有資料');
    const first = obs[0], last = obs[obs.length - 1];
    // 最大缺口（天）
    let gap = 0;
    for (let i = 1; i < obs.length; i++) gap = Math.max(gap, (Date.parse(obs[i].date) - Date.parse(obs[i - 1].date)) / 864e5);
    const lagDays = Math.round((today - Date.parse(last.date)) / 864e5);
    const enough = freq === 'monthly' ? obs.length >= 24 : obs.length >= 240;
    if (enough) ok++;
    console.log(`${enough ? '✅' : '⚠️'} ${name}（${id}）`);
    console.log(`   筆數 ${obs.length}｜最早 ${first.date} = ${first.value}｜最新 ${last.date} = ${last.value}｜最新資料距今 ${lagDays} 天｜最大缺口 ${gap} 天\n`);
  } catch (err) {
    console.log(`❌ ${name}（${id}）：${err.message}\n`);
  }
}
console.log(`結果：${ok} / ${SERIES.length} 個指標的近 1 年資料完整`);
if (ok < SERIES.length) process.exitCode = 1;
