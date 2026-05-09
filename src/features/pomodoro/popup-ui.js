export function initPomodoroPopupUI() {
    const pomoStatus = document.getElementById("pomoStatus");
    const pomoTimer = document.getElementById("pomoTimer");
    const startPomoBtn = document.getElementById("startPomoBtn");
    const stopPomoBtn = document.getElementById("stopPomoBtn");

    if (!pomoStatus || !pomoTimer) return;

    // Format detik ke MM:SS
    const formatTimeLeft = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const updateUI = () => {
        chrome.storage.local.get(['pomoActive', 'pomoType', 'pomoTimeLeft'], (data) => {
            if (data.pomoActive) {
                pomoStatus.innerText = data.pomoType === 'work' ? '🔥 Sedang Fokus' : '☕ Waktu Istirahat';
                pomoStatus.style.color = data.pomoType === 'work' ? '#dc3545' : '#198754';
                pomoTimer.innerText = formatTimeLeft(data.pomoTimeLeft);

                startPomoBtn.style.display = 'none';
                stopPomoBtn.style.display = 'block';
            } else {
                pomoStatus.innerText = '💤 Pomodoro Nonaktif';
                pomoStatus.style.color = '#333';
                pomoTimer.innerText = '25:00';

                startPomoBtn.style.display = 'block';
                stopPomoBtn.style.display = 'none';
            }
        });
    };

    // Kirim sinyal START ke background
    startPomoBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'togglePomodoro', active: true }, () => {
            updateUI();
        });
    });

    // Kirim sinyal STOP ke background
    stopPomoBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'togglePomodoro', active: false }, () => {
            updateUI();
        });
    });

    // Polling UI setiap detik agar angka jam di popup ikut mundur secara real-time
    setInterval(updateUI, 1000);
    updateUI();
}