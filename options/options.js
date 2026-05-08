import { StorageAPI } from "../core/storage-api.js";

document.addEventListener("DOMContentLoaded", async () => {
  const quoteListEl = document.getElementById("quoteList");
  const exportBtn = document.getElementById("exportBtn");
  const copyMdBtn = document.getElementById("copyMdBtn");
  const clearBtn = document.getElementById("clearBtn");

  // ==========================================
  // MODUL 1: RENDER KUTIPAN / QUOTES
  // ==========================================
  async function renderQuotes(showAll = false) {
    const quotes = await StorageAPI.getQuotes();
    const quoteListEl = document.getElementById("quoteList");
    const seeMoreContainer = document.getElementById("seeMoreQuotesContainer");

    quoteListEl.innerHTML = "";

    if (quotes.length === 0) {
      quoteListEl.innerHTML = `<div class="empty-state"><p>Tidak ada kutipan tersimpan.</p></div>`;
      seeMoreContainer.style.display = "none";
      // Update state button export/copy
      [exportBtn, copyMdBtn].forEach((btn) => {
        btn.style.opacity = "0.5";
        btn.style.pointerEvents = "none";
      });
      clearBtn.style.display = "none";
      return;
    }

    // Aktifkan tombol aksi
    [exportBtn, copyMdBtn].forEach((btn) => {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    });
    clearBtn.style.display = "inline-block";

    // Logika Pemotongan Daftar (Top 5)
    const reversedQuotes = quotes.slice().reverse();
    const displayLimit = 5;
    const itemsToRender = showAll
      ? reversedQuotes
      : reversedQuotes.slice(0, displayLimit);

    // Tampilkan tombol "Lihat Semua" hanya jika data > 5 dan sedang dalam mode limit
    if (reversedQuotes.length > displayLimit && !showAll) {
      seeMoreContainer.style.display = "block";
    } else {
      seeMoreContainer.style.display = "none";
    }

    // Iterasi Render
    itemsToRender.forEach((quote) => {
      const dateStr = new Date(quote.timestamp).toLocaleString("id-ID", {
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

      // Event Listener: See More (Per Card)
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

  const btnSeeAllQuotes = document.getElementById("btnSeeAllQuotes");
  btnSeeAllQuotes.addEventListener("click", () => {
    renderQuotes(true); // Panggil ulang fungsi dengan mode showAll = true
  });

  // FUNGSI HELPER: Ekspor ke String
  async function generateMarkdownString() {
    const quotes = await StorageAPI.getQuotes();
    if (quotes.length === 0) return null;

    let mdContent = `# Kumpulan Kutipan\n\n*Diekspor pada ${new Date().toLocaleString("id-ID")}*\n\n---\n\n`;

    quotes
      .slice()
      .reverse()
      .forEach((quote) => {
        const dateStr = new Date(quote.timestamp).toLocaleString("id-ID");
        // Tanda ">" dihapus pada baris di bawah ini
        mdContent += `${quote.text}\n\n**Sumber:** [${quote.url}](${quote.url})\n\n**Tanggal:** ${dateStr}\n\n---\n\n`;
      });

    return mdContent;
  }

  clearBtn.addEventListener("click", async () => {
    if (confirm("Yakin ingin menghapus semua kutipan?")) {
      await StorageAPI.clearQuotes();
      await renderQuotes();
    }
  });

  exportBtn.addEventListener("click", async () => {
    const mdContent = await generateMarkdownString();
    if (!mdContent) return;
    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kutipan-${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  });

  copyMdBtn.addEventListener("click", async () => {
    try {
      const originalText = copyMdBtn.innerText;
      copyMdBtn.innerText = "⏳ Menyalin...";
      const mdContent = await generateMarkdownString();
      if (!mdContent) throw new Error("Kosong");
      await navigator.clipboard.writeText(mdContent);
      copyMdBtn.innerText = "✅ Tersalin!";
      setTimeout(() => (copyMdBtn.innerText = originalText), 2000);
    } catch (error) {
      copyMdBtn.innerText = "❌ Gagal";
      setTimeout(() => (copyMdBtn.innerText = "Copy Quotes"), 2000);
    }
  });

  // ==========================================
  // MODUL 2: RENDER ANALITIK WAKTU
  // ==========================================
  function formatTime(totalSeconds) {
    if (!totalSeconds) return "0m";
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}j ${m}m`;
    if (m > 0) return `${m}m ${s}d`;
    return `${s}d`;
  }

  async function renderTimeAnalytics() {
    const date = new Date();
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date - offset).toISOString().split("T")[0];
    const todayKey = `analytics_${localISOTime}`;

    const data = await chrome.storage.local.get([todayKey, "allTimeTotal"]);
    const todayData = data[todayKey] || {
      totalTime: 0,
      domains: {},
      distractions: 0,
    };
    const allTimeTotal = data.allTimeTotal || 0;

    // Injeksi metrik ke Stat Card
    document.getElementById("statTodayTime").innerText = formatTime(
      todayData.totalTime,
    );
    document.getElementById("statAllTime").innerText = formatTime(allTimeTotal);
    document.getElementById("statDistractions").innerText =
      todayData.distractions || 0;

    // Render Tabel Ranking Domain
    const domainRankingEl = document.getElementById("domainRanking");
    domainRankingEl.innerHTML = "";

    if (Object.keys(todayData.domains).length === 0) {
      domainRankingEl.innerHTML = `<li class="ranking-item" style="justify-content:center; color:#999;">Aktivitas browsing belum terekam hari ini.</li>`;
      return;
    }

    const sortedDomains = Object.entries(todayData.domains).sort(
      ([, timeA], [, timeB]) => timeB - timeA,
    );
    sortedDomains.forEach(([domain, time]) => {
      const li = document.createElement("li");
      li.className = "ranking-item";
      li.innerHTML = `<span class="domain-name">${domain}</span><span class="domain-time">${formatTime(time)}</span>`;
      domainRankingEl.appendChild(li);
    });
  }

  // Inisialisasi proses render saat DOM siap
  await renderQuotes();
  await renderTimeAnalytics();
});
