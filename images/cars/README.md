# Occasion-foto's

Elke map hieronder hoort bij één auto uit `/data/vehicles.json` (de mapnaam is
het `slug`-veld van die auto). Foto's staan als `01.jpg`, `02.jpg`, … in de
map; `01.jpg` is de hoofdfoto op de kaarten en bovenaan de detailpagina.

Stand 21-09-2026, overgenomen van de Marktplaats-advertenties van Altena Auto's:

| Map | Foto's |
|---|---|
| `opel-karl-1-0-ecoflex-edition-airco/` | 11 |
| `volkswagen-polo-1-0-mpi-trendline-5-drs-airco/` | 10 |
| `mercedes-benz-c-klasse-180-prestige-automaat/` | 14 |
| `nissan-juke-1-6-business-edition-automaat/` | 15 |
| `citroen-c1-1-0-vti-feel-airco/` | 15 |

## Auto toevoegen / verwijderen

1. Zet de foto's in `images/cars/<slug>/` (`01.jpg`, `02.jpg`, …).
2. Vul in `data/vehicles.json` het `images`-veld met de paden, bijvoorbeeld
   `"images/cars/<slug>/01.jpg"`.
3. Draai `scripts\Generate-Occasions.ps1` om de detailpagina's te
   regenereren.
4. Auto verkocht/weg? Haal hem uit `vehicles.json`, draai het script (dat
   ruimt de detailpagina op) en verwijder de map met foto's hier.

**Gebruik nooit een foto van een andere auto bij een occasion.**
