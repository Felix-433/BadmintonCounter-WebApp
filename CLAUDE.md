# BadmintonCounter

Standalone Live-Punktezähler für Badminton (BWF Rally-Point-Regeln), gebaut
als reine statische PWA. Kein eigenes Backend im Betrieb — läuft komplett
offline-fähig vom Homescreen eines iPhone/iPad, ohne dass ein PC/Server
online sein muss. Siehe auch [README.md](README.md) für Nutzungs-Details
(Fernbedienungen, Regeln, Backup/Restore).

## Struktur (wichtig: flach, wie Schwesterprojekt SpoPiRWK-iPad)

```
index.html, manifest.json, sw.js, css/, js/, icons/   ← die eigentliche App
server.js, src/db.js, src/api.js, data/, scripts/     ← nur lokale Entwicklung
```

Die App-Dateien liegen bewusst **direkt im Repo-Root**, nicht in einem
`public/`-Unterordner — nur so kann GitHub Pages ("Deploy from a branch",
Branch `main`, Ordner `/ (root)`) ohne Build-Schritt live gehen.

`server.js`/`src/`/`data/`/`scripts/` sind rein optionale Dev-Tooling
(`npm start` → `http://localhost:3200`, siehe unten). Die deployte App ruft
diese nie auf — alle Daten (laufendes Match + Verlauf) liegen ausschließlich
im `localStorage` des jeweiligen Geräts (`badmintoncounter:current`,
`badmintoncounter:history`).

## Deploy-Workflow — bei JEDER Code-Änderung an index.html/css/js beachten

1. **`sw.js`: `CACHE_NAME` um eins hochzählen** (aktuell `...-v35`). Ohne
   das bekommen Geräte, die die App schon installiert haben, die neue
   Version nicht mit — der Service Worker cached sonst weiter die alte
   Version.
2. Lokal über den Dev-Server testen (siehe unten), bevor gepusht wird.
3. Commit (deutsch, ausführliche Begründung im Body) + `git push origin
   main`.
4. Deployment verifizieren, nicht raten:
   ```bash
   curl -s "https://felix-433.github.io/BadmintonCounter-WebApp/sw.js?cb=$RANDOM"
   ```
   in einer Schleife pollen, bis die neue `CACHE_NAME`-Nummer erscheint
   (GitHub Pages braucht nach dem Push ein paar Sekunden bis Minuten).
   Erst dann dem Nutzer "vX ist live" melden.
5. Nutzer bittet danach i.d.R. um einen Test auf dem echten iPad — die
   Service-Worker-Aktivierung auf bereits installierten Geräten kann außer
   der Reihe ein zusätzliches Schließen/Neuöffnen der App oder einen
   Hard-Refresh brauchen (schon mehrfach als reines Cache-Timing-Problem
   aufgetreten, kein Code-Bug).

## Lokal testen

```bash
npm start
```
→ `http://localhost:3200`. Danach im Browser-Pane:
- **Nicht** `preview_start` mit `{name: "..."}` verwenden — das löst gegen
  das `.claude/launch.json` des primären Arbeitsverzeichnisses auf (falls
  dieses Projekt nicht das primäre CWD ist), nicht gegen dieses Projekt.
- Stattdessen: `npm start` per Bash (`run_in_background: true`) starten,
  mit `curl` verifizieren, dann `preview_start` mit
  `{url: "http://localhost:3200"}` aufrufen.
- UI-Interaktionen (Touch-Long-Press, Maus-Hold, Tastatur-Events) lassen
  sich zuverlässig per `javascript_exec` mit synthetischen
  `PointerEvent`/`KeyboardEvent` simulieren; `localStorage` direkt seeden/
  auslesen zur Verifikation, danach wieder `localStorage.clear()`.
- Der lokale Dev-Server (`server.js`) liefert Service-Worker-Registrierung
  in der Sandbox-Browser-Umgebung nicht immer zuverlässig (schon als reines
  Artefakt der Testumgebung beobachtet, nicht der echten Geräte) — im
  Zweifel zusätzlich direkt gegen die echte GitHub-Pages-URL verifizieren.
- Nach dem Test: Dev-Server-Prozess sauber beenden (`netstat` → PID →
  `taskkill //PID <pid> //F`).

## Architektur-Entscheidungen, die nicht rückgängig gemacht werden sollen

- **Kein Gerät-Sync, bewusst.** `localStorage` ist strikt pro Gerät/Browser
  getrennt; es gibt keinen automatischen Abgleich zwischen z.B. iPad und
  Notebook. Die einzige Möglichkeit, Daten zwischen Geräten zu bewegen, ist
  die manuelle ⬆ Sichern/⬇ Wiederherstellen-Funktion (JSON-Export/Import) —
  das ist so gewünscht und bleibt erhalten.
- **Presenter-Hold-Punktabzug wurde bewusst verworfen.** Ausführlich mit
  zwei Bluetooth-Presentern (Norwii N95 Plus, Logitech R500s) getestet —
  auf iPad liefert keines der Geräte ein browserseitig auswertbares
  Hold-Signal. Die Tastatur-Fernbedienung bleibt deshalb bei der einfachen
  Baseline (Pfeiltasten zählen, Rücktaste = Undo, Enter deaktiviert). Für
  seitenspezifisches Abziehen: Maus-Fernbedienung oder Finger-Long-Press
  verwenden.
- **Aufschlag-Badges** liegen in derselben Grid-Zeile wie die Satzanzeige,
  jeweils exakt über ihrem Team-Score-Button zentriert (per `grid-column`/
  `grid-row`-Überlappung, nicht verschachtelt in den großen Score-Buttons).
  Antippen tauscht nur den angezeigten Doppel-Aufschläger, ohne den
  Punktestand zu verändern.
