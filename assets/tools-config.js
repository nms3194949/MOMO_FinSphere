// 統一管理 MOMO 財商智庫的工具清單
// 之後有新工具只要在這裡加一筆，就會自動出現在首頁 & 工具首頁

const MOMO_TOOLS = [
  {
    id: "btc-trigger",
    name: "BTC/ETH 進場策略",
    url: "./btc-rebound-trigger.html",
    category: "crypto",                    // 加密策略
    mainTag: "加密策略",
    tags: ["策略回測"],                    // 不再放「本站工具 / 外部服務」
    description: "即時監控加密市場回撤與進出場策略，支援槓桿模擬與回撤進場條件。"
  },
  {
    id: "cagr-mobile",
    name: "基金 AI 智能分析",
    url: "./cagr-mobile.html",
    category: "fund",                      // 基金工具
    mainTag: "基金工具",
    tags: ["CAGR", "差異指標"],
    description: "基金投組試算、CAGR、配息覆蓋與差異指標一鍵分析，支援匯出圖表。"
  },
  {
    id: "fund-yield-matrix",
    name: "基金配息矩陣",
    url: "./fund-yield-matrix.html",
    category: "fund",
    mainTag: "基金工具",
    tags: ["配息矩陣"],
    description: "用配息率 × 年化報酬 × 現金流矩陣，快速對比不同基金組合的月配息與長期報酬。"
  },
  {
    id: "warrant-api",
    name: "權證篩選 API",
    url: "https://warrant-render-proxy-1.onrender.com/",
    category: "warrant",                   // 權證工具
    mainTag: "權證工具",
    tags: ["外部 API"],                    // 這裡也不再放「外部服務」等字樣
    description: "串接權證 API，自動解析與過濾異常數據，快速找到目標權證。",
    external: true                         // 只用來決定是否開新分頁
  }
];
