import { formatTime, getTodayKey } from "../../shared/utils/time-formatter.js";

export async function renderTimeAnalytics() {
  const statTodayTime = document.getElementById("statTodayTime");
  const statAllTime = document.getElementById("statAllTime");
  const statDistractions = document.getElementById("statDistractions");
  const domainRankingEl = document.getElementById("domainRanking");

  if (!statTodayTime || !statAllTime || !statDistractions || !domainRankingEl) return;

  const todayKey = getTodayKey();

  const data = await chrome.storage.local.get([todayKey, "allTimeTotal"]);
  const todayData = data[todayKey] || {
    totalTime: 0,
    domains: {},
    distractions: 0,
  };
  const allTimeTotal = data.allTimeTotal || 0;

  // Injeksi metrik ke Stat Card
  statTodayTime.innerText = formatTime(todayData.totalTime);
  statAllTime.innerText = formatTime(allTimeTotal);
  statDistractions.innerText = todayData.distractions || 0;

  // Render Tabel Ranking Domain
  domainRankingEl.innerHTML = "";

  if (Object.keys(todayData.domains).length === 0) {
    domainRankingEl.innerHTML = `<li class="ranking-item" style="justify-content:center; color:#999;">Aktivitas browsing belum terekam hari ini.</li>`;
    return;
  }

  const sortedDomains = Object.entries(todayData.domains).sort(
    ([, timeA], [, timeB]) => timeB - timeA,
  );
  sortedDomains.forEach(([domain, time]) => {
    const li = document.createElement("li");
    li.className = "ranking-item";
    li.innerHTML = `<span class="domain-name">${domain}</span><span class="domain-time">${formatTime(time)}</span>`;
    domainRankingEl.appendChild(li);
  });
}
