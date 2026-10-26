# Altena Auto's — website

Volledige occasionwebsite voor Altena Auto's ('s-Hertogenbosch), gebouwd als
statische HTML/CSS/JS-site (geen build-tools nodig), in dezelfde stijl als de
andere projecten in `/MODS/` (Thur Agro, Versteeg Vleeshandel).

## Wat is echt, wat is placeholder?

### Echt (overgenomen van bestaande bronnen op 29-08-2026)

**Van [altenaautos.nl](http://www.altenaautos.nl/home/):**
- Bedrijfsnaam, adres: Uilenwaard 44, 5236 WB 's-Hertogenbosch (Empel)
- Telefoon: 06 - 218 16 055 · e-mail: info@altenaautos.nl
- Teksten over werkwijze: dealer onderhouden auto's, NAP, APK-gekeurd,
  3-12 mnd garantie in overleg, ook inruil van auto's/motoren/boten/caravans,
  "auto's te koop gevraagd". Afleverkosten stonden hier oorspronkelijk als
  vast bedrag (€ 250); op 23-09-2026 gewijzigd naar "op aanvraag" op
  verzoek van Altena Auto's.
- **Openingstijden** (aangeleverd door Altena Auto's op 23-09-2026):
  bezichtiging op afspraak van 9.00 tot 17.00 uur, telefonisch bereikbaar
  van 9.00 tot 22.00 uur. Te vinden in `contact.html`, `over-ons.html` en
  op elke occasion-detailpagina (via `templates/occasion-template.html`).
- De bestaande site heeft zelf géén voorraadoverzicht — deze verwijst
  bezoekers door naar Marktplaats. Dat bevestigt dat Marktplaats hier al de
  bron van waarheid voor de voorraad is.

**Van het [Marktplaats-profiel](https://www.marktplaats.nl/u/altena-auto-s/248670/):**
Alle 7 actuele occasions (stand 09-10-2026: Opel KARL, VW Polo, Mazda 3, Peugeot 108,
Mercedes-Benz C-klasse (gereserveerd), Nissan Juke (gereserveerd), Citroën C1 (verkocht)) staan in `data/vehicles.json`,
inclusief titel, prijs, status, bouwjaar, km-stand, brandstof, transmissie,
vermogen, kleur, specificaties, uitrusting en de advertentietekst. Zie het
`marktplaatsUrl`-veld per auto om de brontekst te controleren.
Dit bestand is een momentopname — de echte voorraad op Marktplaats
verandert continu, zie "Voorraad actueel houden" hieronder.

Marktplaats toont ook "1,0 · 1 Ervaringen" (1 review) op het bedrijfsprofiel.
Dit is een negatieve enkele beoordeling — conform de opdracht worden er
**geen** reviews getoond die niet representatief/bruikbaar zijn; de
reviewsectie op de homepage is bewust leeg/klaargezet in plaats van deze ene
review te tonen. Overleg met Altena Auto's of en hoe hiermee om te gaan.

### Nog niet ingevuld (placeholder / ontbreekt)

- **Logo** — `images/logo/logo.png` (174 x 71 px, aangeleverd door de
  opdrachtgever). Klein bestand; een grotere versie (min. ~300 px hoog) zou
  scherper zijn op high-DPI schermen.
- **Foto's van de auto's** — op 21-09-2026 op verzoek van de opdrachtgever
  van de Marktplaats-advertenties overgenomen (Altena Auto's is zelf de
  adverteerder) en lokaal opgeslagen in `images/cars/<slug>/01.jpg, 02.jpg, …`
  (640 x 480, het maximum dat Marktplaats aanbiedt). Zie
  `images/cars/README.md`.
- **Bedrijfsfoto's** (showroom/pand) — zie `images/general/README.md`.
- **Domeinnaam** — canonical/OG-tags gaan uit van `www.altenaautos.nl`
  (het bestaande domein). Pas aan als de nieuwe site elders komt te staan.
- **KvK-nummer** — niet gevonden op de bestaande bronnen; nog aan te vullen
  in de footer/structured data.

## Projectstructuur

```
index.html            Homepage
occasions.html         Volledige voorraadpagina met filters/sortering
over-ons.html
inruilen.html
contact.html
occasions/<slug>/      Automatisch gegenereerde occasion-detailpagina's (SEO)
data/vehicles.json      Centrale voertuigdata — dé bron van waarheid
templates/              HTML-template die de generator gebruikt
scripts/                Generate-Occasions.ps1 (regenereert /occasions/ + sitemap.xml)
css/style.css           Volledig design system
js/vehicles.js          Data laden + occasion-card renderen (homepage + voorraadpagina)
js/main.js              Header/menu/animaties + formulieren (mailto-fallback)
images/logo, cars, general   Lokale assets (zie losse README's per map)
robots.txt, sitemap.xml SEO
_devserver.ps1           Lokale preview-server (poort 8183)
```

URL-structuur (zoals gevraagd):
`/`, `/occasions`, `/occasions/<slug>/`, `/over-ons`, `/inruilen`, `/contact`.
Let op: met puur statische hosting werkt `/occasions` (zonder `.html`) alleen
als de hostingomgeving "clean URLs" ondersteunt (de meeste statische hosts —
Netlify, Vercel, GitHub Pages met redirects, of een webserver-rewrite — doen
dit). `_devserver.ps1` simuleert dit al lokaal.

## Voorraadbeheer (admin) — hoe voeg je een auto toe/wijzig je iets?

Er is bewust géén login-dashboard gebouwd: dit is een statische site zonder
server/database, dus dat zou een heel ander soort project zijn (zie hieronder
bij "Toekomstige Marktplaats-koppeling" voor hoe dat er wél zou uitzien).
In plaats daarvan:

1. Open `data/vehicles.json`.
2. Voeg een auto toe (of pas er één aan) volgens de bestaande structuur —
   elk veld staat beschreven in de opdracht en komt overeen met wat
   Marktplaats toont. Voor status: `"beschikbaar"`, `"gereserveerd"` of
   `"verkocht"`.
3. Draai het generatorscript:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\Generate-Occasions.ps1
   ```
   Dit genereert/update automatisch de detailpagina, de SEO-tags, de
   schema.org-data én `sitemap.xml` voor élke auto in het bestand. Pagina's
   van auto's die niet meer in het bestand staan worden automatisch
   verwijderd.
4. Klaar — de homepage en voorraadpagina lezen `vehicles.json` altijd live
   in (via `fetch`), dus die zijn direct bijgewerkt zodra je het bestand
   opslaat.

## Marktplaats-koppeling

**Onderzoek naar officiële mogelijkheden:** Marktplaats biedt zelf géén
publieke, zelf-service API of voorraadfeed voor individuele adverteerders.
Voor bedrijven (waaronder autodealers) loopt automatisering via
[Marktplaats Zakelijk](https://www.marktplaatszakelijk.nl/) en hun
gecertificeerde technische partners (o.a. Channable, Koongo, ProductFlow,
EasyAds, EffectConnect) die een feed (XML/CSV) of API-koppeling vanuit een
webshop/voorraadsysteem naar Marktplaats Pro-advertenties verzorgen. Voor de
automotive-sector specifiek noemt Marktplaats Zakelijk ook
"Voorraad Management Systemen" (VMS) en partners zoals ISN die een
API-koppeling bieden vanuit CMS/webshop/voorraadsystemen. Zie:
[Automatisch adverteren: API, feed of Shopify — Marktplaats Zakelijk](https://www.marktplaatszakelijk.nl/ondernemers/kenniscentrum/praktische-tips/automatisch-adverteren-kies-je-voor-api-feed-of-shopify/),
[Voorraad Management Systemen — Marktplaats Zakelijk](https://www.marktplaatszakelijk.nl/automotive/alle-mogelijkheden/vms/).

**Conclusie:** een directe, gratis "lees de voorraad automatisch van
Marktplaats"-koppeling bestaat niet. Wat wél mogelijk is (in volgorde van
realistisch voor een bedrijf van deze omvang):

1. **Handmatige import via `data/vehicles.json`** ← *nu actief.* Simpel,
   gratis, past bij de huidige schaal (~5 auto's).
2. **CSV/Excel-import** — een klein importscript dat een CSV (bijv.
   geëxporteerd vanuit een boekhoud- of voorraadlijstje) omzet naar
   `vehicles.json`. Eenvoudig toe te voegen als de voorraad groeit.
3. **Dealer/DMS-voorraadfeed** — als Altena Auto's een voorraadbeheersysteem
   (DMS) gaat gebruiken dat al een feed genereert, kan een importscript die
   feed uitlezen naar `vehicles.json`.
4. **Marktplaats Pro / VMS-koppeling via een gecertificeerde partner** —
   de "echte" oplossing zodra het bedrijf een zakelijk Marktplaats
   Pro-abonnement heeft: de partner (bijv. Channable of een automotive-VMS)
   synchroniseert dan van hetzelfde bronbestand náár zowel de eigen site als
   Marktplaats, in plaats van andersom.
5. **Toekomstige officiële Marktplaats API** — mocht Marktplaats dit ooit
   breder aanbieden, dan is de architectuur er klaar voor (zie hieronder).

**Waarom de architectuur dit nu al ondersteunt:** alle pagina's (homepage,
voorraadpagina, detailpagina's) lezen uitsluitend uit de centrale
`Vehicle`-structuur in `data/vehicles.json` — nergens staat auto-informatie
hardcoded in HTML. Een toekomstige feed/API/CSV-koppeling hoeft dus alleen
dát ene bestand te vullen (of, bij een build-proces, `scripts/Generate-
Occasions.ps1` te vervangen door een variant die zijn data uit de externe
bron haalt in plaats van het lokale JSON-bestand) — de rest van de site werkt
dan automatisch mee, inclusief het regenereren van SEO-detailpagina's.

Elke auto heeft daarnaast een `marktplaatsUrl`-veld. Op elke occasion-kaart
en detailpagina staat een knop **"Bekijk op Marktplaats"** die hiernaartoe
linkt (met externe-link-indicator) — zo kunnen bezoekers altijd de volledige
fotoreportage bekijken, ook zolang er nog geen lokale foto's zijn.

### Voorraad actueel houden (tot een koppeling actief is)

`data/vehicles.json` bevat een momentopname van 29-08-2026. Controleer
periodiek de [Marktplaats-advertenties](https://www.marktplaats.nl/u/altena-auto-s/248670/)
op prijs-/statuswijzigingen en nieuwe/verwijderde auto's, werk
`vehicles.json` bij, en draai `scripts\Generate-Occasions.ps1` opnieuw.

## Formulieren

Dit is een statische site zonder eigen backend/server. De contact- en
inruilformulieren worden sinds 23-09-2026 rechtstreeks vanuit de browser
verzonden via [FormSubmit](https://formsubmit.co) naar `info@altenaautos.nl`
(zie `AltenaForms.wireMailtoForm` in `js/main.js`). FormSubmit vraagt geen
account of koppeling — alleen het e-mailadres in de code. **Belangrijk:** bij
het allereerste bericht dat via een formulier wordt verstuurd, stuurt
FormSubmit naar `info@altenaautos.nl` een eenmalige activatiemail (check ook
de spamfolder). Die moet één keer worden geopend en bevestigd, anders komen
latere formulierberichten niet aan. Dit moet Altena Auto's zelf doen; ik heb
geen toegang tot die inbox.

Lukt de verzending via FormSubmit niet (geen internet, dienst onbereikbaar),
dan valt het formulier automatisch terug op een `mailto:`-koppeling die het
eigen e-mailprogramma van de bezoeker opent — de oude werkwijze, nu alleen
nog als noodoplossing. Bijlagen (foto's bij inruilen) worden bij een geslaagde
FormSubmit-verzending gewoon meegestuurd; bij de mailto-noodoplossing lukt dat
niet automatisch en krijgt de bezoeker de instructie deze zelf toe te voegen
aan de e-mail, of te appen naar 06 - 218 16 055.

Voor volledig eigen server-side afhandeling kan in plaats van FormSubmit ook
een andere formulierdienst worden gekoppeld (bijv. Netlify Forms, Formspree,
of een eigen kleine backend) — alleen het `submit`-handler-gedeelte in
`js/main.js` hoeft dan te worden vervangen.

## Lokaal bekijken

```powershell
powershell -ExecutionPolicy Bypass -File _devserver.ps1
```
Opent de site op `http://localhost:8183`. Niet nodig voor hosting bij een
gewone statische webserver — mag dan verwijderd worden.

## Mobiele versie

Verbeterd na een korte designverkenning van vergelijkbare occasiondealers
(Dammers, Havo Auto, Rini Auto's, Nieuwkoop, Bouman, e.a. — alleen gebruikt
voor algemene lay-out-/kleurconcepten, geen tekst, code of beeldmateriaal
overgenomen, i.v.m. auteursrecht):

- Vaste onderbalk op mobiel (`.mobile-cta-bar`, < 980px) met "Bel direct" en
  de belangrijkste CTA, altijd binnen duimbereik — de header zelf toont op
  mobiel daarom alleen nog logo + menu (geen dubbele/lege knop meer).
- Hero en secties met vaste twee kolommen (`style="grid-template-columns:
  1fr 1fr"`) zijn vervangen door de herbruikbare `.split-2`-klasse, die op
  smalle schermen automatisch naar één kolom valt — dit was voorheen niet
  responsive.
- Hero-knoppen worden volledig breed en onder elkaar op mobiel; de statistiek-
  rij (20+ / 5 / NAP) staat in een nette 3-koloms grid i.p.v. vrij wrappende
  tekst.
- Foto-thumbnails op de detailpagina schakelen op zeer smalle schermen naar
  4 in plaats van 5 kolommen.

## Volgende stappen

1. Eventueel een grotere versie van het logo aanleveren (`images/logo/README.md`).
2. Bedrijfsfoto('s) voor "Over ons" en Open Graph (`images/general/README.md`).
3. Echte openingstijden en KvK-nummer aanleveren.
4. Beslissen hoe om te gaan met de bestaande 1-sterren Marktplaats-review.
5. Bij groei van de voorraad: overwegen een CSV-import of Marktplaats
   Pro/VMS-koppeling op te zetten (zie "Marktplaats-koppeling" hierboven).

## Automatische Marktplaats-koppeling (sinds 26-10-2026)

`scripts/sync-marktplaats.mjs` leest elk uur het Marktplaats-profiel van
Altena Auto's (verkoper-id 248670) en werkt `data/vehicles.json` en de foto's
in `images/cars/` bij. Daarna regenereert `Generate-Occasions.ps1` de
detailpagina's en de sitemap. Dit draait volledig in GitHub Actions
(`.github/workflows/sync.yml`), de laptop hoeft niet aan te staan.

- Nieuwe advertentie op Marktplaats: auto staat binnen een uur op de site, met alle foto's en specificaties.
- Prijs of "gereserveerd" wijzigt: wordt overgenomen.
- Advertentie verdwijnt van Marktplaats: auto krijgt de status "verkocht", en blijft 60 dagen zichtbaar met een rode VERKOCHT-balk over de foto, en wordt daarna verwijderd.
- Is Marktplaats even onbereikbaar of geblokkeerd, dan blijft de site ongewijzigd (er verschijnt een waarschuwing bij de Actions-run).
- Handmatig starten: GitHub, tabblad Actions, "Marktplaats synchroniseren", Run workflow.
- Lokaal testen: `node scripts/sync-marktplaats.mjs`, daarna `scripts\Generate-Occasions.ps1`.
- Publiceren gaat via Cloudflare Pages, gekoppeld aan de GitHub-repository. Elke wijziging in de repository wordt automatisch gepubliceerd.
