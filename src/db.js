import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function defaultDb() {
  return { matches: [] };
}

function load() {
  if (!existsSync(DB_FILE)) return defaultDb();
  try {
    const parsed = JSON.parse(readFileSync(DB_FILE, 'utf8'));
    if (!Array.isArray(parsed.matches)) return defaultDb();
    return parsed;
  } catch {
    return defaultDb();
  }
}

// Atomarer Schreibvorgang (tmp-Datei + rename), damit ein Absturz mitten im
// Schreiben nie eine halb geschriebene db.json hinterlässt.
function save(db) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = `${DB_FILE}.tmp`;
  writeFileSync(tmpFile, JSON.stringify(db, null, 2));
  renameSync(tmpFile, DB_FILE);
}

export { load, save };
