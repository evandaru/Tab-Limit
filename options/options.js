// options/options.js
import { StorageAPI } from "../core/storage-api.js";

document.addEventListener("DOMContentLoaded", async () => {
  const quoteListEl = document.getElementById("quoteList");
  const exportBtn = document.getElementById("exportBtn");
  const copyMdBtn = document.getElementById("copyMdBtn"); // Referensi DOM baru
  const clearBtn = document.getElementById("clearBtn");

  async function renderQuotes() {
    const quotes = await StorageAPI.getQuotes();
    quoteListEl.innerHTML = "";

    if (quotes.length === 0) {
      quoteListEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📝</span>
          <p>none</p>
        </div>
      `;
      // Mematikan fungsionalitas button jika state kosong
      exportBtn.style.opacity = "0.5";
      exportBtn.style.pointerEvents = "none";
      copyMdBtn.style.opacity = "0.5";
      copyMdBtn.style.pointerEvents = "none";
      clearBtn.style.display = "none";
    } else {
      // Mengaktifkan kembali button
      exportBtn.style.opacity = "1";
      exportBtn.style.pointerEvents = "auto";
      copyMdBtn.style.opacity = "1";
      copyMdBtn.style.pointerEvents = "auto";
      clearBtn.style.display = "inline-block";

      quotes
        .slice()
        .reverse()
        .forEach((quote) => {
          const dateStr = new Date(quote.timestamp).toLocaleString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          const card = document.createElement("div");
          card.className = "quote-card";
          card.innerHTML = `
          <div class="quote-text">"${quote.text}"</div>
          <div class="meta">
            <strong>Sumber:</strong> <a href="${quote.url}" target="_blank">${quote.url}</a><br>
            <strong>Disimpan:</strong> ${dateStr}
          </div>
        `;
          quoteListEl.appendChild(card);
        });
    }
  }

  // Initial render
  await renderQuotes();

  // Handler Hapus Semua
  clearBtn.addEventListener("click", async () => {
    if (confirm("Apakah Anda yakin ingin menghapus semua kutipan?")) {
      await StorageAPI.clearQuotes();
      await renderQuotes();
    }
  });

  // FUNGSI HELPER: Kompilasi payload state ke format string Markdown
  async function generateMarkdownString() {
    const quotes = await StorageAPI.getQuotes();
    if (quotes.length === 0) return null;

    let mdContent = `# Kumpulan Kutipan\n\n`;
    mdContent += `*Diekspor pada ${new Date().toLocaleString("id-ID")}*\n\n---\n\n`;

    quotes
      .slice()
      .reverse()
      .forEach((quote) => {
        const dateStr = new Date(quote.timestamp).toLocaleString("id-ID");
        mdContent += `> ${quote.text}\n\n`;
        mdContent += `**Sumber:** [${quote.url}](${quote.url})\n\n`;
        mdContent += `**Tanggal Disimpan:** ${dateStr}\n\n`;
        mdContent += `---\n\n`;
      });

    return mdContent;
  }

  // Handler ekspor ke file Markdown (.md)
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

  // -----------------------------------------------------
  // MODUL BARU: Copy Markdown ke Clipboard (via navigator API)
  // -----------------------------------------------------
  copyMdBtn.addEventListener("click", async () => {
    try {
      const originalText = copyMdBtn.innerText;
      copyMdBtn.innerText = "⏳ Menyalin...";
      copyMdBtn.disabled = true;

      const mdContent = await generateMarkdownString();

      if (!mdContent) {
        throw new Error("State kutipan kosong");
      }

      await navigator.clipboard.writeText(mdContent);

      copyMdBtn.innerText = "✅ Tersalin!";
      setTimeout(() => {
        copyMdBtn.innerText = originalText;
        copyMdBtn.disabled = false;
      }, 2000);
    } catch (error) {
      console.error("Proses copy ke clipboard sistem gagal dieksekusi:", error);
      copyMdBtn.innerText = "❌ Gagal";
      setTimeout(() => {
        copyMdBtn.innerText = "Copy as MD";
        copyMdBtn.disabled = false;
      }, 2000);
    }
  });

  // ==========================================
  // MODUL ANALITIK (Dashboard Data Processing)
  // ==========================================
  async function renderAnalytics() {
    const todayKey = `analytics_${new Date().toISOString().split('T')[0]}`;
    const data = await chrome.storage.local.get(todayKey);
    const stats = data[todayKey];

    if (!stats) return; // Jika belum ada data hari ini, biarkan default

    // 1. Kalkulasi Website Paling Sering Dibuka
    if (Object.keys(stats.domains).length > 0) {
      const topDomain = Object.keys(stats.domains).reduce((a, b) => 
        stats.domains[a] > stats.domains[b] ? a : b
      );
      document.getElementById('statTopSite').innerText = topDomain.replace('www.', '');
      // Opsional: Anda bisa memformat waktu misal -> github.com (2j)
    }

    // 2. Total Upaya Distraksi (Situs diblokir yang mencoba diakses)
    document.getElementById('statDistraction').innerText = stats.distractions || 0;

    // 3. Kalkulasi Rata-rata Tab
    if (stats.tabSamples && stats.tabSamples.length > 0) {
      const sum = stats.tabSamples.reduce((a, b) => a + b, 0);
      const avg = (sum / stats.tabSamples.length).toFixed(1);
      document.getElementById('statAvgTabs').innerText = avg;
    }

    // 4. Kalkulasi Jam Paling Produktif (Berdasarkan waktu aktif terbanyak)
    if (Object.keys(stats.hourly).length > 0) {
      const bestHourStr = Object.keys(stats.hourly).reduce((a, b) => 
        stats.hourly[a] > stats.hourly[b] ? a : b
      );
      document.getElementById('statBestHour').innerText = `${bestHourStr}:00`;
    }
  }

  // Panggil fungsi render analitik bersamaan dengan render kutipan
  await renderAnalytics();
});
