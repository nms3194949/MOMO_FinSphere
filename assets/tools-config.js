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
    showOnHome: false
  },
  {
    id: "fund-yield-matrix",
    category: "fund",
    title: "基金配息矩陣",
    desc: "配息率 × 年化報酬 × 現金流矩陣，快速比一輪。",
    href: "/MOMO_FinSphere/tools/fund-yield-matrix.html",
    showOnHome: false
  },
  {
    // [修正 1] 修改了重複的 ID，並對應到功能名稱
    id: "mcs-cycle-dashboard", 
    category: "fund",
    title: "MCS 景氣循環儀表板",
    desc: "依照景氣循環來做資產配置",
    href: "/MOMO_FinSphere/tools/msc-score.html",
    showOnHome: false
  },
  {
    id: "warrant-api",
    category: "warrant",
    title: "權證篩選 API",
    desc: "串接權證 API，自動解析過濾異常數據。",
    href: "/MOMO_FinSphere/tools/warrant-api.html",
    external: true,
    showOnHome: false
  },
  {
    // [修正 2] 統一 ID 命名風格 (原本是 Macro-Compas) 並修正拼字
    id: "macro-compass",
    category: "fund",
    title: "MOMO景氣羅盤",
    desc: "監控景氣變化，找到長期適合的策略。",
    href: "/MOMO_FinSphere/tools/Macro-Compass.html",
    external: true,
    showOnHome: true
  },
    {
    id: "fund-radar",
    category: "fund",
    title: "雙贏策略",
    desc: "風險與收益間找到最佳平衡點。",
    href: "/MOMO_FinSphere/tools/MOMO-Wealth-Simulator.html",
    external: true,
    showOnHome: true
  },
  {
    // [修正 3] 統一 ID 命名風格 (原本是 fund_radar)
    id: "fund-radar",
    category: "fund",
    title: "基金監控雷達",
    desc: "監控基金變化，找到甜蜜買點。",
    href: "/MOMO_FinSphere/tools/fund_radar.html",
    external: true,
    showOnHome: true
  },
  {
    id: "etf-dashboard",
    // [修正 4] 統一 Category 大小寫 (依據你的偏好，這裡保持 ETF 或改為 etf 皆可，建議統一)
    category: "ETF",
    title: "台股ETF監控",
    desc: "監控ETF報酬，找出最佳投資點。",
    href: "/MOMO_FinSphere/tools/etf-dashboard.html",
    external: true,
    showOnHome: true
  }
];
