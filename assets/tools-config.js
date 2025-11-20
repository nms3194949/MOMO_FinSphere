// assets/tools-config.js
window.MOMO_TOOLS_CONFIG = [
  {
    id: "btc-trigger",
    category: "crypto",          // 加密策略
    title: "BTC/ETH 進場策略",
    desc: "即時監控加密市場回撤與進出場策略。",
    href: "/MOMO_FinSphere/tools/btc-rebound-trigger.html",
    showOnHome: false
  },
  {
    id: "fund-cagr",
    category: "fund",
    title: "基金 AI 智能分析",
    desc: "基金投組試算，CAGR 與指標一鍵分析。",
    href: "/MOMO_FinSphere/tools/cagr-mobile.html",
    showOnHome: true
  },
  {
    id: "fund-yield-matrix",
    category: "fund",
    title: "基金配息矩陣",
    desc: "配息率 × 年化報酬 × 現金流矩陣，快速比一輪。",
    href: "/MOMO_FinSphere/tools/fund-yield-matrix.html",
    showOnHome: true
  },
  {
    id: "fund-yield-matrix",
    category: "fund",
    title: "MCS 景氣循環儀表板",
    desc: "依照景氣循環來做資產配置",
    href: "/MOMO_FinSphere/tools/msc-score.html",
    showOnHome: true
  },
  {
    id: "warrant-api",
    category: "warrant",
    title: "權證篩選 API",
    desc: "串接權證 API，自動解析過濾異常數據。",
    href: "https://warrant-render-proxy-1.onrender.com/",
    external: true,
    showOnHome: false          // 例如：只在工具總覽列出，不出現在首頁
  }
];
