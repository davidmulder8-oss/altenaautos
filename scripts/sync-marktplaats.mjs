/* =========================================================
   Altena Auto's, Marktplaats-synchronisatie
   Leest het Marktplaats-profiel van Altena Auto's en werkt
   data/vehicles.json + images/cars/<slug>/ automatisch bij:
   - nieuwe advertentie  -> auto verschijnt op de site (met foto's)
   - prijs / gereserveerd -> status en prijs worden bijgewerkt
   - advertentie weg      -> auto wordt "verkocht", na 60 dagen verwijderd
   Draait elk uur via .github/workflows/sync.yml (Node 20, geen packages nodig).
   Lokaal: node scripts/sync-marktplaats.mjs
   ========================================================= */

import { readFile, writeFile, mkdir, rm, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_FILE = path.join(ROOT, "data", "vehicles.json");
const PROFILE_URL = "https://www.marktplaats.nl/u/altena-auto-s/248670/";
const SELLER_ID = 248670;
const SOLD_KEEP_DAYS = 60;
const MAX_PHOTOS = 30;
const REFRESH_PHOTOS = process.argv.includes("--refresh-photos"); // alle foto's opnieuw ophalen
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "nl-NL,nl;q=0.9",
  Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
};

const today = () => new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);

async function fetchRetry(url, asBuffer = false, tries = 3) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status} voor ${url}`);
      return asBuffer ? { buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") || "" } : await res.text();
    } catch (e) {
      lastErr = e;
      await sleep(1500 * i);
    }
  }
  throw lastErr;
}

/* ---------- Helpers ---------- */
const decode = (s) => s
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&euro;/g, "€")
  .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const stripTags = (s) => decode(s.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
const slugify = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ") : s);
const num = (s) => { const n = parseInt(String(s ?? "").replace(/[^\d]/g, ""), 10); return Number.isFinite(n) ? n : null; };

function nextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Geen __NEXT_DATA__ gevonden (mogelijk geblokkeerd door Marktplaats)");
  return JSON.parse(m[1]);
}

/* ---------- Profiel ---------- */
async function fetchProfileListings() {
  const all = [];
  let total = Infinity;
  for (let page = 1; page <= 10 && all.length < total; page++) {
    const html = await fetchRetry(page === 1 ? PROFILE_URL : `${PROFILE_URL}?currentPage=${page}`);
    const sr = nextData(html)?.props?.pageProps?.searchRequestAndResponse;
    if (!sr || !Array.isArray(sr.listings)) throw new Error("Onverwachte profielstructuur");
    total = sr.totalResultCount ?? sr.listings.length;
    if (!sr.listings.length) break;
    all.push(...sr.listings);
    await sleep(600);
  }
  return all.filter((l) => l.sellerInformation?.sellerId === SELLER_ID);
}

/* ---------- Detailpagina ---------- */
function parseDetail(html, listing) {
  const i = html.indexOf('"g_adid"');
  const block = i >= 0 ? html.slice(i, i + 4000) : "";
  const dl = (k) => { const m = block.match(new RegExp(`"${k}":"([^"]*)"`)); return m ? m[1] : null; };

  const specs = {};
  const equipment = [];
  const d = html.match(/<div data-collapsable="description">([\s\S]*?)<\/div>/);
  if (d) {
    for (const m of d[1].matchAll(/([^<>]+?):\s*<strong>([^<]*)<\/strong>([^<]*)/g)) {
      specs[decode(m[1]).trim().toLowerCase()] = { v: decode(m[2]).trim(), extra: decode(m[3]).trim() };
    }
    for (const m of d[1].matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      const item = stripTags(m[1]);
      if (item && !equipment.some((e) => e.toLowerCase() === item.toLowerCase())) equipment.push(item);
    }
  }

  const imageIds = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      for (const node of [].concat(j)) {
        if (node["@type"] === "Vehicle" && Array.isArray(node.image)) {
          for (const u of node.image) {
            const id = String(u).match(/images\/([0-9a-f-]{36})/)?.[1];
            if (id && !imageIds.includes(id)) imageIds.push(id);
          }
        }
      }
    } catch { /* volgende blok */ }
  }
  if (!imageIds.length) {
    for (const u of listing.imageUrls || []) {
      const id = String(u).match(/images\/([0-9a-f-]{36})/)?.[1];
      if (id && !imageIds.includes(id)) imageIds.push(id);
    }
  }
  return { dl, specs, equipment, imageIds: imageIds.slice(0, MAX_PHOTOS) };
}

async function downloadPhotos(slug, imageIds) {
  const dir = path.join(ROOT, "images", "cars", slug);
  await mkdir(dir, { recursive: true });
  const saved = [];
  for (let n = 0; n < imageIds.length; n++) {
    const file = `${String(n + 1).padStart(2, "0")}.jpg`;
    const base = `https://images.marktplaats.com/api/v1/hz-mp-pro-listing/images/${imageIds[n]}?rule=ecg_mp_eps$_`;
    let ok = false;
    for (const size of ["88", "86", "85", "83"]) { // 88/86 = 1024x768, 85 = 726x545, 83 = 358x269
      try {
        const { buf, type } = await fetchRetry(`${base}${size}.jpg`, true, 2);
        if (type.startsWith("image/") && buf.length > 2000) {
          await writeFile(path.join(dir, file), buf);
          ok = true;
          break;
        }
      } catch { /* probeer kleiner formaat */ }
    }
    if (ok) saved.push(`images/cars/${slug}/${file}`);
    await sleep(250);
  }
  return saved;
}

/* ---------- Mapping Marktplaats -> vehicles.json ---------- */
const BODY = { hatchback: "Hatchback", sedan: "Sedan", stationwagon: "Stationwagon", mpv: "MPV", cabriolet: "Cabriolet", coupe: "Coupé", "suv-terreinwagen": "SUV", suv: "SUV" };
const priceFrom = (l) => {
  const cents = l.priceInfo?.priceCents;
  if (l.reserved || l.priceInfo?.priceType !== "FIXED" || !cents || cents <= 100) return null;
  return Math.round(cents / 100);
};

function buildVehicle(listing, detail) {
  const { dl, specs, equipment } = detail;
  const sv = (k) => specs[k]?.v || null;
  const withExtra = (k) => (specs[k] ? `${specs[k].v} ${specs[k].extra}`.trim() : null);

  const cleaned = listing.title.replace(/\s+\d[\d.]*\s*km\b.*$/i, "").trim();
  const brand = dl("merk") || cleaned.split(" ")[0];
  let model = dl("model") || cleaned.split(" ")[1] || "";
  if (/^[a-z]/.test(model)) model = model.charAt(0).toUpperCase() + model.slice(1);
  let version = cleaned;
  const prefix = `${brand} ${model}`.toLowerCase();
  if (cleaned.toLowerCase().startsWith(prefix)) version = cleaned.slice(prefix.length).trim();

  const pkKw = (sv("vermogen") || "").match(/(\d+)\s*kW/i);
  const pk = (specs["vermogen"]?.extra || "").match(/(\d+)\s*PK/i) || (dl("vermogen") ? [null, dl("vermogen")] : null);
  const cc = num(dl("motorinhoud"));
  const transmissionRaw = dl("transmissie") || "";
  const apkKey = Object.keys(specs).find((k) => k.startsWith("apk"));
  const year = num(dl("bouwjaar")) || num(listing.attributes?.find((a) => a.key === "constructionYear")?.value);
  const mileage = num(dl("kilometerstand")) || num(listing.attributes?.find((a) => a.key === "mileage")?.value) || 0;
  const fuel = cap(dl("brandstof") || "") || null;
  const transmission = transmissionRaw.startsWith("auto") ? "Automaat" : "Handgeschakeld";
  const price = priceFrom(listing);
  const vatText = "Margeregeling (btw niet verrekenbaar voor ondernemers)";

  const title = cleaned;
  return {
    id: listing.itemId,
    slug: slugify(`${brand} ${model} ${version}`),
    brand, model, version, title,
    status: listing.reserved ? "gereserveerd" : "beschikbaar",
    price,
    priceOnRequest: price == null,
    year, mileage, fuel, transmission,
    transmissionGears: num((sv("transmissie") || "").match(/(\d+)\s*versnelling/i)?.[1]),
    bodyType: BODY[dl("carrosserie")] || cap(dl("carrosserie") || ""),
    power: pkKw || pk ? { pk: pk ? +pk[1] : null, kw: pkKw ? +pkKw[1] : null } : null,
    displacement: cc ? `${(cc / 1000).toFixed(1)} liter` : null,
    doors: num(dl("aantal-deuren")) || num(sv("aantal deuren")),
    color: sv("kleur") || cap(dl("kleur") || ""),
    seats: num(dl("aantal-stoelen")) || num(sv("aantal zitplaatsen")),
    apk: apkKey ? sv(apkKey) : "Bij aflevering",
    firstOwner: Object.entries(specs).some(([k, s]) => /eigenaar/.test(k) && /^(ja|1)\b/i.test(s.v)) || null,
    nap: dl("nap-nationale-auto-pas") === "ja" || listing.napAvailable === true ? true : null,
    maintenanceBooklet: /onderhoudsboekje/.test(dl("onderhoud") || "") || /aanwezig/i.test(sv("onderhoudsboekjes") || "") ? true : null,
    dealerMaintained: Object.values(specs).some((s) => /dealer/i.test(s.v)) || /dealer/i.test(dl("onderhoud") || "") ? true : null,
    keys: sv("aantal sleutels"),
    warranty: "In overleg (3-12 mnd)",
    deliveryCosts: "Op aanvraag",
    vatMargin: vatText,
    roadTax: withExtra("motorrijtuigenbelasting"),
    fuelConsumptionCity: withExtra("brandstofverbruik in de stad"),
    fuelConsumptionHighway: withExtra("brandstofverbruik op de snelweg"),
    co2: sv("co₂-uitstoot") || sv("co2-uitstoot"),
    energyLabel: sv("energielabel") || (dl("energielabel") || "").toUpperCase() || null,
    topSpeed: sv("topsnelheid"),
    acceleration: sv("acceleratie (0-100)") ? `${sv("acceleratie (0-100)")} (0-100 km/u)` : null,
    tireSize: sv("bandenmaat"),
    dimensions: sv("afmetingen (lxbxh)") ? `${sv("afmetingen (lxbxh)")} (L x B x H)` : null,
    wheelbase: sv("wielbasis"),
    loadCapacity: sv("laadvermogen"),
    gvw: sv("gvw"),
    equipment,
    description: `${title} uit ${year} met ${new Intl.NumberFormat("nl-NL").format(mileage)} km. ${[fuel, transmission].filter(Boolean).join(", ")}${dl("nap-nationale-auto-pas") === "ja" ? ", NAP-gecontroleerd" : ""}. Bezichtiging op afspraak.`,
    sellerNote: null,
    images: [],
    marktplaatsUrl: "https://www.marktplaats.nl" + listing.vipUrl,
    marktplaatsPhotoCount: detail.imageIds.length,
    listedSince: today(),
  };
}

/* ---------- Hoofdprogramma ---------- */
async function main() {
  const file = JSON.parse((await readFile(DATA_FILE, "utf8")).replace(/^﻿/, ""));
  const vehicles = file.vehicles;

  let listings;
  try {
    listings = await fetchProfileListings();
  } catch (e) {
    console.log(`::warning::Synchronisatie overgeslagen, Marktplaats niet bereikbaar: ${e.message}`);
    return;
  }
  if (!listings.length && vehicles.some((v) => v.status !== "verkocht")) {
    console.log("::warning::Profiel gaf 0 advertenties terwijl er auto's op voorraad staan, wijzigingen overgeslagen (veiligheidscontrole).");
    return;
  }

  const seen = new Set();
  const log = [];

  for (const l of listings) {
    seen.add(l.itemId);
    const status = l.reserved ? "gereserveerd" : "beschikbaar";
    const price = priceFrom(l);
    let v = vehicles.find((x) => x.id === l.itemId);

    if (!v) {
      try {
        const detail = parseDetail(await fetchRetry("https://www.marktplaats.nl" + l.vipUrl), l);
        v = buildVehicle(l, detail);
        while (vehicles.some((x) => x.slug === v.slug)) v.slug += "-2";
        v.images = await downloadPhotos(v.slug, detail.imageIds);
        vehicles.unshift(v);
        log.push(`NIEUW: ${v.title}`);
      } catch (e) {
        console.log(`::warning::Nieuwe advertentie ${l.itemId} kon niet worden gelezen: ${e.message}`);
      }
      await sleep(800);
      continue;
    }

    const before = JSON.stringify([v.status, v.price, v.priceOnRequest]);
    v.status = status;
    v.price = price;
    v.priceOnRequest = price == null;
    delete v.soldSince;
    if (before !== JSON.stringify([v.status, v.price, v.priceOnRequest])) log.push(`BIJGEWERKT: ${v.title} (${status}, ${price ?? "prijs op aanvraag"})`);

    // Ontbrekende foto's alsnog ophalen (bijv. bij de eerste keer synchroniseren)
    const firstPhoto = v.images?.[0] ? path.join(ROOT, v.images[0]) : null;
    if (REFRESH_PHOTOS || !firstPhoto || !(await exists(firstPhoto))) {
      try {
        const detail = parseDetail(await fetchRetry("https://www.marktplaats.nl" + l.vipUrl), l);
        const saved = await downloadPhotos(v.slug, detail.imageIds);
        if (saved.length) {
          v.images = saved;
          v.marktplaatsPhotoCount = detail.imageIds.length;
          log.push(`FOTO'S: ${v.title} (${saved.length})`);
        }
      } catch (e) {
        console.log(`::warning::Foto's van ${v.title} niet opgehaald: ${e.message}`);
      }
      await sleep(800);
    }
  }

  // Advertenties die van Marktplaats verdwenen zijn -> verkocht, later verwijderen
  for (const v of [...vehicles]) {
    if (seen.has(v.id)) continue;
    const hasPhoto = v.images?.[0] && (await exists(path.join(ROOT, v.images[0])));
    if (!hasPhoto) {
      // Weg van Marktplaats en geen foto's om te tonen: meteen van de site halen
      vehicles.splice(vehicles.indexOf(v), 1);
      log.push(`VERWIJDERD: ${v.title}`);
    } else if (v.status !== "verkocht") {
      v.status = "verkocht";
      v.soldSince = today();
      log.push(`VERKOCHT: ${v.title}`);
    } else if (!v.soldSince) {
      v.soldSince = today();
    } else if ((Date.now() - new Date(v.soldSince).getTime()) / 86400000 > SOLD_KEEP_DAYS) {
      vehicles.splice(vehicles.indexOf(v), 1);
      await rm(path.join(ROOT, "images", "cars", v.slug), { recursive: true, force: true });
      log.push(`VERWIJDERD: ${v.title}`);
    }
  }

  // Sitemap met alle auto's voor Google (door Netlify doorgegeven als /sitemap-occasions.xml)
  const urls = vehicles.filter((v) => v.status !== "verkocht").map((v) => `  <url><loc>https://altenaautos.nl/occasions/${v.slug}/</loc></url>`);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  await writeFile(path.join(ROOT, "sitemap-occasions.xml"), sitemap, "utf8");

  if (log.length) file.lastSynced = today(); // geen wijzigingen = geen commit = geen nieuwe deploy
  await writeFile(DATA_FILE, JSON.stringify(file, null, 2) + "\n", "utf8");
  console.log(log.length ? log.join("\n") : "Geen wijzigingen op Marktplaats.");
}

main().catch((e) => {
  console.log(`::warning::Synchronisatie mislukt: ${e.message}`);
});
