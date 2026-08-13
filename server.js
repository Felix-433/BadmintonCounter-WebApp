import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './src/db.js';
import { handleApi } from './src/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3200;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function resolveSafePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const target = path.join(PUBLIC_DIR, normalized === '/' ? 'index.html' : normalized);
  if (!target.startsWith(PUBLIC_DIR)) return null;
  return target;
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    // Bei jedem Request frisch geladen statt im Speicher gehalten, damit ein
    // zweiter Serverprozess (z.B. nach einem Neustart übrig geblieben) nie
    // eine veraltete Version zurück auf die Platte schreiben kann.
    handleApi(req, res, load());
    return;
  }

  let filePath = resolveSafePath(req.url === '/' ? '/index.html' : req.url);

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`BadmintonCounter läuft auf http://localhost:${PORT}`);
});
