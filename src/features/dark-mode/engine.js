/**
 * Smart Dark Mode Engine (Production-Ready)
 * Uses a layered heuristic approach with DOM Mutation Observers
 * to support Single Page Applications (SPAs).
 */
export function applySmartDarkMode() {
    if (window.__DEVKITA_DARK_ENGINE) return;
    window.__DEVKITA_DARK_ENGINE = true;

    const evaluateTheme = () => {
        const html = document.documentElement;
        const body = document.body;
        if (!body) return false;

        // Layer 1: Global Attribute & Class Detection (Modern Industry Standard)
        // Checks whether the site already injected a dark class/data-theme.
        const htmlStr = (html.className + ' ' + (html.getAttribute('data-theme') || '')).toLowerCase();
        const bodyStr = (body.className + ' ' + (body.getAttribute('data-theme') || '')).toLowerCase();

        if (htmlStr.includes('dark') || bodyStr.includes('dark')) return true;

        // Layer 2: CSSOM (CSS Object Model) Detection
        const bodyStyle = window.getComputedStyle(body);
        const rootStyle = window.getComputedStyle(html);

        if (rootStyle.colorScheme.includes('dark') || bodyStyle.colorScheme.includes('dark')) return true;

        // Helper: luminance calculator (YIQ formula)
        const getBrightness = (colorStr) => {
            const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (match) {
                // Ignore colors with zero alpha (fully transparent)
                if (colorStr.includes('rgba') && parseFloat(colorStr.split(',')[3]) === 0) return null;
                return ((parseInt(match[1]) * 299) + (parseInt(match[2]) * 587) + (parseInt(match[3]) * 114)) / 1000;
            }
            return null;
        };

        // Layer 3: Text Color Detection (Most Accurate)
        // If the default text color is white/bright, the background is certainly dark.
        const textBrightness = getBrightness(bodyStyle.color);
        if (textBrightness !== null && textBrightness > 170) return true;

        // Layer 4: Native Background Color Detection
        const bgBrightness = getBrightness(bodyStyle.backgroundColor) ?? getBrightness(rootStyle.backgroundColor);
        if (bgBrightness !== null && bgBrightness < 128) return true;

        // If all checks fail, assume the site still uses Light Mode
        return false;
    };

    const injectCSS = () => {
        if (document.getElementById('devkita-dark-theme')) return;
        const style = document.createElement('style');
        style.id = 'devkita-dark-theme';
        // Scoped selectors to prevent bleed-out
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
            removeCSS(); // Remove the injection when native dark mode is detected
        } else {
            injectCSS(); // Inject only when the site is actually light
        }
    };

    // 1. Initial Run
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndApply);
    } else {
        checkAndApply();
    }

    // 2. Reactive Run (MutationObserver for SPAs)
    // Watches root-level attribute changes without hurting main-thread performance.
    const observer = new MutationObserver(() => {
        // No debounce/throttle needed here since evaluateTheme is O(1).
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

    // Store the instance on the global scope so it can be cleaned up later
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