# Landtagswahl Sachsen-Anhalt 2026 – Wahlumfrage-Simulator

Ein interaktiver Simulator für die Landtagswahl in Sachsen-Anhalt, basierend
auf der Sonntagsfrage von Infratest dimap (30.07.2026), veröffentlicht auf
[dawum.de](https://dawum.de/Sachsen-Anhalt/Infratest_dimap/2026-07-30/).

## Was macht die Seite?

- Zeigt die aktuelle Umfrage als interaktiven Balken-Chart, inklusive der von
  dawum.de dokumentierten Fehlertoleranz (`1 + √(Umfragewert / 10)`) je
  Partei.
- Simuliert mögliche Wahlausgänge per Monte-Carlo-Sampling aus einer
  Dirichlet-Verteilung, die die 100&nbsp;%-Summenbedingung respektiert und die
  Streuung jeder Partei an ihre Fehlertoleranz anpasst.
- Wendet die 5&nbsp;%-Hürde an (inkl. Ausschluss von "Sonstige") und renormiert
  die verbleibenden Parteien.
- Stellt jedes simulierte Ergebnis als kleines Ringdiagramm dar; Ergebnisse
  mit absoluter AfD-Mehrheit werden gelb hervorgehoben.
- Erlaubt es, Umfragewerte und Fehlertoleranzen frei anzupassen (normiert erst
  beim Speichern auf 100&nbsp;%) und die Anzahl der Simulationen (100–1000)
  einzustellen.

Näheres zur Methodik gibt es im "Hilfe"-Dialog auf der Seite selbst.

## Technik

Reines HTML/CSS/JavaScript (native ES-Module), keine Build-Schritte. Chart.js
wird per CDN eingebunden. Der JavaScript-Code liegt aufgeteilt nach
Zuständigkeit unter `js/` (Konstanten, Poll-Status, Dirichlet-Sampling,
Chart-Rendering, UI-Wiring). Lokal starten:

```
python3 -m http.server 8000
```

und `http://localhost:8000` öffnen.

## Datenquelle

[dawum.de – Infratest dimap, Sachsen-Anhalt, 30.07.2026](https://dawum.de/Sachsen-Anhalt/Infratest_dimap/2026-07-30/)

## Credits

- **Daten**: [dawum.de](https://dawum.de/) (Umfragen-Aggregator) und
  Infratest dimap (durchführendes Institut).
- **[Chart.js](https://www.chartjs.org/)** – MIT License. Verwendet für den
  Umfrage-Chart, die Ring-/Kreisdiagramme und die Hover-Vorschau.
- **[Roboto](https://fonts.google.com/specimen/Roboto)** von Google Fonts –
  Apache License 2.0.
- Der eigene Code in diesem Repository steht unter der [MIT-Lizenz](LICENSE).
