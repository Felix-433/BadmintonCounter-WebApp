import { getSetWinner, getMatchWinner, computeState } from './rules.js';

const STORAGE_KEY = 'badmintoncounter:current';

const el = {
  nav: document.getElementById('nav'),
  views: {
    setup: document.getElementById('view-setup'),
    live: document.getElementById('view-live'),
    history: document.getElementById('view-history'),
  },
  setupForm: document.getElementById('setup-form'),
  inputA: document.getElementById('input-a'),
  inputB: document.getElementById('input-b'),
  setsSummary: document.getElementById('sets-summary'),
  btnA: document.getElementById('btn-a'),
  btnB: document.getElementById('btn-b'),
  nameA: document.getElementById('name-a'),
  nameB: document.getElementById('name-b'),
  scoreA: document.getElementById('score-a'),
  scoreB: document.getElementById('score-b'),
  serveA: document.getElementById('serve-a'),
  serveB: document.getElementById('serve-b'),
  btnUndo: document.getElementById('btn-undo'),
  btnCancel: document.getElementById('btn-cancel'),
  matchOverBanner: document.getElementById('match-over-banner'),
  matchOverText: document.getElementById('match-over-text'),
  btnSave: document.getElementById('btn-save'),
  historyList: document.getElementById('history-list'),
  historyEmpty: document.getElementById('history-empty'),
};

/** @type {{spielerA:string, spielerB:string, firstServer:'A'|'B', history:('A'|'B')[]}|null} */
let match = null;

function loadMatch() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persistMatch() {
  if (match) localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
  else localStorage.removeItem(STORAGE_KEY);
}

function showView(name) {
  for (const [key, section] of Object.entries(el.views)) {
    section.classList.toggle('active', key === name);
  }
  for (const btn of el.nav.querySelectorAll('button')) {
    btn.classList.toggle('active', btn.dataset.view === name);
  }
  el.nav.classList.toggle('hidden', name === 'live');
  if (name === 'history') renderHistory();
}

function currentServer() {
  if (match.history.length === 0) return match.firstServer;
  return match.history[match.history.length - 1];
}

function renderLive() {
  const { saetze, current } = computeState(match.history);
  const winsA = saetze.filter((s) => getSetWinner(s.a, s.b) === 'A').length;
  const winsB = saetze.filter((s) => getSetWinner(s.a, s.b) === 'B').length;

  el.nameA.textContent = match.spielerA;
  el.nameB.textContent = match.spielerB;
  el.scoreA.textContent = current.a;
  el.scoreB.textContent = current.b;

  el.setsSummary.innerHTML = '';
  const summaryLine = document.createElement('div');
  summaryLine.className = 'sets-line';
  summaryLine.textContent = `Sätze: ${winsA} : ${winsB}`;
  el.setsSummary.appendChild(summaryLine);
  if (saetze.length > 0) {
    const detail = document.createElement('div');
    detail.className = 'sets-detail';
    detail.textContent = saetze.map((s) => `${s.a}:${s.b}`).join('  ·  ');
    el.setsSummary.appendChild(detail);
  }

  const matchWinner = getMatchWinner(saetze);
  const server = matchWinner ? null : currentServer();
  el.serveA.classList.toggle('hidden', server !== 'A');
  el.serveB.classList.toggle('hidden', server !== 'B');

  el.btnA.disabled = !!matchWinner;
  el.btnB.disabled = !!matchWinner;
  el.btnUndo.disabled = match.history.length === 0;

  if (matchWinner) {
    const winnerName = matchWinner === 'A' ? match.spielerA : match.spielerB;
    el.matchOverText.textContent = `${winnerName} gewinnt das Match!`;
    el.matchOverBanner.classList.remove('hidden');
  } else {
    el.matchOverBanner.classList.add('hidden');
  }
}

function startMatch(spielerA, spielerB, firstServer) {
  match = { spielerA, spielerB, firstServer, history: [] };
  persistMatch();
  showView('live');
  renderLive();
}

function scorePoint(scorer) {
  const { saetze } = computeState(match.history);
  if (getMatchWinner(saetze)) return;
  match.history.push(scorer);
  persistMatch();
  renderLive();
}

function undoPoint() {
  if (match.history.length === 0) return;
  match.history.pop();
  persistMatch();
  renderLive();
}

function cancelMatch() {
  if (!confirm('Laufendes Match wirklich abbrechen? Der Fortschritt geht verloren.')) return;
  match = null;
  persistMatch();
  showView('setup');
}

async function saveMatch() {
  const { saetze } = computeState(match.history);
  el.btnSave.disabled = true;
  try {
    const res = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spielerA: match.spielerA, spielerB: match.spielerB, saetze }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Speichern fehlgeschlagen (${res.status})`);
    }
    match = null;
    persistMatch();
    showView('history');
  } catch (err) {
    alert(err.message);
    el.btnSave.disabled = false;
  }
}

function formatDatum(iso) {
  try {
    return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

async function renderHistory() {
  el.historyList.innerHTML = '';
  el.historyEmpty.classList.add('hidden');
  let matches;
  try {
    const res = await fetch('/api/matches');
    if (!res.ok) throw new Error('Laden fehlgeschlagen');
    matches = await res.json();
  } catch (err) {
    el.historyEmpty.textContent = 'Verlauf konnte nicht geladen werden.';
    el.historyEmpty.classList.remove('hidden');
    return;
  }

  if (matches.length === 0) {
    el.historyEmpty.textContent = 'Noch keine gespeicherten Matches.';
    el.historyEmpty.classList.remove('hidden');
    return;
  }

  for (const m of matches) {
    const li = document.createElement('li');
    li.className = 'history-item';

    const winnerName = m.gewinner === 'A' ? m.spielerA : m.spielerB;
    const setsText = m.saetze.map((s) => `${s.a}:${s.b}`).join('  ·  ');

    li.innerHTML = `
      <div class="history-main">
        <div class="history-players"><strong>${escapeHtml(m.spielerA)}</strong> vs <strong>${escapeHtml(m.spielerB)}</strong></div>
        <div class="history-sets">${escapeHtml(setsText)}</div>
        <div class="history-meta">🏆 ${escapeHtml(winnerName)} · ${escapeHtml(formatDatum(m.datum))}</div>
      </div>
      <button type="button" class="delete-btn" data-id="${m.id}" aria-label="Löschen">🗑</button>
    `;
    el.historyList.appendChild(li);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function deleteHistoryEntry(id) {
  if (!confirm('Dieses Match aus dem Verlauf löschen?')) return;
  const res = await fetch(`/api/matches/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    alert('Löschen fehlgeschlagen');
    return;
  }
  renderHistory();
}

el.setupForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const a = el.inputA.value.trim();
  const b = el.inputB.value.trim();
  if (!a || !b) return;
  const firstServer = el.setupForm.querySelector('input[name="first-server"]:checked').value;
  startMatch(a, b, firstServer);
  el.setupForm.reset();
});

el.btnA.addEventListener('click', () => scorePoint('A'));
el.btnB.addEventListener('click', () => scorePoint('B'));
el.btnUndo.addEventListener('click', undoPoint);
el.btnCancel.addEventListener('click', cancelMatch);
el.btnSave.addEventListener('click', saveMatch);

// Tastatur-/Presenter-Fernbedienung: Bluetooth-Clicker melden sich als
// normale Tastatur an und senden beim Klick Pfeiltasten bzw. Bild-Auf/-Ab
// (je nach Modell). Nur aktiv während des Live-Scorings, und nicht während
// in ein Textfeld getippt wird.
document.addEventListener('keydown', (e) => {
  if (!el.views.live.classList.contains('active')) return;
  if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

  switch (e.key) {
    case 'ArrowLeft':
    case 'PageUp':
      e.preventDefault();
      scorePoint('A');
      break;
    case 'ArrowRight':
    case 'PageDown':
      e.preventDefault();
      scorePoint('B');
      break;
    case 'Backspace':
      e.preventDefault();
      undoPoint();
      break;
  }
});

el.nav.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (btn) showView(btn.dataset.view);
});

el.historyList.addEventListener('click', (e) => {
  const btn = e.target.closest('.delete-btn');
  if (btn) deleteHistoryEntry(btn.dataset.id);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Init
match = loadMatch();
if (match) {
  showView('live');
  renderLive();
} else {
  showView('setup');
}
