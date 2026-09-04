import { formatTime, getTodayKey } from "../../shared/utils/time-formatter.js";
import { getAggregatedAnalytics } from "../../features/time-tracker/analytics-ui.js";

// ==========================================
// 1. LIVE CLOCK & VISIBILITY PAUSE
// ==========================================
function initPortalClock() {
  const clockEl = document.getElementById("portalLiveClock");
  const dateEl = document.getElementById("portalLiveDate");
  let clockTimer = null;

  const updateClock = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");

    if (clockEl) clockEl.innerText = `${h}:${m}:${s}`;
    if (dateEl) {
      const options = {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      };
      dateEl.innerText = now.toLocaleDateString("en-US", options);
    }
  };

  const startClock = () => {
    if (!clockTimer) {
      updateClock();
      clockTimer = setInterval(updateClock, 1000);
    }
  };

  const stopClock = () => {
    if (clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };

  startClock();

  // Save 100% CPU: stop the timer when the user switches tabs
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopClock();
    } else {
      startClock();
      loadBrowserDashboard();
    }
  });
}

// ==========================================
// 2. DASHBOARD DATA LOADER (LOW-MEMORY)
// ==========================================
async function loadBrowserDashboard() {
  const statusText = document.getElementById("browserStatusText");
  const logo = document.getElementById("browserLogo");

  if (statusText) statusText.innerHTML = `<span>⏳</span> Downloading data from localhost...`;
  if (logo) logo.style.color = "var(--nt-accent)"; // Loading indicator (follows the system theme)

  try {
    const todayKey = getTodayKey();
    const allData = await chrome.storage.local.get(null);

    const todayData = allData[todayKey] || {
      totalTime: 0,
      domains: {},
      distractions: 0,
      tabsOpened: 0,
      tabsClosed: 0,
      peakTabs: 0,
      hourly: {},
      firstSeen: null,
      lastSeen: null,
    };
    const allTimeTotal = allData.allTimeTotal || todayData.totalTime || 0;

    // 1. Left stats
    const valTodayTime = document.getElementById("valTodayTime");
    const valTotalTime = document.getElementById("valTotalTime");
    const valDistractions = document.getElementById("valDistractions");
    const valTabsOpened = document.getElementById("valTabsOpened");
    const valTabsClosed = document.getElementById("valTabsClosed");
    const valTopDomain = document.getElementById("valTopDomain");
    const valPeakTabs = document.getElementById("valPeakTabs");
    const valFirstSeen = document.getElementById("valFirstSeen");
    const valLastSeen = document.getElementById("valLastSeen");
    const valStreak = document.getElementById("valStreak");

    const fmtClock = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      return `${String(d.getHours()).padStart(2, "0")}:${String(
        d.getMinutes()
      ).padStart(2, "0")}`;
    };

    if (valTodayTime) valTodayTime.innerText = formatTime(todayData.totalTime);
    if (valTotalTime) valTotalTime.innerText = formatTime(allTimeTotal);
    if (valDistractions) valDistractions.innerText = `${todayData.distractions || 0} times`;
    if (valTabsOpened) valTabsOpened.innerText = `${todayData.tabsOpened || 0} tabs`;
    if (valTabsClosed) valTabsClosed.innerText = `${todayData.tabsClosed || 0} tabs`;
    if (valPeakTabs) valPeakTabs.innerText = `${todayData.peakTabs || 0} tabs`;
    if (valFirstSeen) valFirstSeen.innerText = fmtClock(todayData.firstSeen);
    if (valLastSeen) valLastSeen.innerText = fmtClock(todayData.lastSeen);

    // 1b. Streak: consecutive active days up to today/yesterday
    if (valStreak) {
      const hasActivity = (dateStr) => {
        const e = allData[`analytics_${dateStr}`];
        if (!e) return false;
        return (e.totalTime || 0) > 0 || (e.tabsOpened || 0) > 0 || !!e.firstSeen;
      };
      const fmtDate = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate()
        ).padStart(2, "0")}`;
      const todayStr = todayKey.replace("analytics_", "");
      const cursor = new Date(todayStr + "T00:00:00");
      if (!hasActivity(todayStr)) cursor.setDate(cursor.getDate() - 1);
      let streak = 0;
      while (streak < 3650) {
        if (!hasActivity(fmtDate(cursor))) break;
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      valStreak.innerText = `${streak} days`;
    }

    // 1c. 24-hour heatmap (00–23) for today
    const rhythmHeatmap = document.getElementById("rhythmHeatmap");
    if (rhythmHeatmap) {
      rhythmHeatmap.innerHTML = "";
      const hourly = todayData.hourly || {};
      const maxSec = Math.max(1, ...Array.from({ length: 24 }, (_, h) => hourly[h] || 0));
      for (let h = 0; h < 24; h++) {
        const sec = hourly[h] || 0;
        const bar = document.createElement("div");
        bar.className = "rhythm-bar" + (sec > 0 ? " hot" : "");
        bar.style.height = `${Math.max(8, Math.round((sec / maxSec) * 100))}%`;
        bar.title = `${String(h).padStart(2, "0")}:00 — ${formatTime(sec)}`;
        rhythmHeatmap.appendChild(bar);
      }
    }

    // 1d. Focus Insights (computed via shared aggregator, no extra reads)
    try {
      const agg = await getAggregatedAnalytics("today");

      const valFocusScore = document.getElementById("valFocusScore");
      const valActiveTime = document.getElementById("valActiveTime");
      const valChurnRate = document.getElementById("valChurnRate");
      const valTopOffender = document.getElementById("valTopOffender");

      if (valFocusScore) {
        valFocusScore.innerText =
          todayData.totalTime > 0 ? `${agg.focusScore} / 100` : "-";
      }
      if (valActiveTime) {
        valActiveTime.innerText =
          todayData.totalTime > 0
            ? `${formatTime(agg.activeSecs)} active`
            : "-";
      }
      if (valChurnRate) {
        valChurnRate.innerText =
          todayData.totalTime > 0 ? `${agg.churnRate} tabs/h` : "-";
      }
      if (valTopOffender) {
        valTopOffender.innerText =
          agg.topOffenders.length > 0
            ? `${agg.topOffenders[0][0]} (${agg.topOffenders[0][1]}x)`
            : "-";
      }

      // Session timeline: 24 blocks colored by hourly intensity
      const sessionStrip = document.getElementById("sessionStrip");
      if (sessionStrip) {
        sessionStrip.innerHTML = "";
        const hourly = todayData.hourly || {};
        const maxSec = Math.max(
          1,
          ...Array.from({ length: 24 }, (_, h) => hourly[h] || 0)
        );
        for (let h = 0; h < 24; h++) {
          const sec = hourly[h] || 0;
          const block = document.createElement("div");
          block.className = "session-block" + (sec > 0 ? " hot" : "");
          block.style.opacity =
            sec > 0 ? `${Math.max(25, Math.round((sec / maxSec) * 100))}%` : "1";
          block.title = `${String(h).padStart(2, "0")}:00 — ${formatTime(sec)}`;
          sessionStrip.appendChild(block);
        }
      }

      // Weekday pattern: 7 columns Mon..Sun with average labels
      const weekdayStrip = document.getElementById("weekdayStrip");
      if (weekdayStrip) {
        weekdayStrip.innerHTML = "";
        const labels = ["M", "T", "W", "T", "F", "S", "S"];
        const maxAvg = Math.max(1, ...agg.weekdayPattern);
        agg.weekdayPattern.forEach((avg, i) => {
          const col = document.createElement("div");
          col.className = "weekday-col";
          const bar = document.createElement("div");
          bar.className = "weekday-bar" + (avg > 0 ? " hot" : "");
          bar.style.height = `${Math.max(6, Math.round((avg / maxAvg) * 100))}%`;
          bar.title = `${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]} avg ${formatTime(avg)}`;
          const lbl = document.createElement("div");
          lbl.className = "weekday-lbl";
          lbl.innerText = labels[i];
          col.appendChild(bar);
          col.appendChild(lbl);
          weekdayStrip.appendChild(col);
        });
      }
    } catch (e) {}

    // 2. Pomodoro status
    const pomoLabel = document.getElementById("pomoLabel");
    const pomoTimerDisplay = document.getElementById("pomoTimerDisplay");
    if (pomoLabel && pomoTimerDisplay) {
      if (allData.pomoActive) {
        const isWork = allData.pomoType === "work";
        pomoLabel.innerText = isWork ? "🔥 Focus Session Active" : "☕ Break Time";
        pomoLabel.style.color = isWork ? "var(--nt-danger)" : "var(--nt-accent)";

        const m = Math.floor((allData.pomoTimeLeft || 0) / 60)
          .toString()
          .padStart(2, "0");
        const s = ((allData.pomoTimeLeft || 0) % 60)
          .toString()
          .padStart(2, "0");
        pomoTimerDisplay.innerText = `${m}:${s}`;
      } else {
        pomoLabel.innerText = "💤 Inactive";
        pomoLabel.style.color = "var(--nt-text)";
        pomoTimerDisplay.innerText = "25:00";
        pomoTimerDisplay.style.color = "var(--nt-accent)";
      }
    }

    // 3. Domain allocation table
    const domains = todayData.domains || {};
    const sortedDomains = Object.entries(domains).sort(([, a], [, b]) => b - a);

    if (valTopDomain) {
      valTopDomain.innerText = sortedDomains.length > 0 ? sortedDomains[0][0] : "-";
    }

    const domainBadge = document.getElementById("domainCountBadge");
    if (domainBadge) {
      domainBadge.innerText = `${sortedDomains.length} sites recorded`;
    }

    const domainTableList = document.getElementById("domainTableList");
    if (domainTableList) {
      domainTableList.innerHTML = "";
      if (sortedDomains.length === 0) {
        domainTableList.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; color: var(--nt-faint); padding: 16px;">
              No browsing activity recorded today.
            </td>
          </tr>`;
      } else {
        const totalSecs = todayData.totalTime || 1;
        sortedDomains.forEach(([dom, sec], idx) => {
          const percent = Math.round((sec / totalSecs) * 100);
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td style="text-align: center; font-weight: bold; color: var(--nt-muted);">${idx + 1}</td>
            <td style="font-weight: bold; color: var(--nt-accent);">${dom}</td>
            <td style="font-family: monospace;">${formatTime(sec)}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 6px;">
                <div class="retro-gauge-bg" style="flex: 1;">
                  <div class="retro-gauge-fill" style="width: ${percent}%;"></div>
                </div>
                <span style="font-size: 10px; font-weight: bold; min-width: 28px;">${percent}%</span>
              </div>
            </td>
          `;
          domainTableList.appendChild(tr);
        });
      }
    }

    // 4. 7-day history table
    const historyTableList = document.getElementById("historyTableList");
    if (historyTableList) {
      historyTableList.innerHTML = "";
      const dateKeys = Object.keys(allData)
        .filter((k) => k.startsWith("analytics_") && k.length === 20)
        .sort()
        .reverse()
        .slice(0, 7);

      if (dateKeys.length === 0) {
        historyTableList.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: var(--nt-faint); padding: 12px;">
              No history recorded.
            </td>
          </tr>`;
      } else {
        dateKeys.forEach((k) => {
          const dateStr = k.replace("analytics_", "");
          const entry = allData[k];
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><b>${dateStr}</b></td>
            <td style="font-family: monospace; font-weight: bold; color: var(--nt-accent);">${formatTime(entry.totalTime || 0)}</td>
            <td style="text-align: center; font-weight: bold;">${entry.tabsOpened || 0}</td>
            <td style="text-align: center; font-weight: bold;">${entry.tabsClosed || 0}</td>
            <td style="text-align: center; font-weight: bold;">${entry.peakTabs || 0}</td>
          `;
          historyTableList.appendChild(tr);
        });
      }
    }

    if (statusText) statusText.innerHTML = `<span>📄</span> Done`;
    if (logo) logo.style.color = "var(--nt-accent)";
  } catch (err) {
    if (statusText) statusText.innerHTML = `<span>⚠️</span> Error loading dashboard.`;
    if (logo) logo.style.color = "var(--nt-danger)";
  }
}

// ==========================================
// 2b. AUTO DARK/LIGHT follows the system setting
// CSS already uses prefers-color-scheme; this listener ensures
// dynamic colors (logo/status) update when the OS theme changes.
// ==========================================
function initSystemThemeWatcher() {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const applyTheme = () => {
    // Mark the active theme on <html> for debugging / extra styling
    document.documentElement.dataset.systemTheme = media.matches ? "dark" : "light";
  };
  applyTheme();
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", () => {
      applyTheme();
      loadBrowserDashboard();
    });
  }
}

// ==========================================
// 3. TOOLBAR & CONTROLS BINDING
// ==========================================
function initBrowserControls() {
  const btnRefresh = document.getElementById("btnRefresh");
  const btnHome = document.getElementById("btnHome");
  const btnStop = document.getElementById("btnStop");
  const btnGo = document.getElementById("btnGo");
  const addressInput = document.getElementById("addressInput");
  const btnOptionsPage = document.getElementById("btnOptionsPage");
  const linkOpenOptions = document.getElementById("linkOpenOptions");
  const linkRefreshData = document.getElementById("linkRefreshData");
  const btnBrowserClose = document.getElementById("btnBrowserClose");
  const menuHelp = document.getElementById("menuHelp");

  const refreshAction = () => {
    loadBrowserDashboard();
  };

  const openOptionsAction = () => {
    chrome.runtime.openOptionsPage();
  };

  if (btnRefresh) btnRefresh.addEventListener("click", refreshAction);
  if (btnHome) btnHome.addEventListener("click", refreshAction);
  if (linkRefreshData) linkRefreshData.addEventListener("click", refreshAction);

  if (btnStop) {
    btnStop.addEventListener("click", () => {
      const statusText = document.getElementById("browserStatusText");
      if (statusText) statusText.innerHTML = `<span>🛑</span> Stopped.`;
    });
  }

  if (btnGo && addressInput) {
    btnGo.addEventListener("click", refreshAction);
    addressInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") refreshAction();
    });
  }

  if (btnOptionsPage) btnOptionsPage.addEventListener("click", openOptionsAction);
  if (linkOpenOptions) linkOpenOptions.addEventListener("click", openOptionsAction);

  if (btnBrowserClose) {
    btnBrowserClose.addEventListener("click", () => {
      window.close();
    });
  }

  if (menuHelp) {
    menuHelp.addEventListener("click", () => {
      alert("Tab Focus - Classic Browser Edition\nVersion 2.1.0 (Build 2000)\nMemory Footprint: < 20 MB (Lightweight & Native)");
    });
  }

  // Auto-sync on storage changes without polling
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      loadBrowserDashboard();
    }
  });
}

// ==========================================
// DOM READY INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initPortalClock();
  initBrowserControls();
  initSystemThemeWatcher();
  loadBrowserDashboard();
});
