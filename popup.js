// ============================================================
// VTU Diary Evaluator – Popup Script
// Fetches paginated diary entries and groups by Day / Week / Month
// Features: Dynamic Calendar, Dropdown Selectors, Modern Slate UI
// ============================================================

const API_BASE = "https://vtuapi.internyet.in/api/v1/student/internship-diaries";
const CACHE_KEY = "vtu_diary_cache";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ─── State ──────────────────────────────────────────────────
let allEntries = [];
let currentView = "day"; // day, week, month

// Selections
let activeMonth = ""; // YYYY-MM (e.g., "2024-03")
let activeDay = "";   // YYYY-MM-DD
let activeWeek = 1;   // 1, 2, 3, 4

// ─── DOM Refs ───────────────────────────────────────────────
const contentEl = document.getElementById("content");
const entryCountEl = document.getElementById("entry-count");
const internshipNameEl = document.getElementById("internship-name");
const refreshBtn = document.getElementById("refresh-btn");
const tabs = document.querySelectorAll(".tab");

// ============================================================
// Data Fetching
// ============================================================

async function fetchPage(page) {
  const res = await fetch(`${API_BASE}?page=${page}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`API responded with ${res.status}`);
  return res.json();
}

async function fetchAllEntries(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCachedEntries();
    if (cached) return cached;
  }

  const firstResponse = await fetchPage(1);
  const paginationData = firstResponse?.data ?? firstResponse?.response?.data ?? {};
  const lastPage = paginationData.last_page || 1;
  let entries = extractEntries(firstResponse);

  updateProgress(`Fetch 1 / ${lastPage}`);

  for (let page = 2; page <= lastPage; page++) {
    updateProgress(`Fetch ${page} / ${lastPage}`);
    const pageResponse = await fetchPage(page);
    entries = entries.concat(extractEntries(pageResponse));
  }

  entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  cacheEntries(entries);
  return entries;
}

function extractEntries(apiResponse) {
  if (apiResponse?.response?.data?.data) return apiResponse.response.data.data;
  if (apiResponse?.data?.data) return apiResponse.data.data;
  if (Array.isArray(apiResponse?.data)) return apiResponse.data;
  return [];
}

// ─── Caching ───────────────────────────────────────────────
function cacheEntries(entries) {
  try {
    const payload = { entries, timestamp: Date.now() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

function getCachedEntries() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { entries, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return entries;
  } catch { return null; }
}

// ============================================================
// Rendering Logic
// ============================================================

function renderView() {
  if (!allEntries.length) {
    contentEl.innerHTML = `<div class="empty-state">No entries found. Refresh or login.</div>`;
    return;
  }

  // Ensure activeMonth is set (default to most recent entry's month)
  if (!activeMonth) {
    const d = new Date(allEntries[0].date);
    activeMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  let html = renderSummaryStats();
  html += `<div class="view-selectors">${renderContextSelectors()}</div>`;

  // Filter and Render Cards
  const filtered = filterEntries();
  if (filtered.length === 0) {
    html += `<div class="empty-state">No entries for this selection.</div>`;
  } else {
    html += filtered.map(e => renderCard(e)).join("");
  }

  contentEl.innerHTML = html;
  
  // Attach listeners dynamically
  attachSelectorListeners();
  attachExpandListeners();
}

/**
 * Renders selectors based on the current view tab
 */
function renderContextSelectors() {
  const months = getAvailableMonths();
  const monthSelect = `
    <div class="select-wrap">
      <label class="label">Select Month</label>
      <select id="month-dropdown">
        ${months.map(m => `<option value="${m.key}" ${m.key === activeMonth ? 'selected' : ''}>${m.label}</option>`).join("")}
      </select>
    </div>
  `;

  if (currentView === "day") {
    return monthSelect + renderCalendarGrid();
  } else if (currentView === "week") {
    const weeks = [1, 2, 3, 4];
    return `
      <div class="dropdown-group">
        ${monthSelect}
        <div class="select-wrap">
          <label class="label">Select Week</label>
          <select id="week-dropdown">
            ${weeks.map(w => `<option value="${w}" ${w == activeWeek ? 'selected' : ''}>Week ${w}</option>`).join("")}
          </select>
        </div>
      </div>
    `;
  } else { // month view
    return monthSelect;
  }
}

/**
 * Filter entries based on the current view state
 */
function filterEntries() {
  return allEntries.filter(e => {
    const d = new Date(e.date);
    const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    
    if (mKey !== activeMonth) return false;

    if (currentView === "day") {
      return normalizeDate(e.date) === activeDay;
    } else if (currentView === "week") {
      return getMonthWeek(d) == activeWeek;
    }
    return true; // month view: just match month
  });
}

// ============================================================
// UI Components
// ============================================================

function renderSummaryStats() {
  const totalEntries = allEntries.length;
  const totalHours = allEntries.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
  const uniqueDays = new Set(allEntries.map((e) => normalizeDate(e.date))).size;

  return `
    <div class="summary-stats">
      <div class="stat-item"><div class="stat-val">${totalEntries}</div><div class="stat-lab">Entries</div></div>
      <div class="stat-item"><div class="stat-val">${totalHours.toFixed(1)}</div><div class="stat-lab">Hours</div></div>
      <div class="stat-item"><div class="stat-val">${uniqueDays}</div><div class="stat-lab">Total Days</div></div>
    </div>`;
}

function renderCalendarGrid() {
  const [year, month] = activeMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0-6
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Create a map of YYYY-MM-DD -> hasData (boolean)
  const entryDates = new Set(allEntries.map(e => normalizeDate(e.date)));
  
  const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  let html = `<div class="calendar-grid">`;
  
  // Weekday labels
  weekdays.forEach(w => html += `<div class="calendar-day-label">${w}</div>`);
  
  // Empty start cells
  for (let i = 0; i < firstDay; i++) html += `<div></div>`;
  
  // Dates
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const hasData = entryDates.has(dateStr);
    const isSelected = activeDay === dateStr;
    const isToday = normalizeDate(new Date()) === dateStr;
    
    html += `
      <div class="calendar-date ${hasData ? 'active has-data' : ''} ${isSelected ? 'selected' : ''}" 
           data-date="${dateStr}">
        ${d}
      </div>`;
  }
  
  html += `</div>`;
  return html;
}

function renderCard(entry) {
  const dateStr = formatDateFriendly(entry.date);
  const hours = parseFloat(entry.hours) || 0;
  const desc = escapeHtml(entry.description || "N/A");
  const learns = entry.learnings ? escapeHtml(entry.learnings) : "";
  const blocks = entry.blockers ? escapeHtml(entry.blockers) : "";
  const links = renderLinks(entry.links);
  
  const isLong = desc.length > 200;

  return `
    <div class="diary-card">
      <div class="card-meta">
        <span class="card-date-badge">${dateStr}</span>
        <span class="card-hours-badge">${hours} hrs</span>
      </div>
      
      <div class="card-description" id="desc-${entry.id}">${desc}</div>
      ${isLong ? `<button class="toggle-btn" data-target="desc-${entry.id}">Show more</button>` : ""}
      
      ${learns ? `<div class="card-section"><div class="section-label">Learnings</div><div class="section-content">${learns}</div></div>` : ""}
      ${blocks ? `<div class="card-section"><div class="section-label">Blockers</div><div class="section-content">${blocks}</div></div>` : ""}
      ${links ? `<div class="card-section"><div class="section-label">Links & References</div><div class="links-grid">${links}</div></div>` : ""}
    </div>`;
}

// ============================================================
// Helpers & Listeners
// ============================================================

function getAvailableMonths() {
  const months = new Map();
  allEntries.forEach(e => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    months.set(key, label);
  });
  return Array.from(months.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => b.key.localeCompare(a.key)); // Newest month first
}

function getMonthWeek(date) {
  const day = date.getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

function normalizeDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateFriendly(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", weekday: "short" });
}

function renderLinks(linksStr) {
  if (!linksStr) return "";
  return linksStr.split(/[,\s]+/)
    .map(s => s.trim())
    .filter(s => s.startsWith("http"))
    .map(url => {
       const display = url.replace(/^https?:\/\//, "").slice(0, 30) + (url.length > 30 ? "…" : "");
       return `<a href="${url}" target="_blank" class="link-item">${escapeHtml(display)}</a>`;
    }).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

// ─── Listeners ──────────────────────────────────────────────

function attachSelectorListeners() {
  // Dropdowns
  const monthSelect = document.getElementById("month-dropdown");
  if (monthSelect) {
    monthSelect.addEventListener("change", (e) => {
      activeMonth = e.target.value;
      activeDay = ""; // Reset day on month change
      renderView();
    });
  }

  const weekSelect = document.getElementById("week-dropdown");
  if (weekSelect) {
    weekSelect.addEventListener("change", (e) => {
      activeWeek = Number(e.target.value);
      renderView();
    });
  }

  // Calendar dates
  document.querySelectorAll(".calendar-date.active").forEach(el => {
    el.addEventListener("click", () => {
      activeDay = el.dataset.date;
      renderView();
    });
  });
}

function attachExpandListeners() {
  document.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target);
      const isExpanded = target.classList.toggle("expanded");
      btn.textContent = isExpanded ? "Show less" : "Show more";
    });
  });
}

// ============================================================
// Main UI Flow
// ============================================================

async function loadEntries(forceRefresh = false) {
  showLoading();
  refreshBtn.classList.add("spinning");
  try {
    allEntries = await fetchAllEntries(forceRefresh);
    
    // Auto-select initial state
    if (allEntries.length) {
       const recent = allEntries[0];
       const d = new Date(recent.date);
       activeMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
       activeDay = normalizeDate(recent.date);
       activeWeek = getMonthWeek(d);
       
       const internshipName = recent.internship?.name;
       if (internshipName) {
         internshipNameEl.textContent = internshipName;
         internshipNameEl.style.display = "block";
       }
    }

    entryCountEl.textContent = `${allEntries.length} entries recorded`;
    renderView();
  } catch (err) {
    showError(err.message);
  } finally {
    refreshBtn.classList.remove("spinning");
  }
}

function showLoading() {
  contentEl.innerHTML = `<div class="loading"><div class="spinner"></div><p>Fetching diaries…</p><p class="loading-sub" id="loading-progress"></p></div>`;
}

function updateProgress(text) {
  const el = document.getElementById("loading-progress");
  if (el) el.textContent = text;
}

function showError(msg) {
  contentEl.innerHTML = `<div class="error-state"><h3>Error</h3><p>${msg}</p><button class="retry-btn" onclick="location.reload()">Retry</button></div>`;
}

// Tab interaction
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentView = tab.dataset.view;
    renderView();
  });
});

refreshBtn.addEventListener("click", () => loadEntries(true));

document.addEventListener("DOMContentLoaded", async () => {
  loadEntries(false);
});
