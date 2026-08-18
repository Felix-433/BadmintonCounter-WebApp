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
  newSetPrompt: document.getElementById('new-set-prompt'),
  newSetTitle: document.getElementById('new-set-title'),
  newSetLegendA: document.getElementById('new-set-legend-a'),
  newSetLegendB: document.getElementById('new-set-legend-b'),
  newSetA1Name: document.getElementById('new-set-a1-name'),
  newSetA2Name: document.getElementById('new-set-a2-name'),
  newSetB1Name: document.getElementById('new-set-b1-name'),
  newSetB2Name: document.getElementById('new-set-b2-name'),
  btnNewSetConfirm: document.getElementById('btn-new-set-confirm'),
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
  btnExport: document.getElementById('btn-export'),
  btnImport: document.getElementById('btn-import'),
  inputImport: document.getElementById('input-import'),
};

/**
 * @typedef {Object} RightCourtAssignment
 * @property {0|1} A - Index in playersA, wer bei Team A zu Beginn dieses Satzes im rechten Feld steht.
 * @property {0|1} B - Index in playersB, wer bei Team B zu Beginn dieses Satzes im rechten Feld steht.
 */
/** @type {{spielerA:string, spielerB:string, playersA:?[string,string], playersB:?[string,string], firstServer:'A'|'B', matchType:'einzel'|'doppel', modus:'bis21'|'bis15', history:('A'|'B')[], rightCourtStart:RightCourtAssignment[]}|null} */
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

// Index des laufenden (noch nicht abgeschlossenen) Satzes, 0-basiert.
function currentSetIndex() {
  const regeln = regelnFuerMatch();
  return computeState(match.history, regeln).saetze.length;
}

// Beim Doppel schlägt pro Satz und Team immer nur eine bestimmte Person auf:
// wer zu Satzbeginn im rechten Feld steht, wechselt sich nur innerhalb des
// eigenen Aufschlags ab (rechts bei geradem, links bei ungeradem eigenem
// Punktestand). Der/die Partner*in kommt erst im nächsten Satz wieder dran.
// Deshalb muss vor jedem neuen Satz erfragt werden, wer diesmal rechts steht.
function needsNewSetPrompt() {
  if (match.matchType !== 'doppel') return false;
  if (!match.playersA || !match.playersB) return false;
  const regeln = regelnFuerMatch();
  const { saetze } = computeState(match.history, regeln);
  if (getMatchWinner(saetze, regeln)) return false;
  return !match.rightCourtStart[saetze.length];
}

function currentServerPlayerName() {
  if (match.matchType !== 'doppel' || !match.playersA || !match.playersB) return null;
  const regeln = regelnFuerMatch();
  const { saetze, current } = computeState(match.history, regeln);
  if (getMatchWinner(saetze, regeln)) return null;
  const setIndex = saetze.length;
  const assignment = match.rightCourtStart[setIndex];
  if (!assignment) return null;

  // Wer im rechten Feld steht, ist nicht einfach "gerade → Person X": die
  // Position wechselt innerhalb des Satzes nur, wenn ein Team beim eigenen
  // Aufschlag selbst punktet (Aufschlag verteidigt). Punktet stattdessen das
  // gegnerische Team (Seitenwechsel), bleibt die Zuordnung unverändert, und
  // die Person, die zum neuen Punktstand passt, schlägt auf. Deshalb wird
  // hier der laufende Satz Punkt für Punkt nachsimuliert statt der aktuelle
  // Stand direkt in eine feste rechts/links-Zuordnung übersetzt.
  let consumed = 0;
  for (const s of saetze) consumed += s.a + s.b;

  const right = { A: assignment.A, B: assignment.B };
  for (let i = consumed; i < match.history.length; i++) {
    const scorer = match.history[i];
    const server = i === 0 ? match.firstServer : match.history[i - 1];
    if (scorer === server) right[scorer] = right[scorer] === 0 ? 1 : 0;
  }

  const serverTeam = currentServer();
  const score = serverTeam === 'A' ? current.a : current.b;
  const players = serverTeam === 'A' ? match.playersA : match.playersB;
  const servingIndex = score % 2 === 0 ? right[serverTeam] : 1 - right[serverTeam];
  return players[servingIndex];
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
  const showNewSetPrompt = !matchWinner && needsNewSetPrompt();

  if (showNewSetPrompt) {
    el.newSetTitle.textContent = `Satz ${saetze.length + 1}: Wer steht im rechten Feld?`;
    el.newSetLegendA.textContent = match.spielerA;
    el.newSetLegendB.textContent = match.spielerB;
    el.newSetA1Name.textContent = match.playersA[0];
    el.newSetA2Name.textContent = match.playersA[1];
    el.newSetB1Name.textContent = match.playersB[0];
    el.newSetB2Name.textContent = match.playersB[1];
    el.newSetPrompt.querySelectorAll('input[name="new-set-a"]').forEach((r) => { r.checked = r.value === '0'; });
    el.newSetPrompt.querySelectorAll('input[name="new-set-b"]').forEach((r) => { r.checked = r.value === '0'; });
  }
  el.newSetPrompt.classList.toggle('hidden', !showNewSetPrompt);

  const server = matchWinner || showNewSetPrompt ? null : currentServer();
  const serverPlayerName = server ? currentServerPlayerName() : null;
  el.serveA.textContent = server === 'A' && serverPlayerName ? `🏸 Aufschlag: ${serverPlayerName}` : '🏸 Aufschlag';
  el.serveB.textContent = server === 'B' && serverPlayerName ? `🏸 Aufschlag: ${serverPlayerName}` : '🏸 Aufschlag';
  el.serveA.classList.toggle('hidden', server !== 'A');
  el.serveB.classList.toggle('hidden', server !== 'B');

  el.btnA.disabled = !!matchWinner || showNewSetPrompt;
  el.btnB.disabled = !!matchWinner || showNewSetPrompt;
  el.btnUndo.disabled = match.history.length === 0;

  if (matchWinner) {
    const winnerName = matchWinner === 'A' ? match.spielerA : match.spielerB;
    el.matchOverText.textContent = `${winnerName} gewinnt das Match!`;
    el.matchOverBanner.classList.remove('hidden');
  } else {
    el.matchOverBanner.classList.add('hidden');
  }
}

function startMatch(spielerA, spielerB, firstServer, matchType, modus, playersA, playersB) {
  match = { spielerA, spielerB, playersA, playersB, firstServer, matchType, modus, history: [], rightCourtStart: [] };
  persistMatch();
  showView('live');
  renderLive();
}

function scorePoint(scorer) {
  const regeln = regelnFuerMatch();
  const { saetze } = computeState(match.history, regeln);
  if (getMatchWinner(saetze, regeln)) return;
  if (needsNewSetPrompt()) return;
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

// Sichern/Wiederherstellen: der Verlauf lebt nur im localStorage dieses
// Geräts — vor einer Neuinstallation, einem Browser-Reset o.ä. lässt er
// sich hier als JSON-Datei exportieren und später wieder importieren.
async function exportHistory() {
  const list = loadHistoryList();
  const payload = { app: 'BadmintonCounter', exportedAt: new Date().toISOString(), matches: list };
  const json = JSON.stringify(payload, null, 2);
  const filename = `badmintoncounter-verlauf-${new Date().toISOString().slice(0, 10)}.json`;

  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([json], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'BadmintonCounter Verlauf' });
        return;
      }
    } catch {
      // Abgebrochen oder nicht unterstützt — auf normalen Download zurückfallen.
    }
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importHistoryFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const incoming = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.matches) ? parsed.matches : null;
      if (!incoming) throw new Error('Unbekanntes Dateiformat');

      const existing = loadHistoryList();
      const existingIds = new Set(existing.map((m) => m.id));
      let added = 0;
      for (const m of incoming) {
        if (m && m.id && !existingIds.has(m.id)) {
          existing.push(m);
          existingIds.add(m.id);
          added++;
        }
      }
      saveHistoryList(existing);
      renderHistory();
      alert(`${added} Match(es) importiert (${incoming.length - added} bereits vorhanden, übersprungen).`);
    } catch (err) {
      alert(`Import fehlgeschlagen: ${err.message}`);
    }
  };
  reader.readAsText(file);
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
  let playersA = null;
  let playersB = null;
  if (matchType === 'doppel') {
    const a2 = el.inputA2.value.trim();
    const b2 = el.inputB2.value.trim();
    if (!a2 || !b2) return;
    spielerA = `${a1} & ${a2}`;
    spielerB = `${b1} & ${b2}`;
    playersA = [a1, a2];
    playersB = [b1, b2];
  }

  const firstServer = el.setupForm.querySelector('input[name="first-server"]:checked').value;
  startMatch(spielerA, spielerB, firstServer, matchType, modus, playersA, playersB);
  el.setupForm.reset();
  updateMatchTypeUI();
});

// Merkt sich, ob die letzte Zeigereingabe von einer (ggf. als Touch
// getarnten, siehe unten) Maus stammte. Wird gebraucht, damit die
// Button-Klick-Handler unten bei Mausklicks nicht zusätzlich zur globalen
// Maustasten-Fernbedienung feuern (keine Doppelzählung), Touch/Tap auf den
// Buttons (z.B. Finger auf einem Tablet) aber unverändert funktioniert.
let lastPointerWasMouse = false;

// iPadOS meldet eine echte angeschlossene Bluetooth-Maus/Trackpad in Safari
// oft als pointerType "touch" statt "mouse" (WebKit tarnt externe Zeiger als
// Touch, aus Kompatibilität mit touch-only Webseiten) — ein simples
// pointerType==='mouse' erkennt so eine Maus auf dem iPad also nicht. Ein
// Finger hat aber eine spürbare Kontaktfläche, ein Maus-/Trackpad-Zeiger
// dagegen praktisch keine (width/height ~0-1) — das lässt sich zuverlässig
// unterscheiden.
function isPreciseMousePointer(e) {
  if (e.pointerType === 'mouse') return true;
  return e.pointerType === 'touch' && e.width <= 1 && e.height <= 1;
}

el.btnA.addEventListener('click', () => { if (lastPointerWasMouse) return; scorePoint('A'); });
el.btnB.addEventListener('click', () => { if (lastPointerWasMouse) return; scorePoint('B'); });
el.btnNewSetConfirm.addEventListener('click', () => {
  const aIndex = Number(el.newSetPrompt.querySelector('input[name="new-set-a"]:checked').value);
  const bIndex = Number(el.newSetPrompt.querySelector('input[name="new-set-b"]:checked').value);
  match.rightCourtStart[currentSetIndex()] = { A: aIndex, B: bIndex };
  persistMatch();
  renderLive();
});
el.btnUndo.addEventListener('click', undoPoint);
el.btnCancel.addEventListener('click', cancelMatch);
el.btnSave.addEventListener('click', saveMatch);

// Bluetooth-Maus als Fernbedienung: linke Maustaste = Punkt Team A, rechte
// Maustaste = Punkt Team B, überall im Live-Scoring-Bildschirm (nicht nur auf
// den Buttons). lastPointerWasMouse kommt vom pointerdown (siehe
// isPreciseMousePointer oben), die eigentliche Zählung hängt aber am
// "click"-Event statt am pointerdown/e.button: ein Rechtsklick/sekundärer
// Klick löst per Spezifikation nie ein "click"-Event aus (auch nicht als
// Touch getarnt) — dadurch kann links und rechts nie doppelt zählen, selbst
// wenn e.button bei einer getarnten Maus nicht zuverlässig 0/2 meldet.
document.addEventListener('pointerdown', (e) => {
  lastPointerWasMouse = isPreciseMousePointer(e);
}, true);

// Klicks auf andere Buttons (Undo, Match abbrechen/speichern, "Weiter" beim
// Satzwechsel, Navigation, ...) sollen nicht zusätzlich einen Punkt geben —
// nur echte Klicks auf freie Fläche oder direkt auf die Score-Buttons zählen
// hier mit.
function isOtherControl(target) {
  const control = target.closest('button, a, input, select, textarea');
  return control && control !== el.btnA && control !== el.btnB;
}

document.addEventListener('click', (e) => {
  if (!lastPointerWasMouse) return;
  if (!el.views.live.classList.contains('active')) return;
  if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (isOtherControl(e.target)) return;
  scorePoint('A');
});

document.addEventListener('contextmenu', (e) => {
  if (!el.views.live.classList.contains('active')) return;
  e.preventDefault();
  if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (isOtherControl(e.target)) return;
  scorePoint('B');
});

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

el.btnExport.addEventListener('click', exportHistory);
el.btnImport.addEventListener('click', () => el.inputImport.click());
el.inputImport.addEventListener('change', () => {
  const file = el.inputImport.files[0];
  if (file) importHistoryFromFile(file);
  el.inputImport.value = '';
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
  // Ältere gespeicherte Matches (vor Einführung der Aufschlagsposition beim
  // Doppel) haben noch kein rightCourtStart-Feld — ohne Nachrüsten würde
  // needsNewSetPrompt() beim Zugriff darauf abstürzen.
  if (!Array.isArray(match.rightCourtStart)) match.rightCourtStart = [];
  showView('live');
  renderLive();
} else {
  showView('setup');
}
