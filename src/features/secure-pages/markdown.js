// Small markdown renderer for the Notes mode of Secure Pages.
// Everything is HTML-escaped before any markup is generated, so a shared page
// can never inject script into the reader's page.

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function renderMarkdown(source) {
  const lines = (source || "").split("\n");
  const out = [];
  let inCode = false;
  let listType = null;
  let paragraph = [];

  const closeList = () => {
    if (listType) {
      out.push(listType === "ul" ? "</ul>" : "</ol>");
      listType = null;
    }
  };

  const closeParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };

  const openList = (type) => {
    if (listType !== type) {
      closeList();
      out.push(type === "ul" ? "<ul>" : "<ol>");
      listType = type;
    }
  };

  for (const raw of lines) {
    if (raw.trim().startsWith("```")) {
      closeParagraph();
      closeList();
      out.push(inCode ? "</code></pre>" : "<pre><code>");
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      out.push(escapeHtml(raw));
      continue;
    }

    const line = raw.trimEnd();
    if (!line.trim()) {
      closeParagraph();
      closeList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeParagraph();
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      closeParagraph();
      closeList();
      out.push("<hr>");
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      closeParagraph();
      closeList();
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }

    const task = /^\s*[-*]\s+\[( |x)\]\s+(.*)$/i.exec(raw);
    if (task) {
      closeParagraph();
      openList("ul");
      const checked = task[1].toLowerCase() === "x" ? " checked" : "";
      out.push(`<li><input type="checkbox" disabled${checked}> ${inline(task[2])}</li>`);
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(raw);
    if (bullet) {
      closeParagraph();
      openList("ul");
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }

    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(raw);
    if (numbered) {
      closeParagraph();
      openList("ol");
      out.push(`<li>${inline(numbered[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(line.trim());
  }

  closeParagraph();
  closeList();
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
}