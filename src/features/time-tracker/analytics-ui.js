import { formatTime, getTodayKey } from "../../shared/utils/time-formatter.js";

const PALETTE = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#64748b", // Slate (others)
];

/**
 * Fetches analytics data from chrome.storage.local and aggregates it by time filter
 * @param {'today' | 'week' | 'month' | 'year' | 'all'} filter 
 */
export async function getAggregatedAnalytics(filter = "today") {
  const allData = await chrome.storage.local.get(null);
  const now = new Date();
  const todayKey = getTodayKey();
  const todayDateStr = todayKey.replace("analytics_", "");

  let totalTime = 0;
  let distractions = 0;
  let tabsOpened = 0;
  let tabsClosed = 0;
  let peakTabs = 0;
  let firstSeen = null;
  let lastSeen = null;
  let activeDays = 0;
  const hourly = {};
  const domains = {};
  const dailyHistory = {}; // dateStr -> { totalTime, tabsOpened, tabsClosed, peakTabs }

  // Collect all analytics_YYYY-MM-DD entries
  const dateKeys = Object.keys(allData).filter(
    (k) => k.startsWith("analytics_") && k.length === 20
  );

  dateKeys.forEach((key) => {
    const dateStr = key.replace("analytics_", "");
    const entry = allData[key];
    if (!entry) return;

    let include = false;

    if (filter === "today") {
      include = dateStr === todayDateStr;
    } else if (filter === "week") {
      const entryDate = new Date(dateStr + "T00:00:00");
      const diffDays = (now - entryDate) / (1000 * 60 * 60 * 24);
      include = diffDays >= 0 && diffDays <= 7;
    } else if (filter === "month") {
      const currentMonth = todayDateStr.substring(0, 7); // 'YYYY-MM'
      include = dateStr.startsWith(currentMonth);
    } else if (filter === "year") {
      const currentYear = todayDateStr.substring(0, 4); // 'YYYY'
      include = dateStr.startsWith(currentYear);
    } else if (filter === "all") {
      include = true;
    }

    if (include) {
      const entryTime = entry.totalTime || 0;
      const entryOpened = entry.tabsOpened || 0;
      const entryClosed = entry.tabsClosed || 0;
      totalTime += entryTime;
      distractions += entry.distractions || 0;
      tabsOpened += entryOpened;
      tabsClosed += entryClosed;

      if (typeof entry.peakTabs === "number" && entry.peakTabs > peakTabs) {
        peakTabs = entry.peakTabs;
      }
      if (entry.firstSeen && (!firstSeen || entry.firstSeen < firstSeen)) {
        firstSeen = entry.firstSeen;
      }
      if (entry.lastSeen && (!lastSeen || entry.lastSeen > lastSeen)) {
        lastSeen = entry.lastSeen;
      }
      if (entry.hourly && typeof entry.hourly === "object") {
        for (const [h, sec] of Object.entries(entry.hourly)) {
          hourly[h] = (hourly[h] || 0) + (sec || 0);
        }
      }
      if (entryTime > 0 || entryOpened > 0 || entry.firstSeen) {
        activeDays += 1;
      }

      const prev = dailyHistory[dateStr] || {
        totalTime: 0,
        tabsOpened: 0,
        tabsClosed: 0,
        peakTabs: 0,
      };
      dailyHistory[dateStr] = {
        totalTime: prev.totalTime + entryTime,
        tabsOpened: prev.tabsOpened + entryOpened,
        tabsClosed: prev.tabsClosed + entryClosed,
        peakTabs: Math.max(prev.peakTabs || 0, entry.peakTabs || 0),
      };

      if (entry.domains) {
        for (const [domain, sec] of Object.entries(entry.domains)) {
          domains[domain] = (domains[domain] || 0) + sec;
        }
      }
    }
  });

  const allTimeTotal = Math.max(allData.allTimeTotal || 0, totalTime);
  const allTimeTabsOpened = Math.max(
    allData.allTimeTabsOpened || 0,
    tabsOpened
  );
  const allTimeTabsClosed = Math.max(
    allData.allTimeTabsClosed || 0,
    tabsClosed
  );

  // Streak: consecutive active days ending today
  // (or yesterday if today has no activity yet).
  const hasActivity = (dateStr) => {
    const e = allData[`analytics_${dateStr}`];
    if (!e) return false;
    return (e.totalTime || 0) > 0 || (e.tabsOpened || 0) > 0 || !!e.firstSeen;
  };
  const fmtDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  let streak = 0;
  const cursor = new Date(todayDateStr + "T00:00:00");
  if (!hasActivity(todayDateStr)) cursor.setDate(cursor.getDate() - 1);
  while (streak < 3650) {
    if (!hasActivity(fmtDate(cursor))) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    filter,
    totalTime,
    distractions,
    tabsOpened,
    tabsClosed,
    peakTabs,
    hourly,
    firstSeen,
    lastSeen,
    activeDays,
    streak,
    domains,
    dailyHistory,
    allTimeTotal,
    allTimeTabsOpened,
    allTimeTabsClosed,
  };
}

/**
 * Generates a modern SVG donut chart of the top domains
 */
function generateDonutChartSvg(sortedDomains, totalTime) {
  if (sortedDomains.length === 0 || totalTime <= 0) {
    return `
      <div class="empty-chart-state" style="text-align: center; padding: 24px 10px; color: var(--text-muted, #64748b); font-size: 12px;">
        <div style="font-size: 28px; margin-bottom: 6px;">📊</div>
        No activity data for this period.
      </div>
    `;
  }

  const size = 140;
  const center = size / 2;
  const radius = 52;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;

  // Take the top 5 domains, merge the rest into 'Others'
  const topSegments = [];
  let accountedTime = 0;
  sortedDomains.slice(0, 5).forEach(([dom, sec], idx) => {
    topSegments.push({
      domain: dom,
      time: sec,
      color: PALETTE[idx % PALETTE.length],
      percent: (sec / totalTime) * 100,
    });
    accountedTime += sec;
  });

  const otherTime = totalTime - accountedTime;
  if (otherTime > 0 && sortedDomains.length > 5) {
    topSegments.push({
      domain: "Others",
      time: otherTime,
      color: PALETTE[PALETTE.length - 1],
      percent: (otherTime / totalTime) * 100,
    });
  }

  let accumulatedPercent = 0;
  const svgCircles = topSegments.map((seg) => {
    const strokeDash = (seg.percent / 100) * circumference;
    const strokeDashoffset = -(accumulatedPercent / 100) * circumference;
    accumulatedPercent += seg.percent;

    return `
      <circle
        cx="${center}"
        cy="${center}"
        r="${radius}"
        fill="transparent"
        stroke="${seg.color}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${strokeDash} ${circumference}"
        stroke-dashoffset="${strokeDashoffset}"
        style="transition: stroke-dasharray 0.4s ease, stroke-dashoffset 0.4s ease;"
      >
        <title>${seg.domain}: ${formatTime(seg.time)} (${Math.round(seg.percent)}%)</title>
      </circle>
    `;
  }).join("");

  const formattedTotal = formatTime(totalTime);

  // SVG Chart + Legend Grid
  const legendHtml = topSegments.map((seg) => `
    <div class="chart-legend-item" style="display: flex; align-items: center; gap: 5px; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${seg.color}; flex-shrink: 0;"></span>
      <span style="max-width: 80px; overflow: hidden; text-overflow: ellipsis; color: var(--text-main, #334155);" title="${seg.domain}">${seg.domain}</span>
      <span style="color: var(--text-muted, #64748b); font-size: 10px;">${Math.round(seg.percent)}%</span>
    </div>
  `).join("");

  return `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 8px 0;">
      <div style="position: relative; width: ${size}px; height: ${size}px;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform: rotate(-90deg); border-radius: 50%;">
          <circle
            cx="${center}"
            cy="${center}"
            r="${radius}"
            fill="transparent"
            stroke="var(--border-color, #e2e8f0)"
            stroke-width="${strokeWidth}"
          />
          ${svgCircles}
        </svg>
        <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; text-align: center;">
          <span style="font-size: 14px; font-weight: 700; color: var(--text-main, #334155);">${formattedTotal}</span>
          <span style="font-size: 9px; color: var(--text-muted, #64748b); text-transform: uppercase; letter-spacing: 0.5px;">Time</span>
        </div>
      </div>
      <div class="chart-legend-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 10px; width: 100%;">
        ${legendHtml}
      </div>
    </div>
  `;
}

/**
 * Render visual time analytics
 * @param {'today' | 'week' | 'month' | 'year' | 'all'} [timeframe='today']
 */
export async function renderTimeAnalytics(timeframe = "today") {
  const statTodayTime = document.getElementById("statTodayTime");
  const statAllTime = document.getElementById("statAllTime");
  const statDistractions = document.getElementById("statDistractions");
  const statTabsOpened = document.getElementById("statTabsOpened");
  const statTabsClosed = document.getElementById("statTabsClosed");
  const statAllTabsOpened = document.getElementById("statAllTabsOpened");
  const statAllTabsClosed = document.getElementById("statAllTabsClosed");
  const domainRankingEl = document.getElementById("domainRanking");
  const chartContainer = document.getElementById("analyticsChartContainer");
  const statTimeframeLabel = document.getElementById("statTimeframeLabel");
  const statTabLabel = document.getElementById("statTabLabel");
  const topDomainStat = document.getElementById("statTopDomain");

  const data = await getAggregatedAnalytics(timeframe);

  const filterLabels = {
    today: "Time (Today)",
    week: "Time (7 Days)",
    month: "Time (This Month)",
    year: "Time (This Year)",
    all: "All Time",
  };

  const tabFilterLabels = {
    today: "Tabs (Today)",
    week: "Tabs (7 Days)",
    month: "Tabs (This Month)",
    year: "Tabs (This Year)",
    all: "All Tabs",
  };

  if (statTimeframeLabel) {
    statTimeframeLabel.innerText = filterLabels[timeframe] || "Usage Time";
  }
  if (statTabLabel) {
    statTabLabel.innerText = tabFilterLabels[timeframe] || "Tabs Opened / Closed";
  }

  // Update stat cards
  if (statTodayTime) {
    statTodayTime.innerText = formatTime(data.totalTime);
  }
  if (statAllTime) {
    statAllTime.innerText = formatTime(data.allTimeTotal);
  }
  if (statDistractions) {
    statDistractions.innerText = data.distractions;
  }
  if (statTabsOpened) {
    statTabsOpened.innerText = data.tabsOpened;
  }
  if (statTabsClosed) {
    statTabsClosed.innerText = data.tabsClosed;
  }
  if (statAllTabsOpened) {
    statAllTabsOpened.innerText = data.allTimeTabsOpened;
  }
  if (statAllTabsClosed) {
    statAllTabsClosed.innerText = data.allTimeTabsClosed;
  }

  // Sort domains by duration, descending
  const sortedDomains = Object.entries(data.domains).sort(
    ([, timeA], [, timeB]) => timeB - timeA
  );

  if (topDomainStat) {
    if (sortedDomains.length > 0) {
      topDomainStat.innerText = sortedDomains[0][0];
    } else {
      topDomainStat.innerText = "-";
    }
  }

  // Render chart container
  if (chartContainer) {
    chartContainer.innerHTML = generateDonutChartSvg(sortedDomains, data.totalTime);
  }

  // Render domain ranking
  if (domainRankingEl) {
    domainRankingEl.innerHTML = "";

    if (sortedDomains.length === 0) {
      domainRankingEl.innerHTML = `
        <li class="ranking-item" style="justify-content: center; color: var(--text-muted, #94a3b8); padding: 14px 0; font-size: 13px; text-align: center; list-style: none;">
          No recorded activity yet.
        </li>`;
      return;
    }

    const totalSecs = data.totalTime || 1;

    sortedDomains.forEach(([domain, time], idx) => {
      const percentage = Math.round((time / totalSecs) * 100);
      const color = PALETTE[idx % PALETTE.length];

      const li = document.createElement("li");
      li.className = "ranking-item";
      li.style.cssText = "display: flex; flex-direction: column; gap: 4px; padding: 8px 0; border-bottom: 1px dashed var(--border-color, #e2e8f0); list-style: none;";

      li.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${color}; flex-shrink: 0;"></span>
            <span class="domain-name" style="font-weight: 500; font-size: 12px; color: var(--text-main, #334155); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${domain}">${domain}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <span style="font-size: 11px; font-weight: 600; color: ${color};">${percentage}%</span>
            <span class="domain-time" style="font-size: 11px; font-family: monospace; color: var(--text-muted, #64748b);">${formatTime(time)}</span>
          </div>
        </div>
        <div style="width: 100%; height: 5px; background: var(--border-color, #e2e8f0); border-radius: 999px; overflow: hidden;">
          <div style="width: ${percentage}%; height: 100%; background: ${color}; border-radius: 999px; transition: width 0.3s ease;"></div>
        </div>
      `;
      domainRankingEl.appendChild(li);
    });
  }
}

/**
 * Initializes the period filter button listeners
 */
export function initTimeframeFilters(onFilterChange) {
  const filterBtns = document.querySelectorAll(".timeframe-filter-btn");
  if (!filterBtns || filterBtns.length === 0) return;

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const filter = btn.getAttribute("data-filter") || "today";

      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      await renderTimeAnalytics(filter);
      if (typeof onFilterChange === "function") {
        onFilterChange(filter);
      }
    });
  });
}

