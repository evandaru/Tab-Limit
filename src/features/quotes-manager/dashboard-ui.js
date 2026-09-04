import { StorageAPI } from "../../shared/api/storage.js";

export async function renderQuotes(showAll = false) {
  const quotes = await StorageAPI.getQuotes();
  const quoteListEl = document.getElementById("quoteList");
  const seeMoreContainer = document.getElementById("seeMoreQuotesContainer");
  const exportBtn = document.getElementById("exportBtn");
  const copyMdBtn = document.getElementById("copyMdBtn");
  const clearBtn = document.getElementById("clearBtn");

  if (!quoteListEl) return;

  quoteListEl.innerHTML = "";

  if (quotes.length === 0) {
    quoteListEl.innerHTML = `<div class="empty-state"><p>No saved quotes yet.</p></div>`;
    seeMoreContainer.style.display = "none";
    [exportBtn, copyMdBtn].forEach((btn) => {
      if (btn) {
        btn.style.opacity = "0.5";
        btn.style.pointerEvents = "none";
      }
    });
    if (clearBtn) clearBtn.style.display = "none";
    return;
  }

  [exportBtn, copyMdBtn].forEach((btn) => {
    if (btn) {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    }
  });
  if (clearBtn) clearBtn.style.display = "inline-block";

  const reversedQuotes = quotes.slice().reverse();
  const displayLimit = 5;
  const itemsToRender = showAll
    ? reversedQuotes
    : reversedQuotes.slice(0, displayLimit);

  if (reversedQuotes.length > displayLimit && !showAll) {
    seeMoreContainer.style.display = "block";
  } else {
    seeMoreContainer.style.display = "none";
  }

  itemsToRender.forEach((quote) => {
    const dateStr = new Date(quote.timestamp).toLocaleString("en-US", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const isLongText =
      quote.text.length > 250 || (quote.text.match(/\n/g) || []).length > 4;
    const textClass = isLongText ? "quote-text clamped" : "quote-text";
    const toggleBtnHtml = isLongText
      ? `<button class="btn-toggle-text">See More ▼</button>`
      : "";

    const card = document.createElement("div");
    card.className = "quote-card";
    card.innerHTML = `
      <div class="quote-text-wrapper">
        <div class="${textClass}">${quote.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        ${toggleBtnHtml}
      </div>
      <div class="meta">
        <strong>Source:</strong> <a href="${quote.url}" target="_blank">${quote.url}</a><br>
        <strong>Saved:</strong> ${dateStr}
      </div>
    `;

    if (isLongText) {
      const btn = card.querySelector(".btn-toggle-text");
      const textNode = card.querySelector(".quote-text");
      btn.addEventListener("click", () => {
        textNode.classList.toggle("clamped");
        btn.innerText = textNode.classList.contains("clamped")
          ? "See More ▼"
          : "Show Less ▲";
      });
    }

    quoteListEl.appendChild(card);
  });
}

export async function generateMarkdownString() {
  const quotes = await StorageAPI.getQuotes();
  if (quotes.length === 0) return null;

  let mdContent = `# Quote Collection\n\n*Exported on ${new Date().toLocaleString("en-US")}*\n\n---\n\n`;

  quotes
    .slice()
    .reverse()
    .forEach((quote) => {
      const dateStr = new Date(quote.timestamp).toLocaleString("en-US");
      mdContent += `${quote.text}\n\n**Source:** [${quote.url}](${quote.url})\n\n**Date:** ${dateStr}\n\n---\n\n`;
    });

  return mdContent;
}

export function initDashboardUI() {
  const btnSeeAllQuotes = document.getElementById("btnSeeAllQuotes");
  const clearBtn = document.getElementById("clearBtn");
  const exportBtn = document.getElementById("exportBtn");
  const copyMdBtn = document.getElementById("copyMdBtn");

  if (btnSeeAllQuotes) {
    btnSeeAllQuotes.addEventListener("click", () => {
      renderQuotes(true);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      if (confirm("Are you sure you want to delete all quotes?")) {
        await StorageAPI.clearQuotes();
        await renderQuotes();
      }
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      const mdContent = await generateMarkdownString();
      if (!mdContent) return;
      const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quotes-${new Date().toISOString().split("T")[0]}.md`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    });
  }

  if (copyMdBtn) {
    copyMdBtn.addEventListener("click", async () => {
      try {
        const originalText = copyMdBtn.innerText;
        copyMdBtn.innerText = "⏳ Copying...";
        const mdContent = await generateMarkdownString();
        if (!mdContent) throw new Error("Empty");
        await navigator.clipboard.writeText(mdContent);
        copyMdBtn.innerText = "✅ Copied!";
        setTimeout(() => (copyMdBtn.innerText = originalText), 2000);
      } catch (error) {
        copyMdBtn.innerText = "❌ Failed";
        setTimeout(() => (copyMdBtn.innerText = "Copy Quotes"), 2000);
      }
    });
  }
}
