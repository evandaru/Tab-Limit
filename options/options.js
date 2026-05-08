// options/options.js
import { StorageAPI } from '../core/storage-api.js';

document.addEventListener('DOMContentLoaded', async () => {
  const quoteListEl = document.getElementById('quoteList');
  const exportBtn = document.getElementById('exportBtn');
  const clearBtn = document.getElementById('clearBtn');
  
  async function renderQuotes() {
    const quotes = await StorageAPI.getQuotes();
    quoteListEl.innerHTML = '';

    if (quotes.length === 0) {
      quoteListEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📝</span>
          <p>none</p>
        </div>
      `;
      exportBtn.style.opacity = '0.5';
      exportBtn.style.pointerEvents = 'none';
      clearBtn.style.display = 'none';
    } else {
      exportBtn.style.opacity = '1';
      exportBtn.style.pointerEvents = 'auto';
      clearBtn.style.display = 'block';

      quotes.reverse().forEach(quote => {
        const dateStr = new Date(quote.timestamp).toLocaleString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const card = document.createElement('div');
        card.className = 'quote-card';
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
  clearBtn.addEventListener('click', async () => {
    if (confirm('Apakah Anda yakin ingin menghapus semua kutipan?')) {
      await StorageAPI.clearQuotes();
      await renderQuotes();
    }
  });

  // Handler ekspor ke file Markdown
  exportBtn.addEventListener('click', async () => {
    const quotes = await StorageAPI.getQuotes();
    if (quotes.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    // Konstruksi string Markdown
    let mdContent = `# Kumpulan Kutipan\n\n`;
    mdContent += `*Diekspor pada ${new Date().toLocaleString('id-ID')}*\n\n---\n\n`;
    
    quotes.reverse().forEach(quote => {
      const dateStr = new Date(quote.timestamp).toLocaleString('id-ID');
      mdContent += `> ${quote.text}\n\n`;
      mdContent += `**Sumber:** [${quote.url}](${quote.url})\n\n`;
      mdContent += `**Tanggal Disimpan:** ${dateStr}\n\n`;
      mdContent += `---\n\n`;
    });

    // Operasi ekspor menggunakan Blob
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    // Injeksi anchor sementara untuk memicu download
    const a = document.createElement('a');
    a.href = url;
    a.download = `kutipan-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    
    // Pembersihan memori
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  });
});
