# MOMO雙贏策略｜工具區（MOMO_FinSphere）

MOMO雙贏策略的互動工具網站：配息現金流試算、景氣儀表板、季節性分析、基金與 ETF 數據工具。

- 工具首頁：https://nms3194949.github.io/MOMO_FinSphere/
- 配置筆記（文章）：https://nms3194949.github.io/momo-blog/
- 品牌首頁：https://nms3194949.github.io/
- 官方 LINE：https://lin.ee/sdrEuGA
- Instagram：https://www.instagram.com/momo_82786/

## 檔案說明

| 檔案 | 用途 |
|---|---|
| `index.html` | 工具首頁（配息入帳紀錄、試算入口、工具列表、FAQ） |
| `dividend-calculator.html` | 配息現金流試算（總報酬假設上限 6%，畫面揭露） |
| `tools/` | 各工具頁與工具總覽頁 |
| `assets/momo-site.js` | 共用腳本：GA4、LINE/IG/Threads 點擊事件、統一頁尾與免責聲明（每頁都要載入） |
| `assets/tools-config.js` | 工具清單（首頁與總覽頁共用），新增工具改這裡 |
| `assets/tools-render.js` | 工具卡片產生器 |

## 新增工具頁時

1. 在 `</head>` 前加上：
   ```html
   <link rel="icon" href="/favicon.ico" sizes="48x48">
   <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">
   <link rel="apple-touch-icon" href="/apple-touch-icon.png">
   <script defer src="/MOMO_FinSphere/assets/momo-site.js"></script>
   ```
2. 在 `assets/tools-config.js` 加一筆工具資料
3. 在 `sitemap.xml` 加網址

## 文字原則

不使用顧問類職稱、不寫保險公司名稱、不點名推薦特定基金；報酬率假設最高 6% 並揭露；避免「保證」「穩賺」「穩定配息」「推薦買進」等字眼。

> 本網站內容僅供教育與資訊分享，不構成任何投資建議或商品推介。基金與投資型保單之投資風險由要保人自行承擔，過去績效不代表未來表現，配息率不代表報酬率，且配息可能由本金支出。投資前請詳閱商品說明書及公開說明書，並依自身財務狀況與風險承受度審慎評估。
