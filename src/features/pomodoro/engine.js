/**
 * Pomodoro Visual Engine
 * Menangani rendering karakter dan gelembung chat 8-Bit.
 */
export function applyPomodoroOverlay() {
    if (window.__DEVKITA_POMO_ENGINE) return;
    window.__DEVKITA_POMO_ENGINE = true;

    const container = document.createElement('div');
    container.id = 'devkita-pomo-container';
    container.style.cssText = `
    position: fixed; bottom: 20px; right: 20px;
    z-index: 2147483647; display: flex; flex-direction: column;
    align-items: center; pointer-events: none; transition: all 0.3s ease;
  `;

    // 8-Bit Bubble Chat (Pure CSS)
    const bubble = document.createElement('div');
    bubble.style.cssText = `
    position: relative; background: white; padding: 10px 15px;
    border: 4px solid black; margin-bottom: 12px;
    font-family: 'Courier New', Courier, monospace; font-weight: bold;
    font-size: 14px; color: black; box-shadow: 4px 4px 0px rgba(0,0,0,0.2);
    max-width: 250px; word-wrap: break-word; text-align: center;
    opacity: 0; transform: translateY(10px); transition: all 0.3s ease;
    line-height: 1.4;
  `;

    const textNode = document.createElement('span');
    bubble.appendChild(textNode);

    // Ekor Bubble
    const tail = document.createElement('div');
    tail.style.cssText = `
    position: absolute; bottom: -12px; right: 20px;
    width: 8px; height: 8px; background: white;
    border-left: 4px solid black; border-right: 4px solid black;
    box-shadow: 0 4px 0 black;
  `;
    bubble.appendChild(tail);

    // Karakter
    const character = document.createElement('img');
    character.style.cssText = `object-fit: contain; transition: width 0.2s ease;`;

    container.appendChild(bubble);
    container.appendChild(character);
    document.documentElement.appendChild(container);

    // Fungsi Sinkronisasi Visual
    const updateVisuals = () => {
        // Hapus 'pomoImage' dari daftar get
        chrome.storage.local.get(['pomoEnabled', 'pomoSize', 'pomoText', 'pomoTimeLeft'], (data) => {
            if (!data.pomoEnabled) {
                container.style.display = 'none';
                return;
            }

            container.style.display = 'flex';

            // PAKAI GAMBAR STATIS DARI ASSETS
            character.src = chrome.runtime.getURL('assets/kucing.gif');
            character.style.width = `${data.pomoSize || 120}px`;

            // Kalkulasi Waktu (Format MM:SS)
            const timeLeft = data.pomoTimeLeft || 0;
            const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
            const seconds = (timeLeft % 60).toString().padStart(2, '0');

            const customText = data.pomoText || "mangat2";

            // Merender Teks Custom + Waktu Mundur
            textNode.innerHTML = `${customText}<br>kurang ${minutes}:${seconds}`;

            bubble.style.opacity = '1';
            bubble.style.transform = 'translateY(0)';
        });
    };

    updateVisuals();

    // Karena background.js (tick()) selalu memperbarui `pomoTimeLeft` setiap 1 detik,
    // listener ini akan ter-trigger setiap detik dan mengubah waktu di Bubble.
    chrome.storage.onChanged.addListener(updateVisuals);
}