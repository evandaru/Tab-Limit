/**
 * Pomodoro Visual Engine
 * Renders the character and the 8-bit chat bubble.
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
    line-height: 1.4; pointer-events: auto;
  `;

    const textNode = document.createElement('span');
    bubble.appendChild(textNode);

    // Bubble tail
    const tail = document.createElement('div');
    tail.style.cssText = `
    position: absolute; bottom: -12px; right: 20px;
    width: 8px; height: 8px; background: white;
    border-left: 4px solid black; border-right: 4px solid black;
    box-shadow: 0 4px 0 black;
  `;
    bubble.appendChild(tail);

    // Character
    const character = document.createElement('img');
    character.style.cssText = `object-fit: contain; transition: width 0.2s ease; pointer-events: auto;`;

    // Fully hide the widget on hover and let clicks pass through
    container.addEventListener('mouseover', () => {
        container.style.opacity = '0';
        bubble.style.pointerEvents = 'none';
        character.style.pointerEvents = 'none';

        const checkMouseLeave = (e) => {
            const rect = container.getBoundingClientRect();
            // Add a little padding (20px) so it is not too sensitive
            const pad = 20;
            if (e.clientX < rect.left - pad || e.clientX > rect.right + pad || 
                e.clientY < rect.top - pad || e.clientY > rect.bottom + pad) {
                
                container.style.opacity = '1';
                bubble.style.pointerEvents = 'auto';
                character.style.pointerEvents = 'auto';
                document.removeEventListener('mousemove', checkMouseLeave);
            }
        };
        
        document.addEventListener('mousemove', checkMouseLeave);
    });

    container.appendChild(bubble);
    container.appendChild(character);
    document.documentElement.appendChild(container);

    // Visual sync function
    const updateVisuals = () => {
        // 'pomoImage' was removed from the get list
        chrome.storage.local.get(['pomoEnabled', 'pomoSize', 'pomoText', 'pomoTimeLeft'], (data) => {
            if (!data.pomoEnabled) {
                container.style.display = 'none';
                return;
            }

            container.style.display = 'flex';

            // USE THE STATIC IMAGE FROM ASSETS
            character.src = chrome.runtime.getURL('assets/kucing.gif');
            character.style.width = `${data.pomoSize || 120}px`;

            // Time calculation (MM:SS format)
            const timeLeft = data.pomoTimeLeft || 0;
            const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
            const seconds = (timeLeft % 60).toString().padStart(2, '0');

            const customText = data.pomoText || "stay focused";

            // Renders custom text + countdown
            textNode.innerHTML = `${customText}<br>${minutes}:${seconds} left`;

            bubble.style.opacity = '1';
            bubble.style.transform = 'translateY(0)';
        });
    };

    updateVisuals();

    // Since background.js (tick()) updates `pomoTimeLeft` every second,
    // this listener fires every second and updates the bubble time.
    chrome.storage.onChanged.addListener(updateVisuals);
}