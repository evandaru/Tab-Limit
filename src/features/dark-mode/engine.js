/**
 * Smart Dark Mode Engine (Production-Ready)
 * Menggunakan pendekatan Heuristik Berlapis dan DOM Mutation Observer 
 * untuk mendukung Single Page Applications (SPA).
 */
export function applySmartDarkMode() {
    if (window.__DEVKITA_DARK_ENGINE) return;
    window.__DEVKITA_DARK_ENGINE = true;

    const evaluateTheme = () => {
        const html = document.documentElement;
        const body = document.body;
        if (!body) return false;

        // Lapis 1: Deteksi Atribut Global & Class (Standar Industri Modern)
        // Mengecek apakah developer web sudah menyuntikkan class/data-theme dark.
        const htmlStr = (html.className + ' ' + (html.getAttribute('data-theme') || '')).toLowerCase();
        const bodyStr = (body.className + ' ' + (body.getAttribute('data-theme') || '')).toLowerCase();

        if (htmlStr.includes('dark') || bodyStr.includes('dark')) return true;

        // Lapis 2: Deteksi CSSOM (CSS Object Model)
        const bodyStyle = window.getComputedStyle(body);
        const rootStyle = window.getComputedStyle(html);

        if (rootStyle.colorScheme.includes('dark') || bodyStyle.colorScheme.includes('dark')) return true;

        // Helper: Kalkulator Luminance (YIQ Formula)
        const getBrightness = (colorStr) => {
            const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (match) {
                // Abaikan warna dengan alpha channel 0 (transparan murni)
                if (colorStr.includes('rgba') && parseFloat(colorStr.split(',')[3]) === 0) return null;
                return ((parseInt(match[1]) * 299) + (parseInt(match[2]) * 587) + (parseInt(match[3]) * 114)) / 1000;
            }
            return null;
        };

        // Lapis 3: Deteksi Warna Teks (Paling Akurat)
        // Jika warna default teks adalah putih/terang, sudah pasti background-nya gelap.
        const textBrightness = getBrightness(bodyStyle.color);
        if (textBrightness !== null && textBrightness > 170) return true;

        // Lapis 4: Deteksi Native Background Color
        const bgBrightness = getBrightness(bodyStyle.backgroundColor) ?? getBrightness(rootStyle.backgroundColor);
        if (bgBrightness !== null && bgBrightness < 128) return true;

        // Jika semua cek gagal, asumsikan web masih menggunakan Light Mode
        return false;
    };

    const injectCSS = () => {
        if (document.getElementById('devkita-dark-theme')) return;
        const style = document.createElement('style');
        style.id = 'devkita-dark-theme';
        // Menambahkan isolasi selector untuk mencegah bleed-out
        style.textContent = `
      html {
        filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%) !important;
        background-color: #121212 !important;
      }
      img, video, iframe, canvas, svg, [style*="background-image"] {
        filter: invert(100%) hue-rotate(180deg) !important;
      }
    `;
        document.documentElement.appendChild(style);
    };

    const removeCSS = () => {
        const style = document.getElementById('devkita-dark-theme');
        if (style) style.remove();
    };

    const checkAndApply = () => {
        const isAlreadyDark = evaluateTheme();

        if (isAlreadyDark) {
            removeCSS(); // Cabut injeksi jika terdeteksi native dark mode
        } else {
            injectCSS(); // Eksekusi injeksi jika web memang terang
        }
    };

    // 1. Eksekusi Inisial
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndApply);
    } else {
        checkAndApply();
    }

    // 2. Eksekusi Reaktif (MutationObserver untuk SPA)
    // Memantau perubahan atribut pada root level tanpa mengorbankan main thread performance.
    const observer = new MutationObserver(() => {
        // Debounce/Throttle sederhana tidak diperlukan di sini karena 
        // operasi evaluateTheme memiliki kompleksitas waktu O(1).
        checkAndApply();
    });

    if (document.body) {
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'data-theme', 'style']
        });
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class', 'data-theme', 'style']
        });
    }

    // Simpan instance ke global scope agar garbage collector bisa membersihkannya nanti
    window.__DEVKITA_DARK_OBSERVER = observer;
}

export function removeSmartDarkMode() {
    const style = document.getElementById('devkita-dark-theme');
    if (style) style.remove();

    if (window.__DEVKITA_DARK_OBSERVER) {
        window.__DEVKITA_DARK_OBSERVER.disconnect();
        delete window.__DEVKITA_DARK_OBSERVER;
    }
    window.__DEVKITA_DARK_ENGINE = false;
}