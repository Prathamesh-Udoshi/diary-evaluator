// ============================================================
// VTU Diary Evaluator – Popup Script
// Fetches paginated diary entries and groups by Day / Week / Month
// ============================================================

const API_BASE = "https://vtuapi.internyet.in/api/v1/student/internship-diaries";
const CACHE_KEY = "vtu_diary_cache";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ─── State ──────────────────────────────────────────────────
let allEntries = [];
let currentView = "day";
let skillsMap = new Map(); // id → skill name

// ─── DOM Refs ───────────────────────────────────────────────
const contentEl = document.getElementById("content");
const entryCountEl = document.getElementById("entry-count");
const internshipNameEl = document.getElementById("internship-name");
const refreshBtn = document.getElementById("refresh-btn");
const tabs = document.querySelectorAll(".tab");

// ============================================================
// Data Fetching
// ============================================================

/**
 * Fetches a single page from the paginated API.
 * @param {number} page
 * @returns {Promise<Object>} Raw API response JSON
 */
async function fetchPage(page) {
  const res = await fetch(`${API_BASE}?page=${page}`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`API responded with status ${res.status} on page ${page}`);
  }

  return res.json();
}

/**
 * Fetches ALL diary entries by iterating through every page.
 * Updates the loading progress indicator as pages are fetched.
 * @param {boolean} [forceRefresh=false] Skip cache if true
 * @returns {Promise<Array>} Combined array of all diary entries
 */
async function fetchAllEntries(forceRefresh = false) {
  // Check cache first
  if (!forceRefresh) {
    const cached = getCachedEntries();
    if (cached) return cached;
  }

  // Fetch page 1 to discover total pages
  const firstResponse = await fetchPage(1);
  const paginationData = firstResponse?.data ?? firstResponse?.response?.data ?? {};
  const lastPage = paginationData.last_page || 1;
  let entries = extractEntries(firstResponse);

  updateProgress(`Page 1 of ${lastPage}`);

  // Fetch remaining pages
  for (let page = 2; page <= lastPage; page++) {
    updateProgress(`Page ${page} of ${lastPage}`);
    const pageResponse = await fetchPage(page);
    entries = entries.concat(extractEntries(pageResponse));
  }

  // Sort by date descending (most recent first)
  entries.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Cache the result
  cacheEntries(entries);

  return entries;
}

/**
 * Extracts the entries array from the API response.
 * Handles both `response.data.data` and `data.data` structures.
 */
function extractEntries(apiResponse) {
  // Try response.data.data first (as specified)
  if (apiResponse?.response?.data?.data) {
    return apiResponse.response.data.data;
  }
  // Fallback: data.data
  if (apiResponse?.data?.data) {
    return apiResponse.data.data;
  }
  // Fallback: data is array directly
  if (Array.isArray(apiResponse?.data)) {
    return apiResponse.data;
  }
  return [];
}

// ============================================================
// Caching (sessionStorage)
// ============================================================

function cacheEntries(entries) {
  try {
    const payload = { entries, timestamp: Date.now() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage might fail in some contexts, ignore silently
  }
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
  } catch {
    return null;
  }
}

// ============================================================
// Grouping Functions
// ============================================================

/** Selected key for each view (persists when switching tabs) */
let selectedKeys = { day: null, week: null, month: null };

/**
 * Groups entries by exact date (YYYY-MM-DD).
 * Returns an ordered array of { key, label, shortLabel, count, entries }.
 */
function groupByDay(entries) {
  const map = new Map();
  for (const entry of entries) {
    const key = normalizeDate(entry.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  }
  return [...map.entries()].map(([key, ents]) => ({
    key,
    label: formatGroupDate(key),
    shortLabel: formatDateShort(key),
    count: ents.length,
    entries: ents,
  }));
}

/**
 * Returns month-relative week number (1–4).
 * Week 1: days 1–7, Week 2: 8–14, Week 3: 15–21, Week 4: 22–end
 */
function getMonthWeek(date) {
  const day = date.getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

/**
 * Groups entries by month-relative week (Week 1–4 per month).
 * Returns an ordered array of { key, label, shortLabel, count, entries }.
 */
function groupByWeek(entries) {
  const map = new Map();
  for (const entry of entries) {
    const d = new Date(entry.date);
    const weekNum = getMonthWeek(d);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}-W${weekNum}`;

    if (!map.has(key)) {
      const monthName = d.toLocaleString("en-US", { month: "long" });
      map.set(key, {
        label: `Week ${weekNum} - ${monthName} ${year}`,
        shortLabel: `W${weekNum} · ${d.toLocaleString("en-US", { month: "short" })}`,
        entries: [],
      });
    }
    map.get(key).entries.push(entry);
  }
  return [...map.entries()].map(([key, g]) => ({
    key,
    label: g.label,
    shortLabel: g.shortLabel,
    count: g.entries.length,
    entries: g.entries,
  }));
}

/**
 * Groups entries by month and year.
 * Returns an ordered array of { key, label, shortLabel, count, entries }.
 */
function groupByMonth(entries) {
  const map = new Map();
  for (const entry of entries) {
    const d = new Date(entry.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    if (!map.has(key)) {
      map.set(key, {
        label: d.toLocaleString("en-US", { month: "long", year: "numeric" }),
        shortLabel: d.toLocaleString("en-US", { month: "short", year: "2-digit" }),
        entries: [],
      });
    }
    map.get(key).entries.push(entry);
  }
  return [...map.entries()].map(([key, g]) => ({
    key,
    label: g.label,
    shortLabel: g.shortLabel,
    count: g.entries.length,
    entries: g.entries,
  }));
}

// ============================================================
// Date Helpers
// ============================================================

function normalizeDate(dateStr) {
  const d = new Date(dateStr);
  return d.toISOString().split("T")[0];
}

function formatDateFriendly(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatGroupDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ============================================================
// Rendering
// ============================================================

function renderView() {
  if (!allEntries.length) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📓</div>
        <p>No diary entries found.</p>
        <p>Make sure you're logged in at <strong>vtu.internyet.in</strong></p>
      </div>`;
    return;
  }

  // Compute groups for current view
  let groups;
  switch (currentView) {
    case "day": groups = groupByDay(allEntries); break;
    case "week": groups = groupByWeek(allEntries); break;
    case "month": groups = groupByMonth(allEntries); break;
  }

  if (!groups.length) return;

  // Resolve selected key (default to first/most recent)
  let activeKey = selectedKeys[currentView];
  const activeGroup = groups.find((g) => g.key === activeKey);
  if (!activeGroup) {
    activeKey = groups[0].key;
    selectedKeys[currentView] = activeKey;
  }

  const selected = activeGroup || groups[0];
  const mostRecentId = allEntries[0]?.id;

  let html = renderSummaryStats();
  html += renderPeriodSelector(groups, activeKey);
  html += renderSelectedHeader(selected);
  html += selected.entries.map((e) => renderCard(e, mostRecentId)).join("");

  contentEl.innerHTML = html;
  attachExpandListeners();
  attachSelectorListeners();
}

// ─── Summary Stats ──────────────────────────────────────────

function renderSummaryStats() {
  const totalEntries = allEntries.length;
  const totalHours = allEntries.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
  const uniqueDays = new Set(allEntries.map((e) => normalizeDate(e.date))).size;

  return `
    <div class="summary-stats">
      <div class="stat-card">
        <div class="stat-value">${totalEntries}</div>
        <div class="stat-label">Entries</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalHours.toFixed(1)}</div>
        <div class="stat-label">Hours</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${uniqueDays}</div>
        <div class="stat-label">Days</div>
      </div>
    </div>`;
}

// ─── Period Selector ────────────────────────────────────────

function renderPeriodSelector(groups, activeKey) {
  const items = groups
    .map(
      (g) => `
      <button class="period-item${g.key === activeKey ? " active" : ""}" data-key="${g.key}">
        <span class="period-label">${g.shortLabel}</span>
        <span class="period-count">${g.count}</span>
      </button>`
    )
    .join("");

  return `<div class="period-selector-wrap"><div class="period-selector">${items}</div></div>`;
}

function renderSelectedHeader(group) {
  return `
    <div class="selected-header">
      <span class="selected-title">${group.label}</span>
      <span class="group-badge">${group.count} ${group.count === 1 ? "entry" : "entries"}</span>
    </div>`;
}

function attachSelectorListeners() {
  contentEl.querySelectorAll(".period-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedKeys[currentView] = btn.dataset.key;
      renderView();
      // Scroll content back to top when selecting a new period
      contentEl.scrollTop = 0;
    });
  });
}

// ─── Diary Card ─────────────────────────────────────────────

function renderCard(entry, mostRecentId) {
  const isMostRecent = entry.id === mostRecentId;
  const date = formatDateFriendly(entry.date);
  const hours = parseFloat(entry.hours) || 0;
  const description = escapeHtml(entry.description || "No description provided.");
  const learnings = entry.learnings ? escapeHtml(entry.learnings) : "";
  const blockers = entry.blockers ? escapeHtml(entry.blockers) : "";
  const links = entry.links ? renderLinks(entry.links) : "";
  const skills = renderSkills(entry.skills, entry.skill_name);
  const needsExpand = description.length > 200;

  return `
    <div class="diary-card${isMostRecent ? " most-recent" : ""}">
      <div class="card-badge">Latest Entry</div>
      <div class="card-meta">
        <span class="card-date">${date}</span>
        <span class="card-hours">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${hours}h
        </span>
      </div>
      ${skills ? `<div class="card-skills">${skills}</div>` : ""}
      <div class="card-description${needsExpand ? "" : " expanded"}">${description}</div>
      ${needsExpand ? '<button class="toggle-expand">Show more</button>' : ""}
      ${learnings ? `
        <div class="card-learnings">
          <div class="card-learnings-label">Learnings</div>
          <p>${learnings}</p>
        </div>` : ""}
      ${blockers ? `
        <div class="card-blockers">
          <div class="card-blockers-label">Blockers</div>
          <p>${blockers}</p>
        </div>` : ""}
      ${links ? `
        <div class="card-links">
          <div class="card-links-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Links & References
          </div>
          <div class="card-links-list">${links}</div>
        </div>` : ""}
    </div>`;
}

// ─── Helpers (skills, links, html) ──────────────────────────

function renderSkills(skillsArr, fallbackName) {
  let list = [];

  // Handle potential stringified JSON (defensive coding)
  if (typeof skillsArr === "string") {
    try {
      skillsArr = JSON.parse(skillsArr);
    } catch {
      skillsArr = null;
    }
  }

  if (Array.isArray(skillsArr) && skillsArr.length > 0) {
    list = skillsArr.map((s) => {
      const id = Number(s.diary_skill_id || s.id);
      const name = skillsMap.get(id) || `Skill #${id}`;
      return `<span class="skill-tag">${escapeHtml(name)}</span>`;
    });
  } else if (fallbackName && fallbackName !== "Unknown Skill") {
    // Fallback to skill_name if provided and meaningful
    list = [`<span class="skill-tag">${escapeHtml(fallbackName)}</span>`];
  }

  return list.join("");
}

function renderLinks(linksStr) {
  return linksStr
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && (s.startsWith("http://") || s.startsWith("https://")))
    .map((url) => {
      const display = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const short = display.length > 35 ? display.slice(0, 35) + "…" : display;
      return `<a class="link-pill" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(url)}">${escapeHtml(short)}</a>`;
    })
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function attachExpandListeners() {
  contentEl.querySelectorAll(".toggle-expand").forEach((btn) => {
    btn.addEventListener("click", () => {
      const desc = btn.previousElementSibling;
      const isExpanded = desc.classList.toggle("expanded");
      btn.textContent = isExpanded ? "Show less" : "Show more";
    });
  });
}

// ============================================================
// Error / State Rendering
// ============================================================

function showError(message) {
  contentEl.innerHTML = `
    <div class="error-state">
      <div class="error-icon">⚠</div>
      <h3>Something went wrong</h3>
      <p>${escapeHtml(message)}</p>
      <button class="retry-btn" id="retry-btn">Try Again</button>
    </div>`;

  document.getElementById("retry-btn").addEventListener("click", () => {
    loadEntries(true);
  });
}

function showLoading() {
  contentEl.innerHTML = `
    <div class="loading" id="loading">
      <div class="spinner"></div>
      <p>Fetching diary entries…</p>
      <p class="loading-sub" id="loading-progress"></p>
    </div>`;
}

function updateProgress(text) {
  const el = document.getElementById("loading-progress");
  if (el) el.textContent = text;
}

// ============================================================
// Initialization
// ============================================================

async function loadEntries(forceRefresh = false) {
  showLoading();

  refreshBtn.classList.add("spinning");

  try {
    allEntries = await fetchAllEntries(forceRefresh);

    // Reset selections when data refreshes
    selectedKeys = { day: null, week: null, month: null };

    // Update internship name from first entry
    const internshipName = allEntries[0]?.internship?.name;
    if (internshipName) {
      internshipNameEl.textContent = internshipName;
      internshipNameEl.style.display = "block";
    } else {
      internshipNameEl.style.display = "none";
    }

    // Update subtitle
    entryCountEl.textContent = allEntries.length
      ? `${allEntries.length} entries across ${new Set(allEntries.map((e) => normalizeDate(e.date))).size} days`
      : "No entries found";

    renderView();
  } catch (err) {
    console.error("VTU Diary Evaluator Error:", err);

    let userMessage = "Could not fetch diary entries. ";
    if (err.message.includes("401") || err.message.includes("403")) {
      userMessage += "Please make sure you are logged in at vtu.internyet.in and try again.";
    } else if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
      userMessage += "Network error. Check your internet connection and ensure you're on vtu.internyet.in.";
    } else {
      userMessage += err.message;
    }

    showError(userMessage);
    entryCountEl.textContent = "Error loading entries";
  } finally {
    refreshBtn.classList.remove("spinning");
  }
}

// ─── Tab Switching ──────────────────────────────────────────
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentView = tab.dataset.view;
    renderView();
    contentEl.scrollTop = 0;
  });
});

// ─── Refresh Button ─────────────────────────────────────────
refreshBtn.addEventListener("click", () => {
  loadEntries(true);
});

// ─── Boot ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadSkillsMap();
  loadEntries(false);
});

async function loadSkillsMap() {
  try {
    const url = chrome.runtime.getURL("skills.json");
    const res = await fetch(url);
    const skills = await res.json();
    for (const skill of skills) {
      // Ensure key is numeric for consistent Map lookup
      skillsMap.set(Number(skill.id), skill.name);
    }
  } catch (err) {
    console.warn("Could not load skills.json:", err);
  }
}

