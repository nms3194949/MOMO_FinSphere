// assets/tools-config.js
// 統一維護 MOMO 智庫的所有「智能工具」清單
// 首頁、tools/index.html 都會讀這份設定

window.MOMO_TOOLS = [
  {
    id: 'btc-trigger',
    title: 'BTC/ETH 進場策略',
    desc: '即時監控加密市場回撤與進出場策略，支援槓桿模擬與回撤進場條件。',
    // 對於站內工具，用 path（不要加 ./ 或 ../）
    path: 'tools/btc-rebound-trigger.html',
    category: 'crypto',          // crypto | fund | warrant | other
    featured: true,              // true：會出現在首頁「智能工具」區
    external: false,
    badge: '策略回測'
  },
  {
    id: 'cagr-mobile',
    title: '基金 AI 智能分析',
    desc: '基金投組試算，CAGR、配息覆蓋與差異指標一鍵分析，支援匯出圖表。',
    path: 'tools/cagr-mobile.html',
    category: 'fund',
    featured: true,
    external: false,
    badge: '基金工具'
  },
  {
    id: 'fund-yield-matrix',
    title: '基金配息矩陣',
    desc: '用配息率 × 年化報酬 × 現金流矩陣，快速對比不同基金與組合的月配息與長期報酬。',
    path: 'tools/fund-yield-matrix.html',
    category: 'fund',
    featured: false,        // 想讓它出現在首頁智能工具區就改成 true
    external: false,
    badge: '配息矩陣'
  },
  {
    id: 'warrant-api',
    title: '權證篩選 API',
    desc: '串接權證 API，自動解析與過濾異常數據，快速找到目標權證。',
    // 外部工具可直接用完整網址
    url: 'https://warrant-render-proxy-1.onrender.com/',
    category: 'warrant',
    featured: false,             // 例如只在工具總覽頁顯示，不放首頁
    external: true,
    badge: '外部工具'
  }

  // 之後新增工具只要在這裡多加一個物件，例如：
  //
  // {
  //   id: 'fund-screener',
  //   title: '基金體質篩選器',
  //   desc: '依報酬、波動、配息紀錄與相關係數自動找出體質佳的基金。',
  //   path: 'tools/fund-screener.html',
  //   category: 'fund',
  //   featured: true,
  //   external: false,
  //   badge: 'NEW'
  // }
];
