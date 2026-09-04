import { formatTime, getTodayKey } from "../../shared/utils/time-formatter.js";

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
      dateEl.innerText = now.toLocaleDateString("id-ID", options);
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

  // Hemat CPU 100%: hentikan timer saat pengguna berpindah tab
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
  if (logo) logo.style.color = "#ffff00"; // Indikator loading

  try {
    const todayKey = getTodayKey();
    const allData = await chrome.storage.local.get(null);

    const todayData = allData[todayKey] || {
      totalTime: 0,
      domains: {},
      distractions: 0,
    };
    const allTimeTotal = allData.allTimeTotal || todayData.totalTime || 0;

    // 1. Statistik Kiri
    const valTodayTime = document.getElementById("valTodayTime");
    const valTotalTime = document.getElementById("valTotalTime");
    const valDistractions = document.getElementById("valDistractions");
    const valTopDomain = document.getElementById("valTopDomain");

    if (valTodayTime) valTodayTime.innerText = formatTime(todayData.totalTime);
    if (valTotalTime) valTotalTime.innerText = formatTime(allTimeTotal);
    if (valDistractions) valDistractions.innerText = `${todayData.distractions || 0} kali`;

    // 2. Status Pomodoro
    const pomoLabel = document.getElementById("pomoLabel");
    const pomoTimerDisplay = document.getElementById("pomoTimerDisplay");
    if (pomoLabel && pomoTimerDisplay) {
      if (allData.pomoActive) {
        const isWork = allData.pomoType === "work";
        pomoLabel.innerText = isWork ? "🔥 Sesi Fokus Aktif" : "☕ Waktu Istirahat";
        pomoLabel.style.color = isWork ? "#cc0000" : "#006600";

        const m = Math.floor((allData.pomoTimeLeft || 0) / 60)
          .toString()
          .padStart(2, "0");
        const s = ((allData.pomoTimeLeft || 0) % 60)
          .toString()
          .padStart(2, "0");
        pomoTimerDisplay.innerText = `${m}:${s}`;
      } else {
        pomoLabel.innerText = "💤 Nonaktif";
        pomoLabel.style.color = "#333333";
        pomoTimerDisplay.innerText = "25:00";
      }
    }

    // 3. Tabel Alokasi Domain
    const domains = todayData.domains || {};
    const sortedDomains = Object.entries(domains).sort(([, a], [, b]) => b - a);

    if (valTopDomain) {
      valTopDomain.innerText = sortedDomains.length > 0 ? sortedDomains[0][0] : "-";
    }

    const domainBadge = document.getElementById("domainCountBadge");
    if (domainBadge) {
      domainBadge.innerText = `${sortedDomains.length} situs terekam`;
    }

    const domainTableList = document.getElementById("domainTableList");
    if (domainTableList) {
      domainTableList.innerHTML = "";
      if (sortedDomains.length === 0) {
        domainTableList.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; color: #888888; padding: 16px;">
              Belum ada aktivitas browsing yang terekam hari ini.
            </td>
          </tr>`;
      } else {
        const totalSecs = todayData.totalTime || 1;
        sortedDomains.forEach(([dom, sec], idx) => {
          const percent = Math.round((sec / totalSecs) * 100);
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td style="text-align: center; font-weight: bold; color: #666666;">${idx + 1}</td>
            <td style="font-weight: bold; color: #003399;">${dom}</td>
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

    // 4. Tabel Riwayat 7 Hari
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
            <td colspan="2" style="text-align: center; color: #888888; padding: 12px;">
              Belum ada riwayat tercatat.
            </td>
          </tr>`;
      } else {
        dateKeys.forEach((k) => {
          const dateStr = k.replace("analytics_", "");
          const entry = allData[k];
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><b>${dateStr}</b></td>
            <td style="font-family: monospace; font-weight: bold; color: #003399;">${formatTime(entry.totalTime || 0)}</td>
          `;
          historyTableList.appendChild(tr);
        });
      }
    }

    if (statusText) statusText.innerHTML = `<span>📄</span> Done`;
    if (logo) logo.style.color = "#60a5fa";
  } catch (err) {
    if (statusText) statusText.innerHTML = `<span>⚠️</span> Error loading dashboard.`;
    if (logo) logo.style.color = "#f87171";
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
      alert("Tab Focus - Classic Browser Edition\nVersi 2.1.0 (Build 2000)\nMemory Footprint: < 20 MB (Lightweight & Native)");
    });
  }

  // Auto-sync jika ada perubahan di storage tanpa polling
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
  loadBrowserDashboard();
});
