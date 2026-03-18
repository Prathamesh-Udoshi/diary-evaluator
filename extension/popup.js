// ============================================================
// VTU Diary Evaluator – Popup Script
// Fetches paginated diary entries and groups by Day / Week / Month
// Features: Dynamic Calendar, AI Evaluation Integration, Modern UI
// ============================================================

const API_BASE = "https://vtuapi.internyet.in/api/v1/student/internship-diaries";
const BACKEND_BASE = "http://localhost:8000"; // AI Evaluation Backend
const CACHE_KEY = "vtu_diary_cache";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ─── State ──────────────────────────────────────────────────
let allEntries = [];
let currentView = "day"; // day, week, month

// Selections
let activeMonth = ""; // YYYY-MM
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

  if (!activeMonth) {
    const d = new Date(allEntries[0].date);
    activeMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  let html = renderSummaryStats();
  html += `<div class="view-selectors">${renderContextSelectors()}</div>`;

  const filtered = filterEntries();
  
  if (currentView !== "day" && filtered.length > 0) {
    html += `
      <button class="ai-analyze-btn" id="bulk-analyze-btn">
        <svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        Analyze ${currentView.charAt(0).toUpperCase() + currentView.slice(1)} Performance
      </button>
      <div id="bulk-ai-result"></div>
    `;
  }

  if (filtered.length === 0) {
    html += `<div class="empty-state">No entries for this selection.</div>`;
  } else {
    html += filtered.map(e => renderCard(e)).join("");
  }

  contentEl.innerHTML = html;
  
  attachSelectorListeners();
  attachExpandListeners();
  attachAnalyzeListeners(filtered);
}

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
  } else {
    return monthSelect;
  }
}

function filterEntries() {
  return allEntries.filter(e => {
    const d = new Date(e.date);
    const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (mKey !== activeMonth) return false;
    if (currentView === "day") return normalizeDate(e.date) === activeDay;
    if (currentView === "week") return getMonthWeek(d) == activeWeek;
    return true;
  });
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
    <div class="diary-card" id="card-${entry.id}">
      <div class="card-meta">
        <span class="card-date-badge">${dateStr}</span>
        <span class="card-hours-badge">${hours} hrs</span>
      </div>
      
      <div class="card-description" id="desc-${entry.id}">${desc}</div>
      ${isLong ? `<button class="toggle-btn" data-target="desc-${entry.id}">Show more</button>` : ""}
      
      ${learns ? `<div class="card-section"><div class="section-label">Learnings</div><div class="section-content">${learns}</div></div>` : ""}
      ${blocks ? `<div class="card-section"><div class="section-label">Blockers</div><div class="section-content">${blocks}</div></div>` : ""}
      ${links ? `<div class="card-section"><div class="section-label">Links & References</div><div class="links-grid">${links}</div></div>` : ""}

      <button class="ai-analyze-btn daily-analyze-btn" data-id="${entry.id}">
        <svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
        AI Evaluation
      </button>
      <div id="ai-res-${entry.id}"></div>
    </div>`;
}

// ============================================================
// AI Integration
// ============================================================

async function performAnalysis(type, payload, targetEl) {
  targetEl.innerHTML = `
    <div class="ai-loading-state">
      <div class="spinner"></div>
      <p>AI is evaluating your diary<span class="ai-thinking-dots"><span>.</span><span>.</span><span>.</span></span></p>
    </div>
  `;

  try {
    const endpoint = type === "daily" ? "/analyze/daily" : (type === "week" ? "/analyze/weekly" : "/analyze/monthly");
    const response = await fetch(`${BACKEND_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("Backend unavailable. Ensure it is running.");
    const data = await response.json();
    
    targetEl.innerHTML = renderAIResult(type, data);
  } catch (err) {
    targetEl.innerHTML = `
      <div class="error-state" style="padding:15px; font-size:11px;">
        ⚠️ ${err.message}<br>Check if backend is live at 8000.
      </div>`;
  }
}

function renderAIResult(type, data) {
  if (type === "daily") {
    const skills = Array.isArray(data.skills) ? data.skills : [];
    return `
      <div class="ai-result-card">
        <div class="ai-header"><span class="ai-badge">Daily Feedback</span></div>
        <div class="ai-scores">
          <span class="score-pill">Clarity: <b>${data.clarity}/10</b></span>
          <span class="score-pill">Depth: <b>${data.depth}/10</b></span>
          <span class="score-pill">Technical: <b>${data.technical_relevance}/10</b></span>
        </div>
        <div class="ai-summary">${data.summary}</div>
        
        ${skills.length > 0 ? `
          <div class="ai-list-title">Skills Identified</div>
          <div class="ai-tag-cloud">${skills.map(s => `<span class="ai-tag">${escapeHtml(s)}</span>`).join("")}</div>
        ` : ''}

        <div class="card-section" style="margin-top:12px; border-top:1px dashed #e2e8f0; padding-top:10px;">
          <div class="section-label" style="color:var(--accent-success)">Improvement Tip</div>
          <div class="section-content">${escapeHtml(data.improvement)}</div>
        </div>
      </div>`;
  } else {
    const isWeekly = !!data.weekly_score;
    const score = isWeekly ? data.weekly_score : data.overall_score;
    const trend = isWeekly ? data.growth_trend : data.progress_trend;
    const list = isWeekly ? data.top_skills : data.recommendations;
    const title = isWeekly ? 'Top Skills' : 'Recommendations';
    
    return `
      <div class="ai-result-card">
        <div class="ai-header"><span class="ai-badge">${isWeekly ? 'Weekly' : 'Monthly'} Report</span></div>
        <div class="ai-scores">
          <div class="stat-item" style="flex:none; padding-right:20px; border-right:1px solid #e2e8f0;">
            <div class="stat-val" style="color:var(--accent-primary)">${score}</div>
            <div class="stat-lab">Total Score</div>
          </div>
          <div style="flex:1; padding-left:15px;">
            <div class="section-label">Trend</div>
            <div style="font-size:12px; font-weight:600; color:var(--text-secondary)">${escapeHtml(trend)}</div>
          </div>
        </div>
        <div class="ai-summary">${escapeHtml(data.summary || "")}</div>
        <div class="ai-list-title">${title}</div>
        <div class="ai-tag-cloud">
          ${(Array.isArray(list) ? list : []).map(item => `<span class="ai-tag">${escapeHtml(item)}</span>`).join("")}
        </div>
      </div>`;
  }
}

// ─── Listeners ──────────────────────────────────────────────

function attachAnalyzeListeners(filteredEntries) {
  document.querySelectorAll(".daily-analyze-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const entry = allEntries.find(e => Number(e.id) === id);
      if (!entry) return;

      const payload = { 
        date: entry.date, 
        description: entry.description,
        hours: parseFloat(entry.hours) || 0,
        links: entry.links || "",
        blockers: entry.blockers || "",
        learnings: entry.learnings || ""
      };
      
      performAnalysis("daily", payload, document.getElementById(`ai-res-${id}`));
    });
  });

  const bulkBtn = document.getElementById("bulk-analyze-btn");
  if (bulkBtn) {
    bulkBtn.addEventListener("click", () => {
      const payload = { 
        entries: filteredEntries.map(e => ({
          date: e.date,
          description: e.description,
          hours: e.hours,
          learnings: e.learnings,
          blockers: e.blockers,
          links: e.links
        }))
      };
      performAnalysis(currentView, payload, document.getElementById("bulk-ai-result"));
    });
  }
}

// ============================================================
// Helpers
// ============================================================

function getSummaryStats() {
  const totalEntries = allEntries.length;
  const totalHours = allEntries.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
  const uniqueDays = new Set(allEntries.map((e) => normalizeDate(e.date))).size;
  return { totalEntries, totalHours, uniqueDays };
}

function renderSummaryStats() {
  const stats = getSummaryStats();
  return `
    <div class="summary-stats">
      <div class="stat-item"><div class="stat-val">${stats.totalEntries}</div><div class="stat-lab">Entries</div></div>
      <div class="stat-item"><div class="stat-val">${stats.totalHours.toFixed(1)}</div><div class="stat-lab">Hours</div></div>
      <div class="stat-item"><div class="stat-val">${stats.uniqueDays}</div><div class="stat-lab">Total Days</div></div>
    </div>`;
}

function renderCalendarGrid() {
  const [year, month] = activeMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const entryDates = new Set(allEntries.map(e => normalizeDate(e.date)));
  const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  
  let html = `<div class="calendar-grid">`;
  weekdays.forEach(w => html += `<div class="calendar-day-label">${w}</div>`);
  for (let i = 0; i < firstDay; i++) html += `<div></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const hasData = entryDates.has(dateStr);
    const isSelected = activeDay === dateStr;
    html += `
      <div class="calendar-date ${hasData ? 'active has-data' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
        ${d}
      </div>`;
  }
  html += `</div>`;
  return html;
}

function getAvailableMonths() {
  const months = new Map();
  allEntries.forEach(e => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    months.set(key, label);
  });
  return Array.from(months.entries()).map(([key, label]) => ({ key, label })).sort((a, b) => b.key.localeCompare(a.key));
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
  return linksStr.split(/[,\s]+/).map(s => s.trim()).filter(s => s.startsWith("http")).map(url => {
    const display = url.replace(/^https?:\/\//, "").slice(0, 30) + (url.length > 30 ? "…" : "");
    return `<a href="${url}" target="_blank" class="link-item">${escapeHtml(display)}</a>`;
  }).join("");
}

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

function attachSelectorListeners() {
  const ms = document.getElementById("month-dropdown");
  if (ms) ms.addEventListener("change", (e) => { activeMonth = e.target.value; activeDay = ""; renderView(); });
  const ws = document.getElementById("week-dropdown");
  if (ws) ws.addEventListener("change", (e) => { activeWeek = Number(e.target.value); renderView(); });
  document.querySelectorAll(".calendar-date.active").forEach(el => {
    el.addEventListener("click", () => { activeDay = el.dataset.date; renderView(); });
  });
}

function attachExpandListeners() {
  document.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target);
      const isExp = target.classList.toggle("expanded");
      btn.textContent = isExp ? "Show less" : "Show more";
    });
  });
}

async function loadEntries(forceRefresh = false) {
  showLoading();
  refreshBtn.classList.add("spinning");
  try {
    allEntries = await fetchAllEntries(forceRefresh);
    if (allEntries.length) {
       const recent = allEntries[0];
       const d = new Date(recent.date);
       activeMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
       activeDay = normalizeDate(recent.date);
       activeWeek = getMonthWeek(d);
       const iname = recent.internship?.name;
       if (iname) { internshipNameEl.textContent = iname; internshipNameEl.style.display = "block"; }
    }
    entryCountEl.textContent = `${allEntries.length} entries recorded`;
    renderView();
  } catch (err) { showError(err.message); } finally { refreshBtn.classList.remove("spinning"); }
}

function showLoading() { contentEl.innerHTML = `<div class="loading"><div class="spinner"></div><p>Fetching diaries…</p><p class="loading-sub" id="loading-progress"></p></div>`; }
function updateProgress(text) { const el = document.getElementById("loading-progress"); if (el) el.textContent = text; }
function showError(msg) { contentEl.innerHTML = `<div class="error-state"><h3>Error</h3><p>${msg}</p><button class="retry-btn" onclick="location.reload()">Retry</button></div>`; }
tabs.forEach(tab => { tab.addEventListener("click", () => { tabs.forEach(t => t.classList.remove("active")); tab.classList.add("active"); currentView = tab.dataset.view; renderView(); }); });
refreshBtn.addEventListener("click", () => loadEntries(true));

document.addEventListener("DOMContentLoaded", () => loadEntries(false));
