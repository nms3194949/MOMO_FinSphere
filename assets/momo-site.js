/*!
 * MOMO雙贏策略｜舊官網共用腳本 assets/momo-site.js
 * 1. 載入 GA4（和部落格同一個評估 ID，三個網站數據在同一個報表）
 * 2. 追蹤 LINE / IG / Threads 點擊（line_click、instagram_click、threads_click，含 link_location）
 * 3. 在每頁底部加上統一頁尾：部落格、工具、LINE、IG、Threads 連結＋免責聲明
 *    若頁面已有 <footer id="momo-footer">（例如首頁），就不再重複加。
 * 用法：<script defer src="/MOMO_FinSphere/assets/momo-site.js"></script>
 */
(function () {
  'use strict';

  var GA_ID = 'G-VEDLJKB232';
  var LINE = 'https://lin.ee/sdrEuGA';
  var IG = 'https://www.instagram.com/momo_82786/';
  var THREADS = 'https://www.threads.net/@momo_82786';
  var BLOG = '/momo-blog/';
  var TOOLS = '/MOMO_FinSphere/tools/';
  var HOME = '/MOMO_FinSphere/';
  var DISCLAIMER = '本網站內容僅供教育與資訊分享，不構成任何投資建議或商品推介。基金與投資型保單之投資風險由要保人自行承擔，過去績效不代表未來表現，配息率不代表報酬率，且配息可能由本金支出。投資前請詳閱商品說明書及公開說明書，並依自身財務狀況與風險承受度審慎評估。';

  // 頁面代號：用在 UTM 的 utm_campaign
  var page = (location.pathname.split('/').pop() || 'index').replace(/\.html?$/, '') || 'index';
  if (/\/tools\/?$/.test(location.pathname)) page = 'tools';
  var campaign = 'finsphere_' + page.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');

  function utm(url, content) {
    try {
      var u = new URL(url);
      u.searchParams.set('utm_source', 'website');
      u.searchParams.set('utm_medium', 'referral');
      u.searchParams.set('utm_campaign', campaign);
      u.searchParams.set('utm_content', content || 'cta');
      return u.toString();
    } catch (e) { return url; }
  }
  window.momoUtm = utm;

  /* ---------- 1. GA4 ---------- */
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }
  if (!window.__momoGa) {
    window.__momoGa = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
  }
  window.momoTrack = function (name, params) {
    try { window.gtag('event', name, params || {}); } catch (e) {}
  };

  /* ---------- 2. 導流點擊追蹤 ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var h = a.href || '';
    var dest = (h.indexOf('lin.ee') > -1 || h.indexOf('line.me') > -1) ? 'line'
      : h.indexOf('instagram.com') > -1 ? 'instagram'
      : h.indexOf('threads.net') > -1 ? 'threads' : '';
    if (!dest) return;
    var where = a.getAttribute('data-loc');
    if (!where) {
      var box = a.closest('.momo-footer, #momo-footer, .sticky-bar, .hero, .cta-box');
      where = !box ? 'other'
        : (box.classList.contains('momo-footer') || box.id === 'momo-footer') ? 'footer'
        : box.classList.contains('sticky-bar') ? 'sticky'
        : box.classList.contains('hero') ? 'hero' : 'cta';
    }
    window.momoTrack(dest + '_click', { link_location: where, page_path: location.pathname });
  }, true);

  /* ---------- 3. 統一頁尾 ---------- */
  function injectFooter() {
    if (document.getElementById('momo-footer') || document.querySelector('.momo-footer')) return;
    var css = document.createElement('style');
    css.textContent =
      '.momo-footer{all:initial;display:block;box-sizing:border-box;margin:40px 0 0;padding:28px 16px 36px;background:#f6f1e7;border-top:1px solid #e4dccb;color:#44506a;font:14px/1.8 -apple-system,BlinkMacSystemFont,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif;letter-spacing:.02em}' +
      '.momo-footer *{box-sizing:border-box}' +
      '.momo-footer .mf-in{max-width:960px;margin:0 auto}' +
      '.momo-footer .mf-brand{display:flex;align-items:center;gap:10px;color:#0c152a;font-weight:800;font-size:16px;text-decoration:none}' +
      '.momo-footer .mf-brand img{width:28px;height:28px;border-radius:50%}' +
      '.momo-footer .mf-links{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}' +
      '.momo-footer .mf-links a{display:inline-flex;align-items:center;padding:7px 14px;border-radius:999px;border:1.5px solid #0c152a;color:#0c152a;font-weight:700;font-size:13px;text-decoration:none;background:transparent}' +
      '.momo-footer .mf-links a.mf-line{background:#06c755;border-color:#06c755;color:#fff}' +
      '.momo-footer .mf-links a:hover{opacity:.85}' +
      '.momo-footer .mf-disc{margin:0;color:#7a8296;font-size:12.5px;line-height:1.8}' +
      '.momo-footer .mf-copy{margin:10px 0 0;color:#7a8296;font-size:12px}';
    document.head.appendChild(css);

    var f = document.createElement('footer');
    f.className = 'momo-footer';
    f.setAttribute('role', 'contentinfo');
    f.innerHTML =
      '<div class="mf-in">' +
        '<a class="mf-brand" href="' + HOME + '"><img src="/icon-96.png" alt="" width="28" height="28">MOMO雙贏策略</a>' +
        '<div class="mf-links">' +
          '<a href="' + BLOG + '">配置筆記（文章）</a>' +
          '<a href="' + TOOLS + '">所有工具</a>' +
          '<a class="mf-line" href="' + utm(LINE, 'footer') + '" target="_blank" rel="noopener">加入官方 LINE</a>' +
          '<a href="' + utm(IG, 'footer') + '" target="_blank" rel="noopener">Instagram</a>' +
          '<a href="' + utm(THREADS, 'footer') + '" target="_blank" rel="noopener">Threads</a>' +
        '</div>' +
        '<p class="mf-disc">' + DISCLAIMER + '</p>' +
        '<p class="mf-copy">© ' + new Date().getFullYear() + ' MOMO雙贏策略｜保單基金規劃・資產配置教育</p>' +
      '</div>';
    document.body.appendChild(f);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectFooter);
  else injectFooter();
})();
