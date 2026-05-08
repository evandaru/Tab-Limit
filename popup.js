const enabledEl = document.getElementById("enabled");
const maxTabsEl = document.getElementById("maxTabs");
const blockedSitesEl = document.getElementById("blockedSites");
const saveBtn = document.getElementById("saveBtn");
const saveMdBtn = document.getElementById("saveMdBtn"); // Referensi DOM baru

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
saveMdBtn.addEventListener("click", async () => {
  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!activeTab) return;

    // Injeksi engine parser langsung ke environment DOM tab yang sedang aktif
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => {
        // ENGINE PARSER HTML KE MARKDOWN

        // 1. Identifikasi kontainer semantik untuk menghindari scraping navbar/footer
        const rootNode =
          document.querySelector("article") ||
          document.querySelector("main") ||
          document.body;
        let markdown = "";

        // 2. Fungsi rekursif untuk melakukan traversal pada DOM Tree
        function traverse(node) {
          // Abaikan elemen struktural antarmuka dan metadata
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

          // Eksekusi khusus untuk Node Element (Type 1)
          if (node.nodeType === 1) {
            const tag = node.tagName;
            const text = node.innerText ? node.innerText.trim() : "";

            // Abaikan node kosong
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
                // Iterasi spesifik untuk ekstraksi list items
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
                // Fallback: Jika berupa container (DIV, SECTION), telusuri children-nya
                // Catatan: node spesifik seperti P atau UL tidak akan masuk ke sini
                // sehingga mencegah isu duplikasi konten.
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

    // Manajemen I/O memori via Blob
    const blob = new Blob([finalMdContent], {
      type: "text/markdown;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);

    const tempLink = document.createElement("a");
    tempLink.href = objectUrl;

    // Normalisasi penamaan file (Format: judul-artikel-bersih.md)
    const fileName = safeTitle
      .replace(/[^a-z0-9]/gi, "-")
      .toLowerCase()
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    tempLink.download = `${fileName}.md`;

    // Eksekusi trigger unduhan dan mitigasi memory leak
    document.body.appendChild(tempLink);
    tempLink.click();

    setTimeout(() => {
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(objectUrl);
    }, 150);
  } catch (error) {
    console.error(
      "Kesalahan arsitektural saat parsing DOM atau konversi IO:",
      error,
    );
    alert("Gagal melakukan scraping struktur konten halaman.");
  }
});

loadSettings();
