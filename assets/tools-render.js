// assets/tools-render.js
// 讀 assets/tools-config.js，產生工具卡片
// 首頁：MOMO_TOOLS.initHomeSection()（#home-tools-grid，showOnHome 前 6 個）
// 總覽頁：MOMO_TOOLS.initToolsPage()（#tools-grid，含分類篩選 [data-tools-filter]）
(function () {
  var CONFIG = (window.MOMO_TOOLS_CONFIG || []).slice();

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function card(t) {
    var a = document.createElement('a');
    a.className = 'tool-card';
    a.href = t.href;
    a.innerHTML =
      '<span class="tool-pill">' + esc(t.label || '工具') + '</span>' +
      '<h3 class="tool-title">' + esc(t.title) + '</h3>' +
      '<p class="tool-desc">' + esc(t.desc) + '</p>' +
      '<span class="tool-go">開啟工具 →</span>';
    return a;
  }

  function initHomeSection() {
    var box = document.getElementById('home-tools-grid');
    if (!box) return;
    box.innerHTML = '';
    CONFIG.filter(function (t) { return t.showOnHome; }).slice(0, 6)
      .forEach(function (t) { box.appendChild(card(t)); });
  }

  function initToolsPage() {
    var grid = document.getElementById('tools-grid');
    if (!grid) return;
    var tabs = document.querySelectorAll('[data-tools-filter]');
    function render(filter) {
      grid.innerHTML = '';
      CONFIG.filter(function (t) { return filter === 'all' || t.category === filter; })
        .forEach(function (t) { grid.appendChild(card(t)); });
    }
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('is-active'); x.setAttribute('aria-selected', 'false'); });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');
        render(tab.getAttribute('data-tools-filter') || 'all');
      });
    });
    render('all');
  }

  window.MOMO_TOOLS = { initHomeSection: initHomeSection, initToolsPage: initToolsPage };
})();
