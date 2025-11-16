// assets/tools-render.js
(function () {
  const CONFIG = (window.MOMO_TOOLS_CONFIG || []).slice();

  function createCard(t) {
    const card = document.createElement("article");
    card.className = "tool-card";
    card.innerHTML = `
      <div class="tool-pill-row">
        <span class="tool-pill">${mapCategory(t.category)}</span>
      </div>
      <h3 class="tool-title">${t.title}</h3>
      <p class="tool-desc">${t.desc || ""}</p>
      <div class="tool-footer">
        <a class="btn btn-gold" href="${t.href}"
           ${t.external ? 'target="_blank" rel="noopener noreferrer"' : ""}>
          開啟工具
        </a>
      </div>
    `;
    return card;
  }

  function mapCategory(cat) {
    switch (cat) {
      case "crypto": return "加密策略";
      case "fund": return "基金工具";
      case "warrant": return "權證工具";
      default: return "工具";
    }
  }

  // 首頁「智能工具」區塊：只取 showOnHome = true 的前 3 個
  function initHomeSection() {
    const box = document.getElementById("home-tools-grid");
    if (!box) return;

    box.innerHTML = "";
    CONFIG.filter(t => t.showOnHome)
          .slice(0, 3)
          .forEach(t => box.appendChild(createCard(t)));
  }

  // 工具總覽頁：支援分類 tab
  function initToolsPage() {
    const grid = document.getElementById("tools-grid");
    if (!grid) return;

    const tabs = document.querySelectorAll("[data-tools-filter]");
    function render(filter) {
      grid.innerHTML = "";
      CONFIG.filter(t => filter === "all" || t.category === filter)
            .forEach(t => grid.appendChild(createCard(t)));
    }

    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(x => x.classList.remove("is-active"));
        tab.classList.add("is-active");
        render(tab.dataset.toolsFilter || "all");
      });
    });

    // 預設顯示「全部」
    render("all");
  }

  // 暴露給外面呼叫
  window.MOMO_TOOLS = {
    initHomeSection,
    initToolsPage
  };
})();
