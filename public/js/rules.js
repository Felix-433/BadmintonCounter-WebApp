// Regeln: BWF-Rally-Point mit zwei wählbaren Zählweisen:
//   - "bis21" (Standard): ein Satz bis 21 Punkte mit 2 Punkten Vorsprung, Cap bei 30.
//   - "bis15": ein Satz bis 15 Punkte mit 2 Punkten Vorsprung, Cap bei 21.
// Match = in beiden Fällen Best-of-3.
//
// 1:1-Duplikat von src/rules.js — der Client rechnet den Stand lokal, ohne
// bei jedem Punkt einen Server-Roundtrip zu brauchen.

const REGEL_PRESETS = {
  bis21: { pointsToWin: 21, maxPoints: 30 },
  bis15: { pointsToWin: 15, maxPoints: 21 },
};
const DEFAULT_MODUS = 'bis21';

function getSetWinner(a, b, regeln = REGEL_PRESETS[DEFAULT_MODUS]) {
  const { pointsToWin, maxPoints } = regeln;
  if (a >= maxPoints || b >= maxPoints) {
    if (a === b) return null;
    return a > b ? 'A' : 'B';
  }
  if ((a >= pointsToWin || b >= pointsToWin) && Math.abs(a - b) >= 2) {
    return a > b ? 'A' : 'B';
  }
  return null;
}

function isValidFinishedSet(a, b, regeln = REGEL_PRESETS[DEFAULT_MODUS]) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  return getSetWinner(a, b, regeln) !== null;
}

function getMatchWinner(saetze, regeln = REGEL_PRESETS[DEFAULT_MODUS]) {
  let winsA = 0;
  let winsB = 0;
  for (const s of saetze) {
    const winner = getSetWinner(s.a, s.b, regeln);
    if (winner === 'A') winsA++;
    else if (winner === 'B') winsB++;
  }
  if (winsA >= 2) return 'A';
  if (winsB >= 2) return 'B';
  return null;
}

/**
 * Rechnet eine flache Punkt-für-Punkt-Historie ('A'|'B' pro Punkt, über das
 * ganze Match hinweg) in abgeschlossene Sätze plus den laufenden Satzstand um.
 */
function computeState(history, regeln = REGEL_PRESETS[DEFAULT_MODUS]) {
  const saetze = [];
  let a = 0;
  let b = 0;
  for (const scorer of history) {
    if (scorer === 'A') a++;
    else b++;
    const winner = getSetWinner(a, b, regeln);
    if (winner) {
      saetze.push({ a, b });
      a = 0;
      b = 0;
      if (getMatchWinner(saetze, regeln)) break;
    }
  }
  return { saetze, current: { a, b } };
}

export { getSetWinner, isValidFinishedSet, getMatchWinner, computeState, REGEL_PRESETS, DEFAULT_MODUS };
