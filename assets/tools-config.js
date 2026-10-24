// assets/tools-config.js
// 工具清單：首頁「數據與分析工具」與 tools/ 總覽頁共用
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
    showOnHome: false
  },
  {
    id: "dividend-simulator",
    category: "calc",
    label: "試算",
    title: "配息計算機",
    desc: "依本金與配息率推算每月配息現金流。",
    href: "/MOMO_FinSphere/tools/dividend-simulator.html",
    showOnHome: false
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
    id: "macro-compass",
    category: "market",
    label: "景氣",
    title: "MOMO景氣羅盤",
    desc: "追蹤總體經濟指標的變化，了解目前所處的景氣位置。",
    href: "/MOMO_FinSphere/tools/Macro-Compass.html",
    showOnHome: true
  },
  {
    id: "mcs-cycle-dashboard",
    category: "market",
    label: "景氣",
    title: "MCS 景氣循環儀表板",
    desc: "以信用、利率、流動性等因子計算景氣分數與象限。",
    href: "/MOMO_FinSphere/tools/msc-score.html",
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
    id: "fund-radar",
    category: "fund",
    label: "基金數據",
    title: "基金監控雷達",
    desc: "追蹤基金淨值與指標變化，以數據觀察波動與趨勢。",
    href: "/MOMO_FinSphere/tools/fund_radar.html",
    showOnHome: true
  },
  {
    id: "wealth-simulator",
    category: "fund",
    label: "配置推演",
    title: "雙贏策略模擬",
    desc: "比較不同配置方案的歷史推演，觀察風險與現金流的差異。",
    href: "/MOMO_FinSphere/tools/MOMO-Wealth-Simulator.html",
    showOnHome: false
  },
  {
    id: "etf-dashboard",
    category: "fund",
    label: "ETF 數據",
    title: "台股ETF監控",
    desc: "整理台股 ETF 的報酬與配息資料，方便橫向比較。",
    href: "/MOMO_FinSphere/tools/etf-dashboard.html",
    showOnHome: true
  },
  {
    id: "warrant-api",
    category: "other",
    label: "權證數據",
    title: "權證篩選 API",
    desc: "串接權證資料，自動解析並過濾異常數據。",
    href: "/MOMO_FinSphere/tools/warrant-api.html",
    showOnHome: false
  },
  {
    id: "bazi",
    category: "other",
    label: "其他",
    title: "八字推算",
    desc: "八字批次推算小工具。",
    href: "/MOMO_FinSphere/tools/MOMO_Bazi.html",
    showOnHome: false
  }
];
