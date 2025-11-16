// assets/tools-render.js
// 共用渲染函式：把 window.MOMO_TOOLS 轉成卡片 HTML
// 在首頁、tools/index.html 都可以呼叫 renderMomoTools(...)

(function () {
  const CATEGORY_LABEL = {
    fund: '基金工具',
    crypto: '加密策略',
    warrant: '權證工具',
    other: '其他工具'
  };

  function resolveHref(tool) {
    // 外部工具 → 直接使用 url
    if (tool.external && tool.url) return tool.url;

    // 內部工具 → 用 path + 根據目前所在路徑決定前綴（./ 或 ../）
    if (tool.path) {
      const here = window.location.pathname || '';
      const inToolsDir = /\/tools\//.test(here);
      // 如果目前在 /tools/ 底下，就用 ../ 開頭；否則在 root 用 ./ 開頭
      const prefix = inToolsDir ? '../' : './';
      return prefix + String(tool.path).replace(/^\.?\//, '');
    }

    // 沒設定路徑就當作 #，避免掛掉
    return '#';
  }

  function buildBadge(tool) {
    const parts = [];
    if (tool.badge) parts.push(tool.badge);
    if (tool.external) parts.push('外部連結');
    return parts.join(' · ');
  }

  function createCard(tool) {
    const href = resolveHref(tool);
    const targetAttr = tool.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    const categoryLabel = CATEGORY_LABEL[tool.category] || '工具';
    const badgeText = buildBadge(tool);

    return `
      <article class="card tool-card" data-category="${tool.category || 'other'}">
        <div class="tool-tag-row">
          <span class="tool-tag">${categoryLabel}</span>
          ${badgeText ? `<span class="tool-tag" style="opacity:.85;font-size:10px;">${badgeText}</span>` : ''}
        </div>
        <h3>${tool.title}</h3>
        <p class="tool-desc">${tool.desc || ''}</p>
        <div class="card-footer">
          <button class="btn btn-gold" onclick="window.open('${href}','${tool.external ? '_blank' : '_self'}')" type="button">
            開啟工具
          </button>
          ${tool.external ? `<span class="badge-external">外部服務</span>` : '<span style="opacity:.7;">本站工具</span>'}
        </div>
      </article>
    `;
  }

  /**
   * 渲染 MOMO 智庫的工具卡片
   * @param {Object} options
   * @param {string} options.targetId   - 容器元素的 ID
   * @param {boolean} [options.onlyFeatured] - 只顯示 featured=true
   * @param {number} [options.limit]    - 限制顯示數量（如首頁顯示前 3 個）
   */
  window.renderMomoTools = function renderMomoTools(options) {
    const { targetId, onlyFeatured, limit } = options || {};
    const container = document.getElementById(targetId);
    if (!container) return;
    if (!Array.isArray(window.MOMO_TOOLS)) {
      container.innerHTML = '<p style="color:var(--muted)">目前尚未設定任何工具。</p>';
      return;
    }

    let list = window.MOMO_TOOLS.slice();

    if (onlyFeatured) {
      list = list.filter(t => t.featured);
    }

    if (typeof limit === 'number') {
      list = list.slice(0, limit);
    }

    if (!list.length) {
      container.innerHTML = '<p style="color:var(--muted)">目前沒有可顯示的工具。</p>';
      return;
    }

    container.innerHTML = list.map(createCard).join('');
  };
})();

