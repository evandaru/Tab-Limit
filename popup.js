const enabledEl = document.getElementById("enabled");
const maxTabsEl = document.getElementById("maxTabs");
const blockedSitesEl = document.getElementById("blockedSites");
const saveBtn = document.getElementById("saveBtn");
const copyMdBtn = document.getElementById("copyMdBtn");
const pasteHtmlBtn = document.getElementById("pasteHtmlBtn");

async function loadSettings() {
  const data = await chrome.storage.sync.get([
    "enabled",
    "maxTabs",
    "blockedSites",
  ]);

  enabledEl.checked = data.enabled ?? true;
  maxTabsEl.value = data.maxTabs ?? 5;
  blockedSitesEl.value = (data.blockedSites ?? []).join("\n");
}

saveBtn.addEventListener("click", async () => {
  const rawSites = blockedSitesEl.value.split(/\r?\n|,/);

  const sanitizedSites = rawSites
    .map((site) => site.trim().toLowerCase())
    .filter((site) => site.length > 0);

  await chrome.storage.sync.set({
    enabled: enabledEl.checked,
    maxTabs: Number(maxTabsEl.value),
    blockedSites: sanitizedSites,
  });

  alert("Pengaturan Mode Fokus berhasil disimpan!");
});

// Modul Ekspor Markdown
copyMdBtn.addEventListener("click", async () => {
  try {
    // Berikan feedback visual bahwa proses sedang berjalan
    const originalText = copyMdBtn.innerText;
    copyMdBtn.innerText = "⏳ Memproses...";
    copyMdBtn.disabled = true;

    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!activeTab) {
      throw new Error("Tidak ada tab aktif.");
    }

    // Injeksi engine parser langsung ke environment DOM tab yang sedang aktif
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => {
        // 1. Identifikasi kontainer semantik
        const rootNode =
          document.querySelector("article") ||
          document.querySelector("main") ||
          document.body;
        let markdown = "";

        // 2. Fungsi rekursif untuk melakukan traversal pada DOM Tree
        function traverse(node) {
          const skipTags = [
            "NAV",
            "HEADER",
            "FOOTER",
            "ASIDE",
            "SCRIPT",
            "STYLE",
            "NOSCRIPT",
            "IFRAME",
            "BUTTON",
          ];
          if (node.nodeType === 1 && skipTags.includes(node.tagName)) return;

          if (node.nodeType === 1) {
            const tag = node.tagName;
            const text = node.innerText ? node.innerText.trim() : "";

            if (!text && tag !== "BR" && tag !== "HR") return;

            switch (tag) {
              case "H1":
                markdown += `\n# ${text}\n\n`;
                break;
              case "H2":
                markdown += `\n## ${text}\n\n`;
                break;
              case "H3":
                markdown += `\n### ${text}\n\n`;
                break;
              case "H4":
                markdown += `\n#### ${text}\n\n`;
                break;
              case "H5":
                markdown += `\n##### ${text}\n\n`;
                break;
              case "H6":
                markdown += `\n###### ${text}\n\n`;
                break;
              case "P":
                markdown += `${text}\n\n`;
                break;
              case "UL":
              case "OL":
                Array.from(node.children).forEach((child, index) => {
                  if (child.tagName === "LI") {
                    const prefix = tag === "UL" ? "-" : `${index + 1}.`;
                    markdown += `${prefix} ${child.innerText.trim()}\n`;
                  }
                });
                markdown += "\n";
                break;
              case "PRE":
              case "CODE":
                if (tag === "PRE") {
                  markdown += `\n\`\`\`\n${text}\n\`\`\`\n\n`;
                }
                break;
              case "BLOCKQUOTE":
                markdown += `\n> ${text.replace(/\n/g, "\n> ")}\n\n`;
                break;
              default:
                Array.from(node.childNodes).forEach(traverse);
                break;
            }
          }
        }

        // Inisiasi eksekusi rekursif
        Array.from(rootNode.childNodes).forEach(traverse);

        return markdown.trim();
      },
    });

    // Validasi payload dari hasil parsing DOM
    const articleContent =
      injectionResults[0]?.result ||
      "Konten gagal diekstrak atau halaman kosong.";

    // Kompilasi struktur data Markdown akhir
    const dateStr = new Date().toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const safeTitle = (activeTab.title || "Untitled-Blog").replace(
      /\[|\]/g,
      "",
    );

    let finalMdContent = `# ${safeTitle}\n\n`;
    finalMdContent += `> **URL Referensi:** [Tautan](${activeTab.url})\n`;
    finalMdContent += `> **Tanggal Arsip:** ${dateStr}\n\n`;
    finalMdContent += `---\n\n`;
    finalMdContent += articleContent;

    // EKSEKUSI COPY KE CLIPBOARD
    await navigator.clipboard.writeText(finalMdContent);

    // Kembalikan UI dengan pesan sukses sementara
    copyMdBtn.innerText = "✅ Berhasil Disalin!";
    setTimeout(() => {
      copyMdBtn.innerText = originalText;
      copyMdBtn.disabled = false;
    }, 2000);
  } catch (error) {
    console.error("Kesalahan saat parsing DOM atau menyalin:", error);
    copyMdBtn.innerText = "❌ Gagal Menyalin";
    setTimeout(() => {
      copyMdBtn.innerText = "📋 Copy Blog as .md";
      copyMdBtn.disabled = false;
    }, 2000);
  }
});

const openDashboardBtn = document.getElementById("openDashboardBtn");
if (openDashboardBtn) {
  openDashboardBtn.addEventListener("click", () => {
    // API ini secara otomatis akan membuka options/options.html di tab baru
    chrome.runtime.openOptionsPage();
  });
}

if (pasteHtmlBtn) {
  pasteHtmlBtn.addEventListener("click", async () => {
    try {
      // Manajemen state UI untuk feedback proses
      const originalText = pasteHtmlBtn.innerText;
      pasteHtmlBtn.innerText = "⏳ Membaca Memory...";
      pasteHtmlBtn.disabled = true;

      // 1. Ekstraksi buffer dari clipboard sistem operasi
      const clipboardText = await navigator.clipboard.readText();

      // Validasi integritas payload
      if (!clipboardText || clipboardText.trim() === "") {
        throw new Error(
          "Buffer clipboard kosong atau tidak berisi string yang valid.",
        );
      }

      // 2. Inisialisasi stream I/O file lokal via Blob API
      // Menggunakan mime-type text/html agar dikenali sebagai dokumen web
      const blob = new Blob([clipboardText], {
        type: "text/html;charset=utf-8",
      });
      const objectUrl = URL.createObjectURL(blob);

      const tempLink = document.createElement("a");
      tempLink.href = objectUrl;

      // 3. Standarisasi nomenklatur file menggunakan timestamp (Format: YYYYMMDDHHMMSS)
      const dateObj = new Date();
      const timestamp = dateObj
        .toISOString()
        .replace(/[-:T]/g, "")
        .slice(0, 14);
      tempLink.download = `snippet-${timestamp}.html`;

      // 4. Eksekusi virtual click dan mitigasi memory leak
      document.body.appendChild(tempLink);
      tempLink.click();

      setTimeout(() => {
        document.body.removeChild(tempLink);
        URL.revokeObjectURL(objectUrl);
      }, 150);

      // Kembalikan UI dengan konfirmasi sukses
      pasteHtmlBtn.innerText = "File HTML Dibuat!";
      setTimeout(() => {
        pasteHtmlBtn.innerText = originalText;
        pasteHtmlBtn.disabled = false;
      }, 2000);
    } catch (error) {
      console.error(
        "Kesalahan arsitektural saat membaca clipboard atau operasi I/O:",
        error,
      );
      pasteHtmlBtn.innerText = "Clipboard Kosong / Ditolak";
      setTimeout(() => {
        pasteHtmlBtn.innerText = "Paste Code as .html";
        pasteHtmlBtn.disabled = false;
      }, 2000);
    }
  });
}

loadSettings();
