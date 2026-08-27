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

// Tippen auf den Aufschlag-Badge tauscht, wer von den beiden
// Doppel-Partner*innen des aktuell aufschlagenden Teams gerade als
// Aufschläger*in angezeigt wird — z.B. wenn versehentlich die falsche
// Startzuordnung gewählt wurde oder sich das Team real anders aufgestellt
// hat. Es wird nur die Startzuordnung (rightCourtStart) des laufenden
// Satzes geflippt; currentServerPlayerName() simuliert von dort aus neu,
// wodurch sich die angezeigte Person unmittelbar ändert, ohne den
// Punktestand anzufassen.
function toggleServerPlayer(side) {
  if (!match || match.matchType !== 'doppel') return;
  const setIndex = currentSetIndex();
  const assignment = match.rightCourtStart[setIndex];
  if (!assignment) return;
  assignment[side] = assignment[side] === 0 ? 1 : 0;
  persistMatch();
  renderLive();
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
  el.serveA.classList.toggle('visible', server === 'A');
  el.serveB.classList.toggle('visible', server === 'B');

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

// Zieht gezielt den letzten Punkt einer bestimmten Seite zurück (nicht
// zwingend den letzten Punkt insgesamt) — für die Maus-Fernbedienung:
// linke/rechte Taste halten korrigiert nur die eigene Seite.
function removeLastPointFromSide(side) {
  const idx = match.history.lastIndexOf(side);
  if (idx === -1) return;
  match.history.splice(idx, 1);
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

el.btnA.addEventListener('click', () => {
  if (lastPointerWasMouse) return;
  if (touchLongPressFired) { touchLongPressFired = false; return; }
  scorePoint('A');
});
el.btnB.addEventListener('click', () => {
  if (lastPointerWasMouse) return;
  if (touchLongPressFired) { touchLongPressFired = false; return; }
  scorePoint('B');
});
// Tippen auf das Aufschlag-Badge (oben neben der Satzanzeige, eigenständiger
// Button, nicht Teil von btn-a/btn-b) tauscht nur den angezeigten
// Aufschläger innerhalb des Teams — nur per Finger-Tap, nicht per Maus (bei
// der Maus-Fernbedienung zählt ein Klick dort wie überall sonst als Punkt,
// siehe isOtherControl unten).
el.serveA.addEventListener('click', () => {
  if (lastPointerWasMouse) return;
  toggleServerPlayer('A');
});
el.serveB.addEventListener('click', () => {
  if (lastPointerWasMouse) return;
  toggleServerPlayer('B');
});
el.btnNewSetConfirm.addEventListener('click', () => {
  const aIndex = Number(el.newSetPrompt.querySelector('input[name="new-set-a"]:checked').value);
  const bIndex = Number(el.newSetPrompt.querySelector('input[name="new-set-b"]:checked').value);
  match.rightCourtStart[currentSetIndex()] = { A: aIndex, B: bIndex };
  persistMatch();
  renderLive();
});
// Undo/Abbrechen/Speichern per Maus lösen bewusst NICHT ihre Aktion aus,
// sondern zählen wie jeder andere Mausklick nur einen Punkt (siehe
// isOtherControl oben) — per Maus laufen diese drei stattdessen über die
// Tastatur (Backspace/Escape/S, siehe der keydown-Listener weiter unten).
el.btnUndo.addEventListener('click', () => {
  if (lastPointerWasMouse) return;
  undoPoint();
});
el.btnCancel.addEventListener('click', () => {
  if (lastPointerWasMouse) return;
  cancelMatch();
});
el.btnSave.addEventListener('click', () => {
  if (lastPointerWasMouse) return;
  saveMatch();
});

// Bluetooth-Maus als Fernbedienung: linke Maustaste = Punkt Team A, rechte
// Maustaste = Punkt Team B, überall im Live-Scoring-Bildschirm (nicht nur auf
// den Buttons). lastPointerWasMouse kommt vom pointerdown (siehe
// isPreciseMousePointer oben).
//
// Kurz vs. lang wird komplett über pointerdown/pointerup entschieden, NICHT
// über "click"/"contextmenu": auf manchen iPad-Trackpads feuert
// "contextmenu" nachweislich sofort bei Tastendruck, unabhängig davon wie
// lange gehalten wird (kein verlässliches "erst bei Loslassen"-Timing) —
// "click"/"contextmenu" werden hier nur noch fürs Unterdrücken des
// Kontextmenüs bzw. als Sicherheitsnetz benutzt, nie fürs Zählen selbst.
document.addEventListener('pointerdown', (e) => {
  lastPointerWasMouse = isPreciseMousePointer(e);
}, true);

// Bei der Maus-Fernbedienung soll ein Klick/Press AUSNAHMSLOS einen Punkt
// geben, egal wo auf dem Bildschirm der Mauszeiger gerade steht (auch über
// Undo, Match abbrechen/speichern, "Weiter" beim Satzwechsel, dem
// Aufschlag-Badge, ...) — Finger-Taps auf diese Buttons funktionieren dabei
// unverändert normal, da diese Prüfung nur den Maus-Zweig betrifft (siehe
// isPreciseMousePointer oben) und die jeweiligen Klick-Handler selbst per
// lastPointerWasMouse auf Maus verzichten.
function isOtherControl() {
  return false;
}

const LONG_PRESS_MS = 500;
let longPressTimer = null;
let longPressButton = null; // 0 = links (A), 2 = rechts (B)
let longPressFired = false;
let longPressArmed = false; // true, sobald pointerdown die Bedingungen unten erfüllt hat

function clearLongPressTimer() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

document.addEventListener('pointerdown', (e) => {
  clearLongPressTimer(); // Absicherung gegen einen evtl. noch übrig gebliebenen Timer.
  longPressArmed = false;
  if (!isPreciseMousePointer(e) || (e.button !== 0 && e.button !== 2)) return;
  if (!el.views.live.classList.contains('active')) return;
  if (isOtherControl(e.target)) return;

  longPressArmed = true;
  longPressFired = false;
  longPressButton = e.button;
  longPressTimer = setTimeout(() => {
    longPressFired = true;
    removeLastPointFromSide(longPressButton === 0 ? 'A' : 'B');
    longPressTimer = null;
  }, LONG_PRESS_MS);
});

// Die eigentliche Kurzklick-Zählung passiert HIER, nicht in "click"/
// "contextmenu": pointerup markiert zuverlässig den Moment des Loslassens,
// unabhängig davon, ob/wann das jeweilige Gerät zusätzlich ein "click"- oder
// "contextmenu"-Event feuert.
document.addEventListener('pointerup', (e) => {
  const timerWarNochAktiv = !!longPressTimer;
  clearLongPressTimer();

  if (longPressFired) {
    longPressFired = false;
    return; // Long-Press hat schon abgezogen — hier nichts weiter tun.
  }
  if (!longPressArmed || !timerWarNochAktiv) return; // War kein von uns verwalteter Score-Press.
  if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

  scorePoint(e.button === 0 ? 'A' : 'B');
});

document.addEventListener('pointerleave', clearLongPressTimer, true);
document.addEventListener('pointercancel', clearLongPressTimer);

// Finger lange halten (auf einem Touchscreen): analog zur Maus zieht das
// gezielt den letzten Punkt der jeweils berührten Seite ab. Der normale
// kurze Tap läuft weiterhin über die nativen "click"-Handler auf den
// Buttons (oben) — hier wird nur der Timer verwaltet und, falls er
// feuert, der nachfolgende native Klick per touchLongPressFired
// unterdrückt, damit nicht zusätzlich noch ein Punkt gezählt wird.
let touchLongPressFired = false;
let touchLongPressTimer = null;

function clearTouchLongPressTimer() {
  if (touchLongPressTimer) {
    clearTimeout(touchLongPressTimer);
    touchLongPressTimer = null;
  }
}

document.addEventListener('pointerdown', (e) => {
  clearTouchLongPressTimer();
  if (isPreciseMousePointer(e) || e.pointerType !== 'touch') return;
  if (!el.views.live.classList.contains('active')) return;

  const btn = e.target.closest('.score-btn');
  const side = btn === el.btnA ? 'A' : btn === el.btnB ? 'B' : null;
  if (!side) return;

  touchLongPressFired = false;
  touchLongPressTimer = setTimeout(() => {
    touchLongPressFired = true;
    removeLastPointFromSide(side);
    touchLongPressTimer = null;
  }, LONG_PRESS_MS);
});

document.addEventListener('pointerup', clearTouchLongPressTimer);
document.addEventListener('pointerleave', clearTouchLongPressTimer, true);
document.addEventListener('pointercancel', clearTouchLongPressTimer);

// Nur noch fürs Unterdrücken des nativen Kontextmenüs — zählt selbst nichts.
document.addEventListener('contextmenu', (e) => {
  if (!el.views.live.classList.contains('active')) return;
  e.preventDefault();
});

// Von der Maus zählen ausschließlich die beiden Maustasten (siehe oben,
// pointerdown/pointerup). Mausradscrollen soll im Live-Scoring-Bildschirm
// keinerlei Wirkung haben (kein versehentliches Verschieben der Ansicht) —
// wird deshalb komplett unterdrückt. Zeigerbewegung (pointermove/mousemove)
// wird bewusst nirgends abgehört, es gibt also ohnehin keine Reaktion darauf.
document.addEventListener('wheel', (e) => {
  if (!el.views.live.classList.contains('active')) return;
  e.preventDefault();
}, { passive: false });

// Tastatur-/Presenter-Fernbedienung: Bluetooth-Clicker melden sich als
// normale Tastatur an und senden beim Klick Pfeiltasten bzw. Bild-Auf/-Ab
// (je nach Modell). Nur aktiv während des Live-Scorings, und nicht während
// in ein Textfeld getippt wird.
//
// Seitenspezifisches Abziehen per Presenter-Taste (Halten, Doppel-Druck,
// Tab-Kombi, Umbelegung auf eigene Tasten) wurde ausführlich mit zwei
// Geräten (Norwii N95 Plus, Logitech R500s) auf dem iPad durchprobiert und
// als nicht praktikabel verworfen — beide senden dort beim Halten kein
// browserseitig sichtbares Signal (die Logitech-Umbelegung läuft nur über
// die Logi-Options+-Software auf einem PC, die es für iPadOS nicht gibt).
// Für seitenspezifisches Abziehen auf dem iPad stattdessen die
// Maus-Fernbedienung nutzen (siehe unten) oder den ↶ Undo-Button.
//
// Enter ist komplett deaktiviert (preventDefault, keine Aktion): sonst
// aktiviert Enter das zuletzt fokussierte Element neu — z.B. einen gerade
// angeklickten Score-Button — und gibt so ungewollt einen zusätzlichen
// Punkt.
function arrowKeySide(key) {
  if (key === 'ArrowLeft' || key === 'PageUp') return 'A';
  if (key === 'ArrowRight' || key === 'PageDown') return 'B';
  return null;
}

document.addEventListener('keydown', (e) => {
  if (!el.views.live.classList.contains('active')) return;
  if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

  const side = arrowKeySide(e.key);
  if (side) {
    e.preventDefault();
    if (e.repeat) return;
    scorePoint(side);
    return;
  }

  switch (e.key) {
    case 'Backspace':
      e.preventDefault();
      if (e.repeat) return;
      undoPoint();
      break;
    case 'Escape':
      e.preventDefault();
      if (e.repeat) return;
      cancelMatch();
      break;
    case 'Enter':
      e.preventDefault();
      break;
    default:
      // "S" speichert das Match — nur sinnvoll (und nur erlaubt), wenn das
      // Match tatsächlich vorbei ist und der Speichern-Button/-Banner
      // eingeblendet ist; mittendrin würde saveMatch() das Match sonst
      // vorzeitig mit unvollständigem Ergebnis abschließen.
      if (e.key.toLowerCase() === 's' && !el.matchOverBanner.classList.contains('hidden')) {
        e.preventDefault();
        if (e.repeat) return;
        saveMatch();
      }
  }
});

// Bluetooth-Gamepad als Fernbedienung (siehe gamepad-test.html für die
// Button-Index-Ermittlung an einem neuen/anderen Gamepad-Modell). Nur aktiv
// im Live-Scoring-Bildschirm, analog zu Tastatur/Maus oben.
//
// Die beiden großen Schultertasten (Index 4/5) wurden bewusst NICHT belegt:
// bei ihnen war im Test eine spürbare Verzögerung zwischen Tastendruck und
// Reaktion zu beobachten (vermutlich Bluetooth-Reporting-Eigenheit dieser
// Tasten am getesteten Gamepad), während Face-Buttons (0-3) und D-Pad
// (14/15) verzögerungsfrei reagierten — deshalb übernehmen die stattdessen
// die Belegung.
//
// Die Gamepad API kennt keine Tastendruck-Events, der Zustand muss per
// Polling abgefragt werden — hier per requestAnimationFrame, läuft also mit
// der Bildwiederholrate (~alle 16ms).
const GAMEPAD_SCORE_MAP = [
  [0, 'A'], // Face-Button unten (z.B. A/Cross)
  [2, 'A'], // Face-Button links (z.B. X/Square)
  [1, 'B'], // Face-Button rechts (z.B. B/Circle)
  [3, 'B'], // Face-Button oben (z.B. Y/Triangle)
];
const GAMEPAD_REMOVE_MAP = [
  [14, 'A'], // D-Pad links: letzten Punkt von Team A abziehen
  [15, 'B'], // D-Pad rechts: letzten Punkt von Team B abziehen
];
const gamepadButtonState = {}; // key: `${padIndex}:${buttonIndex}` -> war zuletzt gedrückt?
let gamepadLoopRunning = false;

function pollGamepadButtonGroup(pad, map, liveActive, onPress) {
  map.forEach(([btnIndex, side]) => {
    const btn = pad.buttons[btnIndex];
    if (!btn) return;
    const key = `${pad.index}:${btnIndex}`;
    const isPressed = btn.pressed || btn.value > 0.5;
    const wasPressed = gamepadButtonState[key] || false;
    gamepadButtonState[key] = isPressed;
    // Nur auf den Wechsel "losgelassen -> gedrückt" reagieren (wie e.repeat
    // bei der Tastatur oben) — sonst würde Halten der Taste bei jedem
    // Frame erneut auslösen.
    if (isPressed && !wasPressed && liveActive) {
      onPress(side);
    }
  });
}

function pollGamepads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const liveActive = el.views.live.classList.contains('active');
  let anyConnected = false;

  for (const pad of pads) {
    if (!pad) continue;
    anyConnected = true;
    pollGamepadButtonGroup(pad, GAMEPAD_SCORE_MAP, liveActive, scorePoint);
    pollGamepadButtonGroup(pad, GAMEPAD_REMOVE_MAP, liveActive, removeLastPointFromSide);
  }

  if (anyConnected) {
    requestAnimationFrame(pollGamepads);
  } else {
    gamepadLoopRunning = false; // Loop stoppen, bis wieder ein Gamepad verbunden ist.
  }
}

function ensureGamepadLoop() {
  if (gamepadLoopRunning) return;
  gamepadLoopRunning = true;
  requestAnimationFrame(pollGamepads);
}

window.addEventListener('gamepadconnected', ensureGamepadLoop);
// Falls beim Laden der Seite schon ein Gamepad verbunden ist (z.B. nach
// einem Reload bei bereits gekoppeltem Gerät), kommt gamepadconnected u.U.
// nicht erneut — deshalb hier zusätzlich einmal direkt prüfen.
if (navigator.getGamepads && Array.from(navigator.getGamepads()).some(Boolean)) {
  ensureGamepadLoop();
}

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
