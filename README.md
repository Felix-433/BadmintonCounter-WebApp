# BadmintonCounter

Live-Punktezähler für Badminton-Matches mit Speicherung der Match-Historie.
Läuft als reine statische PWA — gehostet auf **GitHub Pages**, siehe
[Zugriff vom iPhone/iPad](#zugriff-vom-iphoneipad-github-pages) unten. Kein
eigener Server/PC nötig, weder zur Nutzung noch zur Installation: Pages ist
selbst schon HTTPS, und der komplette Verlauf liegt im `localStorage` des
Geräts (siehe [Isolierter Betrieb](#isolierter-betrieb-ohne-pc)).

## Start (nur für lokale Entwicklung)

```bash
npm start
```

Läuft anschließend unter http://localhost:3200. `server.js` dient
ausschließlich der lokalen Entwicklung (schnelles Testen von Änderungen,
bevor sie auf `main` gepusht werden) — für den eigentlichen Betrieb auf
iPhone/iPad wird stattdessen die GitHub-Pages-URL benutzt, siehe unten.

## Regeln

Es gelten die BWF-Rally-Point-Regeln, wählbar beim Match-Start:

- **bis 21** (Standard): ein Satz geht bis 21 Punkte mit mindestens 2 Punkten
  Vorsprung, spätestens bei 30 Punkten endet der Satz sofort.
- **bis 15**: ein Satz geht bis 15 Punkte mit mindestens 2 Punkten Vorsprung,
  spätestens bei 21 Punkten endet der Satz sofort.

Ein Match ist in beiden Fällen Best-of-3 (Sieg nach 2 gewonnenen Sätzen).

Außerdem wählbar: **Doppel** (Standard, je 2 Spieler:innen pro Team) oder
**Einzel** (1 Spieler:in pro Team).

## Daten

Sowohl das laufende Match als auch der komplette Match-Verlauf (beendete
Matches: Spielernamen, Satzergebnisse, Gewinner) liegen ausschließlich im
`localStorage` des Geräts/Browsers — die App ruft dafür nie den Server auf.
Das heißt der Verlauf ist geräte-/browserlokal (kein Sync zwischen mehreren
Handys) und übersteht einen Seitenreload, geht aber verloren, wenn der
Browser-Speicher geleert oder die PWA deinstalliert wird.

**Sichern/Wiederherstellen:** Im Verlauf-Tab gibt es **⬆ Sichern**
(exportiert den kompletten Verlauf als JSON-Datei — auf iOS öffnet das den
Teilen-Dialog, sonst einen normalen Download) und **⬇ Wiederherstellen**
(liest so eine JSON-Datei wieder ein). Import ergänzt nur neue Einträge
(per `id` erkannt) und überschreibt nichts Bestehendes — sinnvoll z.B. vor
einer Neuinstallation der PWA.

`server.js` inkl. `src/db.js`/`src/api.js` (Node-Server + `data/db.json`)
existieren weiterhin im Repo, werden von der App aber nicht mehr benutzt —
sie dienen nur noch der lokalen Entwicklung (`npm start`) und sind für den
normalen Betrieb auf dem iPhone optional.

## Struktur

Analog zum Schwesterprojekt
[SpoPiRWK-iPad](https://github.com/Felix-433/SpoPiRWK-iPad): die statischen
App-Dateien (`index.html`, `manifest.json`, `sw.js`, `css/`, `js/`, `icons/`)
liegen direkt im Repo-Root statt in einem `public/`-Unterordner — dadurch
kann GitHub Pages ohne Build-Schritt direkt von `main` deployen.
`server.js`/`src/`/`scripts/`/`data/` liegen daneben und sind rein optional
für die lokale Entwicklung.

## Fernbedienung (Bluetooth-Clicker)

Während des Live-Scorings reagiert die App auf Tastatur-Events, damit sich
ein Bluetooth-Presenter-Clicker (meldet sich als normale Tastatur an) als
Fernbedienung nutzen lässt, ohne das Handy anzufassen:

| Taste                        | Aktion |
| ----------------------------- | ------ |
| `←` (Pfeil links) / `Bild ↑`  | Punkt für Team A |
| `→` (Pfeil rechts) / `Bild ↓` | Punkt für Team B |
| `Rücktaste`                   | Undo (letzter Punkt, egal von wem) |
| `Enter`                       | deaktiviert — Browser aktivieren beim Enter-Druck sonst das zuletzt fokussierte Element neu (z.B. einen gerade angeklickten Score-Button) und geben so ungewollt einen zusätzlichen Punkt |

Funktioniert nur, solange kein Textfeld fokussiert ist und die Live-Ansicht
aktiv ist.

Ein **seitenspezifisches Abziehen per Presenter-Taste** (analog zur
Maus-Fernbedienung unten) wurde ausführlich mit zwei Geräten (Norwii N95
Plus, Logitech R500s) durchprobiert — Halten einer Taste, Doppel-Druck,
Tab-Kombi, Umbelegung auf eigene Tasten per Logi-Options+-Software — und
letztlich als auf dem iPad nicht praktikabel verworfen: beide Geräte
liefern dort beim Halten kein browserseitig sichtbares Signal. Für
gezieltes Abziehen auf dem iPad stattdessen die **Maus-Fernbedienung**
nutzen (funktioniert dort bereits zuverlässig) oder den **↶ Undo**-Button.

## Fernbedienung (Maus)

Während des Live-Scorings reagiert die App zusätzlich auf Mausklicks —
überall im Live-Bildschirm, nicht nur auf den Score-Buttons:

| Aktion                     | Ergebnis |
| --------------------------- | -------- |
| Linksklick                  | Punkt für Team A |
| Rechtsklick                 | Punkt für Team B (Kontextmenü wird unterdrückt) |
| Linke Taste gedrückt halten (≥ 0,5s) | Letzten Punkt **von Team A** zurückziehen |
| Rechte Taste gedrückt halten (≥ 0,5s) | Letzten Punkt **von Team B** zurückziehen |

Jede Taste "gehört" also komplett ihrer Seite: Klick zählt, Halten korrigiert
— unabhängig davon, wer zuletzt gepunktet hat. Für ein generisches Undo
(letzter Punkt egal von wem) bleibt der **↶ Undo**-Button.

Nur bei echter Maus (auch eine per Bluetooth verbundene Maus/Trackpad an
einem iPad wird erkannt) — Finger-Tap auf einem Touchscreen bleibt normales
Antippen der Score-Buttons.

## Fernbedienung (Finger/Touch)

Auf einem echten Touchscreen (Finger, kein Maus-/Trackpad-Zeiger) gilt
analog zur Maus-Fernbedienung:

| Aktion                              | Ergebnis |
| ------------------------------------ | -------- |
| Kurzes Antippen des Score-Buttons    | Punkt für das jeweilige Team |
| Finger auf dem Score-Button halten (≥ 0,5s) | Letzten Punkt **vom angetippten Team** zurückziehen |

Funktioniert nur, solange die Live-Ansicht aktiv ist. Die Score-Buttons
unterdrücken dabei per CSS (`user-select`/`-webkit-touch-callout: none`)
die native Textauswahl-Markierung, die iOS/Android sonst bei langem Halten
auf Text zeigen würden.

## Fernbedienung (Gamepad)

Ein per Bluetooth gekoppeltes Gamepad kann während des Live-Scorings
ebenfalls Punkte zählen (Gamepad API, kein separates Pairing in der App
nötig — läuft über die iOS/iPadOS-Bluetooth-Kopplung):

| Taste                  | Aktion |
| ----------------------- | ------ |
| Face-Button unten/links (Index 0/2) | Punkt für Team A |
| Face-Button rechts/oben (Index 1/3) | Punkt für Team B |
| D-Pad links (Index 14)  | Letzten Punkt **von Team A** zurückziehen |
| D-Pad rechts (Index 15) | Letzten Punkt **von Team B** zurückziehen |
| Button 8  | Undo (letzter Punkt, egal von wem) |
| Button 9  | Match abbrechen (fragt wie gewohnt per Bestätigungsdialog nach) |
| Button 12 | Aufschläger*in Team A tauschen |
| Button 13 | Aufschläger*in Team B tauschen |
| Schultertasten (Index 4/5) | deaktiviert |

Die Schultertasten sind bewusst deaktiviert: am getesteten Gamepad reagierten
sie spürbar verzögert, während Face-Buttons und D-Pad verzögerungsfrei
zählten. Button-Indizes folgen dem W3C-Standardmapping, sind bei anderen
Gamepad-Modellen aber nicht garantiert identisch — im Zweifel mit
`gamepad-test.html` (Diagnose-Seite im Repo-Root, nicht Teil der
eigentlichen App) die tatsächliche Belegung des jeweiligen Geräts prüfen.

Funktioniert nur, solange die Live-Ansicht aktiv ist.

## Aufschläger*in tauschen (Doppel)

Beim Doppel sitzen zwei 🏸-Aufschlag-Badges in derselben Zeile wie die
Satzanzeige — eines pro Team, jeweils horizontal zentriert über dem
zugehörigen Score-Button darunter, links und rechts von der Satzanzeige.
Sie zeigen an, wer gerade
aufschlägt, und sind eigenständige Buttons (nicht Teil der großen
Score-Buttons). Ein Tippen/Klicken **auf das Badge des aufschlagenden
Teams** tauscht nur die angezeigte Person innerhalb dieses Teams — z.B.
wenn bei der Satzstart-Abfrage versehentlich die falsche Aufstellung
gewählt wurde oder sich das Team real anders hingestellt hat. Der
Punktestand bleibt dabei unverändert. Das Badge des gerade nicht
aufschlagenden Teams ist unsichtbar (reserviert aber weiter seinen Platz,
damit die Satzanzeige nicht seitlich springt) und reagiert nicht auf
Eingaben.

## Icons

Die PWA-Icons unter `icons/` sind einfarbige Platzhalter, erzeugt durch:

```bash
npm run gen-icons
```

## Zugriff vom iPhone/iPad (GitHub Pages)

Wie bei [SpoPiRWK-iPad](https://github.com/Felix-433/SpoPiRWK-iPad): GitHub
Pages liefert den Repo-Root direkt aus, kein Build-Schritt, kein Workflow
nötig — erreichbar unter:

```
https://felix-433.github.io/BadmintonCounter-WebApp/
```

Das ist bereits echtes HTTPS (kein Zertifikats-Gefrickel wie beim
selbstsignierten Versuch im Schwesterprojekt SpoPiRWK, kein Tailscale
nötig), erreichbar von überall — nicht nur im selben WLAN wie ein PC.

**Einmalig einzurichten** (nur im Browser der GitHub-Weboberfläche, nicht
von mir automatisierbar): Im Repo unter **Settings → Pages → Build and
deployment → Source** auf **"Deploy from a branch"** stellen, darunter
**Branch: `main`**, Ordner **`/ (root)`**. Danach wird bei jedem Push auf
`main` automatisch neu deployt — kein manueller Trigger nötig.

**Auf dem iPad/iPhone:** die URL oben in Safari öffnen, dann **Teilen → Zum
Home-Bildschirm**. Fertig — kein PC beteiligt, weder jetzt noch später.

### Alternative: lokaler Zugriff via Tailscale (nur zum Testen vor dem Push)

Um eine lokale Änderung zu testen, bevor sie auf `main` gepusht (und damit
automatisch deployt) wird, kann der lokale Dev-Server per
[Tailscale](https://tailscale.com) mit echtem HTTPS vom iPad erreicht werden:

1. Tailscale auf dem PC installieren (<https://tailscale.com/download>) und
   anmelden.
2. Die Tailscale-App auf dem iPad installieren und mit demselben Konto
   anmelden (gleicher Tailnet).
3. Im Tailscale-Adminkonsole einmalig **HTTPS Certificates** aktivieren
   (Settings → HTTPS Certificates).
4. Bei laufendem `npm start` auf dem PC zusätzlich ausführen:
   ```bash
   tailscale serve --bg 3200
   ```
5. Auf dem iPad (im selben Tailnet) `https://<rechnername>.<tailnet>.ts.net`
   in Safari öffnen.

## Isolierter Betrieb ohne PC

Sobald die App einmal über die GitHub-Pages-URL geöffnet und per "Zum
Home-Bildschirm" installiert wurde, braucht sie nie wieder einen eigenen
PC/Server:

- Der Service Worker cached die App-Shell (HTML/CSS/JS/Icons) beim ersten
  Aufruf, danach lädt das Homescreen-Icon komplett offline.
- Match-Verlauf und laufendes Match liegen im `localStorage` des Geräts.

PC aus, kein WLAN — die App vom Homescreen-Icon aus öffnen funktioniert
trotzdem, Punkte zählen und Matches speichern inklusive. Um eine neue
Version zu bekommen (nach einem künftigen Update dieses Projekts), muss das
iPad/iPhone nur wieder kurz mit *irgendeinem* Internetzugang online sein
(GitHub Pages, nicht der eigene PC), damit der Service Worker die neuen
Dateien nachlädt.
