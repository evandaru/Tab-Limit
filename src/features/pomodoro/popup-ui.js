export function initPomodoroPopupUI() {
    const pomoStatus = document.getElementById("pomoStatus");
    const pomoTimer = document.getElementById("pomoTimer");
    const startPomoBtn = document.getElementById("startPomoBtn");
    const stopPomoBtn = document.getElementById("stopPomoBtn");

    if (!pomoStatus || !pomoTimer) return;

    // Format seconds to MM:SS
    const formatTimeLeft = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const updateUI = () => {
        chrome.storage.local.get(['pomoActive', 'pomoType', 'pomoTimeLeft'], (data) => {
            if (data.pomoActive) {
                pomoStatus.innerText = data.pomoType === 'work' ? '🔥 Focusing' : '☕ Break Time';
                pomoStatus.style.color = data.pomoType === 'work' ? '#dc3545' : '#198754';
                pomoTimer.innerText = formatTimeLeft(data.pomoTimeLeft);

                startPomoBtn.style.display = 'none';
                stopPomoBtn.style.display = 'block';
            } else {
                pomoStatus.innerText = '💤 Pomodoro Inactive';
                pomoStatus.style.color = '#333';
                pomoTimer.innerText = '25:00';

                startPomoBtn.style.display = 'block';
                stopPomoBtn.style.display = 'none';
            }
        });
    };

    // Send the START signal to the background
    startPomoBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'togglePomodoro', active: true }, () => {
            updateUI();
        });
    });

    // Send the STOP signal to the background
    stopPomoBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'togglePomodoro', active: false }, () => {
            updateUI();
        });
    });

    // Poll the UI every second so the popup clock counts down in real time
    setInterval(updateUI, 1000);
    updateUI();
}