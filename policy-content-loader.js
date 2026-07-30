(() => {
  "use strict";

  const endpoint =
    "https://jbopkzltakexvglgtpww.supabase.co/functions/v1/public-legal-document";
  const path = window.location.pathname.toLowerCase();
  const documentType = path.endsWith("/privacy.html")
    ? "privacy"
    : path.endsWith("/terms.html")
    ? "terms"
    : "";

  if (!documentType) return;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const inline = (value) =>
    escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  function renderMarkdown(markdown) {
    const lines = String(markdown ?? "").replaceAll("\r\n", "\n").split("\n");
    const html = [];
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      const trimmed = line.trim();
      if (!trimmed) {
        index += 1;
        continue;
      }
      if (/^---+$/.test(trimmed)) {
        html.push("<hr>");
        index += 1;
        continue;
      }
      const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
      if (heading) {
        const level = heading[1].length;
        html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        index += 1;
        continue;
      }
      if (/^[-*]\s+/.test(trimmed)) {
        const items = [];
        while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
          items.push(
            `<li>${inline(lines[index].trim().replace(/^[-*]\s+/, ""))}</li>`,
          );
          index += 1;
        }
        html.push(`<ul>${items.join("")}</ul>`);
        continue;
      }
      if (/^\d+\.\s+/.test(trimmed)) {
        const items = [];
        while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
          items.push(
            `<li>${inline(lines[index].trim().replace(/^\d+\.\s+/, ""))}</li>`,
          );
          index += 1;
        }
        html.push(`<ol>${items.join("")}</ol>`);
        continue;
      }
      if (
        trimmed.startsWith("|") &&
        index + 1 < lines.length &&
        /^\|?[\s:|-]+\|?$/.test(lines[index + 1].trim())
      ) {
        const rows = [];
        while (index < lines.length && lines[index].trim().startsWith("|")) {
          rows.push(
            lines[index]
              .trim()
              .replace(/^\||\|$/g, "")
              .split("|")
              .map((cell) => cell.trim()),
          );
          index += 1;
        }
        const header = rows.shift() ?? [];
        rows.shift();
        html.push(
          `<div class="policy-table-wrap"><table><thead><tr>${
            header.map((cell) => `<th>${inline(cell)}</th>`).join("")
          }</tr></thead><tbody>${
            rows.map((row) =>
              `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`
            ).join("")
          }</tbody></table></div>`,
        );
        continue;
      }
      const paragraph = [trimmed];
      index += 1;
      while (
        index < lines.length &&
        lines[index].trim() &&
        !/^(#{1,3})\s+/.test(lines[index].trim()) &&
        !/^[-*]\s+/.test(lines[index].trim()) &&
        !/^\d+\.\s+/.test(lines[index].trim()) &&
        !/^---+$/.test(lines[index].trim())
      ) {
        paragraph.push(lines[index].trim());
        index += 1;
      }
      html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    }
    return html.join("\n");
  }

  function installStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .policy-version-meta {
        margin: 0 0 1.5rem;
        padding: .85rem 1rem;
        border: 1px solid #e2e2e2;
        border-radius: 10px;
        background: #fafafa;
        color: #666;
        font-size: .9rem;
      }
      .policy-table-wrap { overflow-x: auto; margin: 1rem 0; }
      .policy-table-wrap table { border-collapse: collapse; width: 100%; }
      .policy-table-wrap th, .policy-table-wrap td {
        border: 1px solid #ddd;
        padding: .7rem;
        text-align: left;
        vertical-align: top;
      }
      .policy-table-wrap th { background: #f5f5f5; }
    `;
    document.head.append(style);
  }

  async function loadPublishedDocument() {
    try {
      const response = await fetch(
        `${endpoint}?type=${encodeURIComponent(documentType)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) return;
      const payload = await response.json();
      const item = payload?.data;
      const markdown = String(item?.content_markdown ?? "").trim();
      if (payload?.success !== true || !markdown) return;

      const title = document.querySelector(".page-title, h1");
      const body = document.querySelector(".page-body");
      if (!body) return;
      installStyles();
      if (title && item.title) title.textContent = String(item.title);
      const meta = document.createElement("div");
      meta.className = "policy-version-meta";
      meta.textContent =
        `버전 ${item.version ?? "-"} · 시행일 ${item.effective_at ?? "-"}`;
      body.replaceChildren(meta);
      body.insertAdjacentHTML("beforeend", renderMarkdown(markdown));
      document.title = String(item.title ?? document.title);
      document.documentElement.dataset.policyVersion = String(
        item.version ?? "",
      );
    } catch (_) {
      // 네트워크/서버 장애 시 기존 정적 HTML 본문을 그대로 표시한다.
    }
  }

  loadPublishedDocument();
})();
