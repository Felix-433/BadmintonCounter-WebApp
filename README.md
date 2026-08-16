# BadmintonCounter

Live-Punktezähler für Badminton-Matches mit Speicherung der Match-Historie.

## Start

```bash
npm start
```

Läuft anschließend unter http://localhost:3200

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

Beendete Matches (Spielernamen, Satzergebnisse, Gewinner) werden in
`data/db.json` gespeichert (Ordner wird beim ersten Start automatisch
angelegt, per `.gitignore` nicht versioniert). Ein laufendes Match wird
zusätzlich im `localStorage` des Browsers gehalten, damit ein Seitenreload
den Fortschritt nicht verliert.

## Fernbedienung (Bluetooth-Clicker)

Während des Live-Scorings reagiert die App auf Tastatur-Events, damit sich
ein Bluetooth-Presenter-Clicker (meldet sich als normale Tastatur an) als
Fernbedienung nutzen lässt, ohne das Handy anzufassen:

| Taste                    | Aktion   |
| ------------------------ | -------- |
| `←` (Pfeil links) / `Bild ↑` | Punkt für Team A |
| `→` (Pfeil rechts) / `Bild ↓` | Punkt für Team B |
| `Rücktaste`               | Undo (letzter Punkt) |

Funktioniert nur, solange kein Textfeld fokussiert ist und die Live-Ansicht
aktiv ist.

## Icons

Die PWA-Icons unter `public/icons/` sind einfarbige Platzhalter, erzeugt
durch:

```bash
npm run gen-icons
```

## Zugriff vom iPhone (Tailscale)

Für ein Homescreen-Icon mit funktionierendem Offline-Cache reicht eine
LAN-Adresse wie `http://192.168.x.x:3200` nicht: iOS Safari registriert
Service Worker nur auf einem sicheren Origin (HTTPS oder `localhost`), sonst
bleibt "Zum Home-Bildschirm" nur ein Lesezeichen, das beim ersten
WLAN-Aussetzer nicht mehr lädt. Ein selbstsigniertes Zertifikat samt
manuellem iOS-Vertrauens-Dialog wurde dafür im Schwesterprojekt SpoPiRWK
ausprobiert und wieder verworfen ("mehr Ärger als es wert ist") — hier
stattdessen [Tailscale](https://tailscale.com), das für den eigenen
Tailnet-Hostnamen automatisch ein echtes, von iOS ohne Nachfrage akzeptiertes
Let's-Encrypt-Zertifikat ausstellt:

1. Tailscale auf dem PC installieren (<https://tailscale.com/download>) und
   anmelden.
2. Die Tailscale-App auf dem iPhone installieren und mit demselben Konto
   anmelden (gleicher Tailnet).
3. Im Tailscale-Adminkonsole einmalig **HTTPS Certificates** aktivieren
   (Settings → HTTPS Certificates).
4. Bei laufendem `npm start` auf dem PC zusätzlich ausführen:
   ```bash
   tailscale serve --bg 3200
   ```
   Das proxied `https://<rechnername>.<tailnet>.ts.net` (Port 443) auf den
   lokalen Server.
5. Auf dem iPhone (im selben Tailnet) diese `https://…ts.net`-Adresse in
   Safari öffnen und per **Teilen → Zum Home-Bildschirm** installieren.
