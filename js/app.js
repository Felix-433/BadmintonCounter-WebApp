import { getSetWinner, getMatchWinner, computeState, REGEL_PRESETS, DEFAULT_MODUS } from './rules.js';

const STORAGE_KEY = 'badmintoncounter:current';
const HISTORY_KEY = 'badmintoncounter:history';

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadHistoryList() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveHistoryList(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

const el = {
  nav: document.getElementById('nav'),
  views: {
    setup: document.getElementById('view-setup'),
    live: document.getElementById('view-live'),
    history: document.getElementById('view-history'),
  },
  btnFullscreen: document.getElementById('btn-fullscreen'),
  setupForm: document.getElementById('setup-form'),
  inputA1: document.getElementById('input-a1'),
  inputA2: document.getElementById('input-a2'),
  inputB1: document.getElementById('input-b1'),
  inputB2: document.getElementById('input-b2'),
  labelA2: document.getElementById('label-a2'),
  labelB2: document.getElementById('label-b2'),
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

/** @type {{spielerA:string, spielerB:string, firstServer:'A'|'B', matchType:'einzel'|'doppel', modus:'bis21'|'bis15', history:('A'|'B')[]}|null} */
let match = null;

function regelnFuerMatch() {
  return REGEL_PRESETS[match.modus] ?? REGEL_PRESETS[DEFAULT_MODUS];
}

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
  const regeln = regelnFuerMatch();
  const { saetze, current } = computeState(match.history, regeln);
  const winsA = saetze.filter((s) => getSetWinner(s.a, s.b, regeln) === 'A').length;
  const winsB = saetze.filter((s) => getSetWinner(s.a, s.b, regeln) === 'B').length;

  el.nameA.textContent = match.spielerA;
  el.nameB.textContent = match.spielerB;
  el.scoreA.textContent = current.a;
  el.scoreB.textContent = current.b;

  el.setsSummary.innerHTML = '';
  const pipsLine = document.createElement('div');
  pipsLine.className = 'sets-pips';
  pipsLine.innerHTML = `
    <span class="pip-team" aria-label="${winsA} von 2 Sätzen gewonnen">${'●'.repeat(winsA)}${'○'.repeat(2 - winsA)}</span>
    <span class="pip-label">Sätze</span>
    <span class="pip-team" aria-label="${winsB} von 2 Sätzen gewonnen">${'●'.repeat(winsB)}${'○'.repeat(2 - winsB)}</span>
  `;
  el.setsSummary.appendChild(pipsLine);
  if (saetze.length > 0) {
    const detail = document.createElement('div');
    detail.className = 'sets-detail';
    detail.textContent = saetze.map((s) => `${s.a}:${s.b}`).join('  ·  ');
    el.setsSummary.appendChild(detail);
  }

  const matchWinner = getMatchWinner(saetze, regeln);
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

function startMatch(spielerA, spielerB, firstServer, matchType, modus) {
  match = { spielerA, spielerB, firstServer, matchType, modus, history: [] };
  persistMatch();
  showView('live');
  renderLive();
}

function scorePoint(scorer) {
  const regeln = regelnFuerMatch();
  const { saetze } = computeState(match.history, regeln);
  if (getMatchWinner(saetze, regeln)) return;
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

function saveMatch() {
  const regeln = regelnFuerMatch();
  const { saetze } = computeState(match.history, regeln);
  el.btnSave.disabled = true;
  try {
    const eintrag = {
      id: generateId(),
      datum: new Date().toISOString(),
      spielerA: match.spielerA,
      spielerB: match.spielerB,
      spielart: match.matchType,
      modus: match.modus,
      saetze,
      gewinner: getMatchWinner(saetze, regeln),
    };
    const list = loadHistoryList();
    list.push(eintrag);
    saveHistoryList(list);
    match = null;
    persistMatch();
    showView('history');
  } catch (err) {
    alert(`Speichern fehlgeschlagen: ${err.message}`);
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

function formatSpielart(spielart) {
  return spielart === 'einzel' ? 'Einzel' : 'Doppel';
}

function formatModus(modus) {
  return modus === 'bis15' ? 'bis 15' : 'bis 21';
}

function renderHistory() {
  el.historyList.innerHTML = '';
  el.historyEmpty.classList.add('hidden');

  const matches = [...loadHistoryList()].sort((a, b) => (a.datum < b.datum ? 1 : -1));

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
        <div class="history-meta">${escapeHtml(formatSpielart(m.spielart))} · ${escapeHtml(formatModus(m.modus))} · 🏆 ${escapeHtml(winnerName)} · ${escapeHtml(formatDatum(m.datum))}</div>
      </div>
      <button type="button" class="delete-btn" data-id="${m.id}" aria-label="Löschen">🗑</button>
    `;
    el.historyList.appendChild(li);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function deleteHistoryEntry(id) {
  if (!confirm('Dieses Match aus dem Verlauf löschen?')) return;
  const list = loadHistoryList().filter((m) => m.id !== id);
  saveHistoryList(list);
  renderHistory();
}

function updateMatchTypeUI() {
  const matchType = el.setupForm.querySelector('input[name="match-type"]:checked').value;
  const isDoppel = matchType === 'doppel';
  el.labelA2.classList.toggle('hidden', !isDoppel);
  el.labelB2.classList.toggle('hidden', !isDoppel);
  el.inputA2.required = isDoppel;
  el.inputB2.required = isDoppel;
}

el.setupForm.querySelectorAll('input[name="match-type"]').forEach((radio) => {
  radio.addEventListener('change', updateMatchTypeUI);
});
updateMatchTypeUI();

el.setupForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const matchType = el.setupForm.querySelector('input[name="match-type"]:checked').value;
  const modus = el.setupForm.querySelector('input[name="modus"]:checked').value;

  const a1 = el.inputA1.value.trim();
  const b1 = el.inputB1.value.trim();
  if (!a1 || !b1) return;

  let spielerA = a1;
  let spielerB = b1;
  if (matchType === 'doppel') {
    const a2 = el.inputA2.value.trim();
    const b2 = el.inputB2.value.trim();
    if (!a2 || !b2) return;
    spielerA = `${a1} & ${a2}`;
    spielerB = `${b1} & ${b2}`;
  }

  const firstServer = el.setupForm.querySelector('input[name="first-server"]:checked').value;
  startMatch(spielerA, spielerB, firstServer, matchType, modus);
  el.setupForm.reset();
  updateMatchTypeUI();
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

// Vollbildschirm: nützlich beim Live-Scoring, um Browser-Chrome (Adressleiste
// etc.) wegzubekommen. Nicht jeder Browser unterstützt das (z.B. iOS Safari
// außerhalb einer installierten PWA) — Fehler werden dann einfach ignoriert.
el.btnFullscreen.addEventListener('click', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
});

document.addEventListener('fullscreenchange', () => {
  const isFullscreen = !!document.fullscreenElement;
  el.btnFullscreen.classList.toggle('active', isFullscreen);
  el.btnFullscreen.setAttribute('aria-label', isFullscreen ? 'Vollbildschirm verlassen' : 'Vollbildschirm umschalten');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
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
