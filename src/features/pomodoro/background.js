import { applyPomodoroOverlay } from "./engine.js";

let pomoState = { active: false, type: 'work', timeLeft: 1500 };

export function initPomodoro() {
    // 1. Listener for the countdown timer
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'pomoTimer') {
            tick();
        }
    });

    // 2. UI INJECTION Listener: every time the user opens a new tab or
    // refreshes a page, the extension auto-injects the Pomodoro UI engine.
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === "loading" && tab.url && tab.url.startsWith("http")) {
            chrome.scripting.executeScript({
                target: { tabId },
                func: applyPomodoroOverlay
            }).catch((err) => {
                // Ignore errors when the extension is blocked on certain pages (e.g. chrome://)
                console.warn("[evn Pomodoro] Failed to inject UI at:", tab.url);
            });
        }
    });
}

function tick() {
    chrome.storage.local.get(['pomoTimeLeft', 'pomoType', 'pomoActive'], (data) => {
        if (!data.pomoActive) return;

        let time = data.pomoTimeLeft - 1;
        if (time <= 0) {
            // Switch cycle (Work -> Break, or vice versa)
            const nextType = data.pomoType === 'work' ? 'break' : 'work';
            const nextTime = nextType === 'work' ? 1500 : 300; // 25 min work, 5 min break

            chrome.storage.local.set({
                pomoTimeLeft: nextTime,
                pomoType: nextType,
                pomoText: nextType === 'work' ? "Keep going!" : "Time to rest~"
            });

            chrome.notifications.create({
                type: 'basic',
                iconUrl: '/assets/icon-16.png', // Make sure this icon path is correct
                title: 'Pomodoro Devkita',
                message: `The ${data.pomoType} session is finished!`
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
            pomoText: "Let's focus!"
        });
        chrome.alarms.create('pomoTimer', { periodInMinutes: 1 / 60 }); // Alarm ticks every 1 second
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