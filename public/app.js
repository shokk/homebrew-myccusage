'use strict';

const REFRESH_MS = 60 * 1000;

const els = {
  granularity: document.getElementById('granularity'),
  since: document.getElementById('since'),
  until: document.getElementById('until'),
  agent: document.getElementById('agent'),
  model: document.getElementById('model'),
  refreshNow: document.getElementById('refresh-now'),
  lastUpdated: document.getElementById('last-updated'),
  errorBanner: document.getElementById('error-banner'),
  summaryCards: document.getElementById('summary-cards'),
  tbody: document.getElementById('usage-tbody'),
  emptyState: document.getElementById('empty-state'),
  themeBtns: Array.from(document.querySelectorAll('.theme-btn')),
  sortHeaders: Array.from(document.querySelectorAll('th.sortable')),
};

let latestRows = [];
let pollTimer = null;
let sortState = { key: 'period', direction: 'desc' };

const STRING_KEYS = new Set(['period', 'agent', 'model']);

// ---------- theme ----------

function applyTheme(choice) {
  const root = document.documentElement;
  if (choice === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', choice);
  }
  els.themeBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.themeChoice === choice);
  });
  localStorage.setItem('ccusage-theme', choice);
}

function initTheme() {
  const saved = localStorage.getItem('ccusage-theme') || 'system';
  applyTheme(saved);
  els.themeBtns.forEach((btn) => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.themeChoice));
  });
}

// ---------- formatting ----------

const numberFmt = new Intl.NumberFormat('en-US');
const costFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtInt(n) { return numberFmt.format(n || 0); }
function fmtCost(n) {
  // Round up to the nearest cent (never under-report cost), then format to exactly 2 decimals.
  const roundedUp = Math.ceil((n || 0) * 100) / 100;
  return costFmt.format(roundedUp);
}

// ---------- data fetch ----------

function buildQuery() {
  const params = new URLSearchParams();
  params.set('granularity', els.granularity.value);
  if (els.since.value) params.set('since', els.since.value.replace(/-/g, ''));
  if (els.until.value) params.set('until', els.until.value.replace(/-/g, ''));
  return params.toString();
}

async function fetchUsage() {
  const query = buildQuery();
  const res = await fetch(`/api/usage?${query}`);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

function showError(message) {
  if (!message) {
    els.errorBanner.classList.add('hidden');
    els.errorBanner.textContent = '';
    return;
  }
  els.errorBanner.textContent = message;
  els.errorBanner.classList.remove('hidden');
}

// ---------- filter option population ----------

function populateSelect(select, values, allLabel) {
  const current = select.value;
  const sorted = Array.from(values).sort();
  select.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = '__all__';
  allOpt.textContent = allLabel;
  select.appendChild(allOpt);
  for (const v of sorted) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  }
  if (current && (current === '__all__' || sorted.includes(current))) {
    select.value = current;
  } else {
    select.value = '__all__';
  }
}

function collectAgentsAndModels(rows) {
  const agents = new Set();
  const models = new Set();
  for (const row of rows) {
    for (const a of row.agents || []) {
      agents.add(a.agent);
      for (const mb of a.modelBreakdowns || []) {
        models.add(mb.modelName);
      }
    }
  }
  return { agents, models };
}

// ---------- render ----------

function filteredEntries(rows) {
  const agentFilter = els.agent.value;
  const modelFilter = els.model.value;
  const entries = [];

  for (const row of rows) {
    for (const a of row.agents || []) {
      if (agentFilter !== '__all__' && a.agent !== agentFilter) continue;
      for (const mb of a.modelBreakdowns || []) {
        if (modelFilter !== '__all__' && mb.modelName !== modelFilter) continue;
        entries.push({
          period: row.period,
          agent: a.agent,
          model: mb.modelName,
          inputTokens: mb.inputTokens,
          outputTokens: mb.outputTokens,
          cacheCreationTokens: mb.cacheCreationTokens,
          cacheReadTokens: mb.cacheReadTokens,
          totalTokens: (mb.inputTokens || 0) + (mb.outputTokens || 0) + (mb.cacheCreationTokens || 0) + (mb.cacheReadTokens || 0),
          cost: mb.cost,
        });
      }
    }
  }
  return entries;
}

function renderSummary(entries) {
  const totals = entries.reduce((acc, e) => {
    acc.input += e.inputTokens || 0;
    acc.output += e.outputTokens || 0;
    acc.cacheCreate += e.cacheCreationTokens || 0;
    acc.cacheRead += e.cacheReadTokens || 0;
    acc.tokens += e.totalTokens || 0;
    acc.cost += e.cost || 0;
    return acc;
  }, { input: 0, output: 0, cacheCreate: 0, cacheRead: 0, tokens: 0, cost: 0 });

  const cards = [
    ['Total Cost', fmtCost(totals.cost)],
    ['Total Tokens', fmtInt(totals.tokens)],
    ['Input Tokens', fmtInt(totals.input)],
    ['Output Tokens', fmtInt(totals.output)],
    ['Cache Create', fmtInt(totals.cacheCreate)],
    ['Cache Read', fmtInt(totals.cacheRead)],
  ];

  els.summaryCards.innerHTML = cards.map(([label, value]) => `
    <div class="summary-card">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
    </div>
  `).join('');
}

function sortEntries(entries) {
  const { key, direction } = sortState;
  const sign = direction === 'asc' ? 1 : -1;
  const sorted = entries.slice().sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (STRING_KEYS.has(key)) {
      return sign * String(av).localeCompare(String(bv));
    }
    return sign * ((av || 0) - (bv || 0));
  });
  return sorted;
}

function updateSortHeaders() {
  for (const th of els.sortHeaders) {
    const isActive = th.dataset.key === sortState.key;
    th.classList.toggle('sort-active', isActive);
    const arrow = isActive ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕';
    const existing = th.querySelector('.sort-indicator');
    if (existing) existing.remove();
    const span = document.createElement('span');
    span.className = 'sort-indicator';
    span.textContent = arrow;
    th.appendChild(span);
  }
}

function renderTable(entries) {
  if (entries.length === 0) {
    els.tbody.innerHTML = '';
    els.emptyState.classList.remove('hidden');
    return;
  }
  els.emptyState.classList.add('hidden');
  entries = sortEntries(entries);

  const rowsHtml = entries.map((e) => `
    <tr>
      <td>${e.period}</td>
      <td>${e.agent}</td>
      <td>${e.model}</td>
      <td>${fmtInt(e.inputTokens)}</td>
      <td>${fmtInt(e.outputTokens)}</td>
      <td>${fmtInt(e.cacheCreationTokens)}</td>
      <td>${fmtInt(e.cacheReadTokens)}</td>
      <td>${fmtInt(e.totalTokens)}</td>
      <td>${fmtCost(e.cost)}</td>
    </tr>
  `).join('');

  els.tbody.innerHTML = rowsHtml;
}

function render() {
  const entries = filteredEntries(latestRows);
  renderSummary(entries);
  renderTable(entries);
}

// ---------- refresh cycle ----------

let requestSeq = 0;

async function refresh({ resetFilters = false } = {}) {
  const seq = ++requestSeq;
  const requestedGranularity = els.granularity.value;
  try {
    const data = await fetchUsage();
    if (seq !== requestSeq) return; // a newer request already landed; drop this stale one
    latestRows = data[requestedGranularity] || [];

    if (resetFilters) {
      const { agents, models } = collectAgentsAndModels(latestRows);
      populateSelect(els.agent, agents, 'All agents');
      populateSelect(els.model, models, 'All models');
    }

    render();
    showError(null);
    els.lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    if (seq !== requestSeq) return; // a newer request superseded this one; don't show a stale error
    showError(`Failed to load ccusage data: ${err.message}`);
  }
}

function restartPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => refresh({ resetFilters: false }), REFRESH_MS);
}

// ---------- wiring ----------

function init() {
  initTheme();

  els.granularity.addEventListener('change', () => refresh({ resetFilters: true }));
  els.since.addEventListener('change', () => refresh({ resetFilters: true }));
  els.until.addEventListener('change', () => refresh({ resetFilters: true }));
  els.agent.addEventListener('change', render);
  els.model.addEventListener('change', render);
  els.refreshNow.addEventListener('click', () => refresh({ resetFilters: false }));

  for (const th of els.sortHeaders) {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (sortState.key === key) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
      } else {
        // period defaults to most-recent-first; other string columns default A-Z.
        const defaultDirection = key === 'period' ? 'desc' : (STRING_KEYS.has(key) ? 'asc' : 'desc');
        sortState = { key, direction: defaultDirection };
      }
      updateSortHeaders();
      render();
    });
  }
  updateSortHeaders();

  refresh({ resetFilters: true });
  restartPolling();
}

init();
