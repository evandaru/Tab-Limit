import { triggerBadgeFeedback } from "../../shared/utils/ui-feedback.js";

function htmlToMdParser() {
  const rootNode =
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.body;
  let markdown = "";
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
        case "P":
          markdown += `${text}\n\n`;
          break;
        case "UL":
        case "OL":
          Array.from(node.children).forEach((child, i) => {
            if (child.tagName === "LI")
              markdown += `${tag === "UL" ? "-" : i + 1 + "."} ${child.innerText.trim()}\n`;
          });
          markdown += "\n";
          break;
        case "PRE":
        case "CODE":
          if (tag === "PRE") markdown += `\n\`\`\`\n${text}\n\`\`\`\n\n`;
          break;
        default:
          Array.from(node.childNodes).forEach(traverse);
          break;
      }
    }
  }
  Array.from(rootNode.childNodes).forEach(traverse);
  return {
    title: document.title,
    content: markdown.trim(),
    url: window.location.href,
  };
}

export async function handleDomExtractorMenu(info, tab) {
  if (info.menuItemId === "copy-blog-md") {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: htmlToMdParser,
    });
    const data = results[0].result;
    const finalMd = `# ${data.title}\n\n> **Source:** ${data.url}\n\n---\n\n${data.content}`;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (text) => navigator.clipboard.writeText(text),
      args: [finalMd],
    });
    triggerBadgeFeedback(tab.id, "Copied", "#0d6efd");
  } else if (info.menuItemId === "save-code-html") {
    const htmlContent = info.selectionText;
    const dataUrl =
      "data:text/html;charset=utf-8," + encodeURIComponent(htmlContent);
    chrome.downloads.download({
      url: dataUrl,
      filename: `snippet-${Date.now()}.html`,
      saveAs: false,
    });
    triggerBadgeFeedback(tab.id, "HTML", "#0dcaf0");
  }
}

export function initDomExtractorUI() {
  const copyMdBtn = document.getElementById("copyMdBtn");
  const pasteHtmlBtn = document.getElementById("pasteHtmlBtn");

  if (copyMdBtn) {
    copyMdBtn.addEventListener("click", async () => {
      try {
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

        const injectionResults = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            const rootNode =
              document.querySelector("article") ||
              document.querySelector("main") ||
              document.body;
            let markdown = "";

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

            Array.from(rootNode.childNodes).forEach(traverse);
            return markdown.trim();
          },
        });

        const articleContent =
          injectionResults[0]?.result ||
          "Konten gagal diekstrak atau halaman kosong.";

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

        await navigator.clipboard.writeText(finalMdContent);

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
  }

  if (pasteHtmlBtn) {
    pasteHtmlBtn.addEventListener("click", async () => {
      try {
        const originalText = pasteHtmlBtn.innerText;
        pasteHtmlBtn.innerText = "⏳ Membaca Memory...";
        pasteHtmlBtn.disabled = true;

        const clipboardText = await navigator.clipboard.readText();

        if (!clipboardText || clipboardText.trim() === "") {
          throw new Error(
            "Buffer clipboard kosong atau tidak berisi string yang valid.",
          );
        }

        const blob = new Blob([clipboardText], {
          type: "text/html;charset=utf-8",
        });
        const objectUrl = URL.createObjectURL(blob);

        const tempLink = document.createElement("a");
        tempLink.href = objectUrl;

        const dateObj = new Date();
        const timestamp = dateObj
          .toISOString()
          .replace(/[-:T]/g, "")
          .slice(0, 14);
        tempLink.download = `snippet-${timestamp}.html`;

        document.body.appendChild(tempLink);
        tempLink.click();

        setTimeout(() => {
          document.body.removeChild(tempLink);
          URL.revokeObjectURL(objectUrl);
        }, 150);

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
}
