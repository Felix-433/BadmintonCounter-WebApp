import { randomUUID } from 'node:crypto';
import { save } from './db.js';
import { isValidFinishedSet, getMatchWinner, REGEL_PRESETS, DEFAULT_MODUS } from './rules.js';

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Ungültiges JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function validateMatchPayload(body) {
  if (!body.spielerA || !body.spielerB) {
    return 'spielerA und spielerB sind erforderlich';
  }
  const modus = body.modus ?? DEFAULT_MODUS;
  const regeln = REGEL_PRESETS[modus];
  if (!regeln) {
    return `modus muss einer von ${Object.keys(REGEL_PRESETS).join(', ')} sein`;
  }
  if (!Array.isArray(body.saetze) || body.saetze.length === 0) {
    return 'saetze muss ein nicht-leeres Array sein';
  }
  for (const set of body.saetze) {
    if (!set || !isValidFinishedSet(set.a, set.b, regeln)) {
      return `Satzstand ${JSON.stringify(set)} ist kein gültiges Satzende für Zählweise "${modus}"`;
    }
  }
  const winner = getMatchWinner(body.saetze, regeln);
  if (!winner) {
    return 'Die Sätze ergeben noch kein abgeschlossenes Match (Best-of-3)';
  }
  return null;
}

async function handleApi(req, res, db) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const segments = url.pathname.split('/').filter(Boolean); // ['api', 'matches', ':id'?]
  const resource = segments[1];
  const id = segments[2];

  try {
    if (resource === 'matches' && req.method === 'GET' && !id) {
      const list = [...db.matches].sort((a, b) => (a.datum < b.datum ? 1 : -1));
      return sendJson(res, 200, list);
    }
    if (resource === 'matches' && req.method === 'GET' && id) {
      const match = db.matches.find((m) => m.id === id);
      if (!match) return sendJson(res, 404, { error: 'Match nicht gefunden' });
      return sendJson(res, 200, match);
    }
    if (resource === 'matches' && req.method === 'POST' && !id) {
      const body = await readBody(req);
      const error = validateMatchPayload(body);
      if (error) return sendJson(res, 400, { error });
      const modus = body.modus ?? DEFAULT_MODUS;
      const regeln = REGEL_PRESETS[modus];
      const match = {
        id: randomUUID(),
        datum: body.datum ?? new Date().toISOString(),
        spielerA: body.spielerA,
        spielerB: body.spielerB,
        spielart: body.spielart === 'einzel' ? 'einzel' : 'doppel',
        modus,
        saetze: body.saetze.map((s) => ({ a: s.a, b: s.b })),
        gewinner: getMatchWinner(body.saetze, regeln),
      };
      db.matches.push(match);
      save(db);
      return sendJson(res, 201, match);
    }
    if (resource === 'matches' && req.method === 'DELETE' && id) {
      const idx = db.matches.findIndex((m) => m.id === id);
      if (idx === -1) return sendJson(res, 404, { error: 'Match nicht gefunden' });
      db.matches.splice(idx, 1);
      save(db);
      return sendJson(res, 204, null);
    }

    return sendJson(res, 404, { error: 'Unbekannte Route' });
  } catch (err) {
    return sendJson(res, 400, { error: err.message || 'Fehler bei der Anfrage' });
  }
}

export { handleApi };
