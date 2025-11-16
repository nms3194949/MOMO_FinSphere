(function () {
  if (!window.MOMO_TOOLS) {
    console.warn("MOMO_TOOLS 未載入");
    return;
  }

  /**
   * 產生一張工具卡片
   */
  function createToolCard(tool) {
    const card = document.createElement("article");
    card.className = "tool-card";

    // === 標籤列 ===
    const tagRow = document.createElement("div");
    tagRow.className = "tool-tag-row";

    // 主標籤（例如：加密策略 / 基金工具 / 權證工具）
    if (tool.mainTag) {
      const mainTag = document.createElement("span");
      mainTag.className = "pill pill-main";
      mainTag.textContent = tool.mainTag;
      tagRow.appendChild(mainTag);
    }

    // 其他標籤：過濾掉你不想看到的字樣
    const hiddenLabels = ["本站工具", "外部服務", "外部工具", "外部連結"];
    (tool.tags || [])
      .filter((t) => !hiddenLabels.includes(t))
      .forEach((label) => {
        const pill = document.createElement("span");
        pill.className = "pill pill-sub";
        pill.textContent = label;
        tagRow.appendChild(pill);
      });

    card.appendChild(tagRow);

    // === 標題與描述 ===
    const title = document.createElement("h3");
    title.className = "tool-title";
    title.textContent = tool.name || "-";
    card.appendChild(title);

    if (tool.description) {
      const desc = document.createElement("p");
      desc.className = "tool-desc";
      desc.textContent = tool.description;
      card.appendChild(desc);
    }

    // === Footer（只留按鈕，不再顯示「本站工具 / 外部服務」） ===
    const footer = document.createElement("div");
    footer.className = "tool-footer";

    const btn = document.createElement("a");
    btn.className = "btn-gold";
    btn.href = tool.url;
    btn.target = tool.external ? "_blank" : "_self";
    if (tool.external) btn.rel = "noopener noreferrer";
    btn.textContent = "開啟工具";

    footer.appendChild(btn);
    card.appendChild(footer);

    return card;
  }

  /**
   * 渲染工具列表
   * options:
   *   - targetId: 容器 ID
   *   - category: "fund" | "crypto" | "warrant" | null
   */
  window.renderMomoTools = function renderMomoTools(options) {
    const { targetId, category = null } = options || {};
    const container = document.getElementById(targetId);
    if (!container) return;

    let list = Array.from(MOMO_TOOLS);

    if (category) {
      list = list.filter((t) => t.category === category);
    }

    container.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "tool-empty";
      empty.textContent = "目前這個分類還沒有工具。";
      container.appendChild(empty);
      return;
    }

    list.forEach((tool) => {
      container.appendChild(createToolCard(tool));
    });
  };
})();
