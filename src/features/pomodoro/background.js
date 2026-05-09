import { applyPomodoroOverlay } from "./engine.js";

let pomoState = { active: false, type: 'work', timeLeft: 1500 };

export function initPomodoro() {
    // 1. Listener untuk menghitung mundur timer
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'pomoTimer') {
            tick();
        }
    });

    // 2. Listener INJEKSI UI: Di sinilah kode tersebut ditaruh!
    // Setiap kali user membuka tab baru atau me-refresh halaman,
    // ekstensi akan otomatis menyuntikkan engine UI Pomodoro.
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === "loading" && tab.url && tab.url.startsWith("http")) {
            chrome.scripting.executeScript({
                target: { tabId },
                func: applyPomodoroOverlay
            }).catch((err) => {
                // Abaikan error jika ekstensi dilarang berjalan di halaman tertentu (seperti chrome://)
                console.warn("[evn Pomodoro] Gagal injeksi UI di:", tab.url);
            });
        }
    });
}

function tick() {
    chrome.storage.local.get(['pomoTimeLeft', 'pomoType', 'pomoActive'], (data) => {
        if (!data.pomoActive) return;

        let time = data.pomoTimeLeft - 1;
        if (time <= 0) {
            // Switch cycle (Kerja -> Istirahat, atau sebaliknya)
            const nextType = data.pomoType === 'work' ? 'break' : 'work';
            const nextTime = nextType === 'work' ? 1500 : 300; // 25 menit kerja, 5 menit istirahat

            chrome.storage.local.set({
                pomoTimeLeft: nextTime,
                pomoType: nextType,
                pomoText: nextType === 'work' ? "Semangat kerjanya!" : "Waktunya istirahat~"
            });

            chrome.notifications.create({
                type: 'basic',
                iconUrl: '/assets/icon-16.png', // Pastikan path icon ini benar
                title: 'Pomodoro Devkita',
                message: `Sesi ${data.pomoType} selesai!`
            });
        } else {
            chrome.storage.local.set({ pomoTimeLeft: time });
        }
    });
}

export async function togglePomodoro(active) {
    if (active) {
        await chrome.storage.local.set({
            pomoActive: true,
            pomoEnabled: true,
            pomoTimeLeft: 1500,
            pomoType: 'work',
            pomoText: "Ayo fokus!"
        });
        chrome.alarms.create('pomoTimer', { periodInMinutes: 1 / 60 }); // Alarm berdetak setiap 1 detik
    } else {
        await chrome.storage.local.set({ pomoActive: false, pomoEnabled: false });
        chrome.alarms.clear('pomoTimer');
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'togglePomodoro') {
        togglePomodoro(message.active).then(() => {
            sendResponse({ success: true });
        });
        return true; // Keep message channel open for async response
    }
});