// assets/tools-config.js
// 公開工具清單：首頁「數據與分析工具」與 tools/ 總覽頁共用
// 自用工具不放這裡，放在 me/index.html（有密碼）
// category：分類篩選用｜label：卡片上的小標籤｜showOnHome：首頁顯示（最多 6 個）
// 文字原則：描述工具「做什麼」，不寫買賣時機、報酬承諾或配置建議
window.MOMO_TOOLS_CONFIG = [
  {
    id: "dividend-calculator",
    category: "calc",
    label: "試算",
    title: "配息現金流試算",
    desc: "輸入本金、配息率與總報酬假設（最高 6%），看每月配息與淨值變化。",
    href: "/MOMO_FinSphere/dividend-calculator.html",
    showOnHome: true
  },
  {
    id: "double-dip",
    category: "calc",
    label: "試算",
    title: "一魚雙吃",
    desc: "兩類配息基金的比例試算，看配息現金流如何分配。",
    href: "/MOMO_FinSphere/tools/double-dip.html",
    showOnHome: true
  },
  {
    id: "cycle",
    category: "market",
    label: "景氣",
    title: "景氣循環儀表板",
    desc: "短週期看 MCS 景氣分數，長週期看雙週期景氣羅盤，同一頁對照目前位置。",
    href: "/MOMO_FinSphere/tools/cycle.html",
    showOnHome: true
  },
  {
    id: "seasonality",
    category: "market",
    label: "季節性",
    title: "長周期交易平均",
    desc: "統計各市場長期的月份與季節性表現，觀察歷史規律。",
    href: "/MOMO_FinSphere/tools/seasonality.html",
    showOnHome: true
  },
  {
    id: "etf-dashboard",
    category: "fund",
    label: "ETF 數據",
    title: "台股ETF監控",
    desc: "整理台股 ETF 的報酬與配息資料，方便橫向比較。",
    href: "/MOMO_FinSphere/tools/etf-dashboard.html",
    showOnHome: true
  }
];
