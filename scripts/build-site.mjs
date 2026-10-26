/* =========================================================
   Altena Auto's, site bouwen voor GitHub Pages
   Kopieert de site naar _site/ en maakt voor elke auto een eigen pagina
   /occasions/<slug>/ met de juiste titel, beschrijving en voorbeeldafbeelding
   (GitHub Pages kent geen doorverwijzingen zoals Netlify).
   De inhoud van de pagina wordt, net als eerst, door js/occasion.js gevuld.
   Draait automatisch in GitHub Actions: node scripts/build-site.mjs
   ========================================================= */

import { readFile, writeFile, mkdir, rm, cp, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "_site");
const SITE = "https://altenaautos.nl";

const SKIP_DIRS = new Set([".git", ".github", ".claude", ".netlify", "_site", "scripts", "node_modules", "memory"]);
const SKIP_FILES = new Set(["README.md", "_devserver.ps1", "netlify.toml", ".gitignore", "deploy-marker.txt"]);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const nl = (n) => new Intl.NumberFormat("nl-NL").format(n);

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const e of await readdir(ROOT, { withFileTypes: true })) {
  if (e.isDirectory() ? SKIP_DIRS.has(e.name) : SKIP_FILES.has(e.name)) continue;
  await cp(path.join(ROOT, e.name), path.join(OUT, e.name), {
    recursive: true,
    filter: (src) => !src.endsWith("-bron.png"),
  });
}

// Eigen pagina per auto
const template = await readFile(path.join(ROOT, "occasion.html"), "utf8");
const data = JSON.parse((await readFile(path.join(ROOT, "data", "vehicles.json"), "utf8")).replace(/^﻿/, ""));
let count = 0;
for (const v of data.vehicles) {
  const sold = v.status === "verkocht";
  const hasPrice = !v.priceOnRequest && v.price != null;
  const priceText = hasPrice ? "€ " + nl(v.price) + ",-" : "Prijs op aanvraag";
  const title = `${v.title} | ${priceText} | Altena Auto's`;
  const desc = `${v.title} uit ${v.year}, ${nl(v.mileage)} km, ${v.fuel}, ${v.transmission}. ${priceText} bij Altena Auto's in 's-Hertogenbosch.`;
  const url = `${SITE}/occasions/${v.slug}/`;
  const image = v.images && v.images[0] ? `${SITE}/${v.images[0]}` : `${SITE}/images/general/og-image.jpg`;

  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${image}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${image}$2`)
    .replace('<meta property="og:locale"', `<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(desc)}">\n<meta property="og:url" content="${url}">\n<meta property="og:locale"`);
  if (sold) html = html.replace("</head>", '<meta name="robots" content="noindex, follow">\n</head>');

  const dir = path.join(OUT, "occasions", v.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), html, "utf8");
  count++;
}
await writeFile(path.join(OUT, "CNAME"), "altenaautos.nl\n", "utf8");
await writeFile(path.join(OUT, ".nojekyll"), "", "utf8");
console.log(`Site gebouwd in _site/ met ${count} autopagina's.`);
