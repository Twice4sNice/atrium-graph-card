# Atrium Verlauf

Aktueller Wert mit Verlaufsgraph aus dem Recorder, Min/Max, Farbschwellen und mehreren Linien. Ersetzt mini-graph-card.

Teil der Atrium-Kartenfamilie. Die [Atrium-Integration](https://github.com/Twice4sNice/Atrium) bringt diese Karte bereits mit; dieses Repo ist für alle, die nur die Karte in einem normalen Dashboard nutzen wollen.

## Installation

**HACS:** HACS → Benutzerdefinierte Repositories → `https://github.com/Twice4sNice/atrium-graph-card` mit Typ *Dashboard* hinzufügen, dann „Atrium Verlauf“ installieren.

**Manuell:** `atrium-graph-card.js` nach `/config/www/` kopieren und unter Einstellungen → Dashboards → Ressourcen als `/local/atrium-graph-card.js` (JavaScript-Modul) eintragen.

Ist die Atrium-Integration installiert, ist keine zusätzliche Ressource nötig.

## Konfiguration

```yaml
type: custom:atrium-graph
entities:
  - sensor.speedtest_download
  - entity: sensor.speedtest_upload
    name: Upload
hours_to_show: 24
decimals: 1          # optional
color_thresholds:    # optional
  - value: 0
    color: "#F5A623"
  - value: 200
    color: "#30C26B"
```

Die Karte erscheint auch in der Kartenauswahl des Dashboard-Editors.

## Ersetzt

`mini-graph-card`: Atrium übersetzt bestehende Konfigurationen dieser Karte automatisch.

## Lizenz

MIT
