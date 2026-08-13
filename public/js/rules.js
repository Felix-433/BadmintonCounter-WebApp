// Regeln: BWF-Rally-Point, ein Satz bis 21 Punkte mit 2 Punkten Vorsprung,
// spätestens bei 30:x endet der Satz sofort. Match = Best-of-3.
//
// 1:1-Duplikat von src/rules.js — der Client rechnet den Stand lokal, ohne
// bei jedem Punkt einen Server-Roundtrip zu brauchen.

const POINTS_TO_WIN = 21;
const MAX_POINTS = 30;

function getSetWinner(a, b) {
  if (a >= MAX_POINTS || b >= MAX_POINTS) {
    if (a === b) return null;
    return a > b ? 'A' : 'B';
  }
  if ((a >= POINTS_TO_WIN || b >= POINTS_TO_WIN) && Math.abs(a - b) >= 2) {
    return a > b ? 'A' : 'B';
  }
  return null;
}

function isValidFinishedSet(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  return getSetWinner(a, b) !== null;
}

function getMatchWinner(saetze) {
  let winsA = 0;
  let winsB = 0;
  for (const s of saetze) {
    const winner = getSetWinner(s.a, s.b);
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
function computeState(history) {
  const saetze = [];
  let a = 0;
  let b = 0;
  for (const scorer of history) {
    if (scorer === 'A') a++;
    else b++;
    const winner = getSetWinner(a, b);
    if (winner) {
      saetze.push({ a, b });
      a = 0;
      b = 0;
      if (getMatchWinner(saetze)) break;
    }
  }
  return { saetze, current: { a, b } };
}

export { getSetWinner, isValidFinishedSet, getMatchWinner, computeState };
