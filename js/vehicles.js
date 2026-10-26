/* =========================================================
   Altena Auto's — Vehicle data laag
   Alle occasion-rendering (homepage preview + voorraadpagina)
   leest uit hetzelfde centrale bestand: /data/vehicles.json
   ========================================================= */

// De voorraad (data/vehicles.json) en de foto's staan op dezelfde site. GitHub haalt elke
// 10 minuten de voorraad van Marktplaats op en publiceert de site daarna opnieuw.
function assetUrl(path) {
  return /^https?:/.test(path) ? path : "/" + String(path).replace(/^\/+/, "");
}

async function loadVehicles() {
  const res = await fetch("/data/vehicles.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Kon voorraaddata niet laden: " + res.status);
  return (await res.json()).vehicles;
}
const icons = {
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 13l4-4M12 5v1M4 13H3M21 13h-1M6.3 6.3l.7.7M17.7 6.3l-.7.7"/></svg>',
  fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15"/><path d="M4 11h8M15 8l3 3v6.5a1.5 1.5 0 0 0 3 0V10a2 2 0 0 0-.6-1.4L18 6"/><path d="M2 21h14"/></svg>',
  gearbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M4.2 7.8l2.1 1.2M17.7 15l2.1 1.2M4.2 16.2l2.1-1.2M17.7 9l2.1-1.2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 12l6 6L20 6"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 13l1.5-4.5A2 2 0 0 1 6.4 7h11.2a2 2 0 0 1 1.9 1.5L21 13"/><rect x="2.5" y="13" width="19" height="6" rx="2"/><circle cx="7" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/></svg>',
  ext: '<svg class="ext-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 17L17 7M9 7h8v8"/></svg>'
};

function formatPrice(v) {
  if (v.priceOnRequest || v.price == null) return null;
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v.price);
}
function formatMileage(v) {
  return new Intl.NumberFormat("nl-NL").format(v.mileage) + " km";
}
function statusBadge(v) {
  if (v.status === "verkocht") return '<span class="badge badge-sold">Verkocht</span>';
  if (v.status === "gereserveerd") return '<span class="badge badge-reserved">Gereserveerd</span>';
  return "";
}
function isNewListing(v) {
  if (!v.listedSince) return false;
  const days = (Date.now() - new Date(v.listedSince).getTime()) / 86400000;
  return days <= 14;
}

function mediaBlock(v) {
  if (v.images && v.images.length > 0) {
    return `<img src="${assetUrl(v.images[0])}" alt="${v.title}" loading="lazy" width="480" height="360">`;
  }
  return `<div class="media-placeholder">${icons.car}<span>Foto's volgen binnenkort</span></div>`;
}

function occasionCardHTML(v, basePath = "") {
  const price = formatPrice(v);
  const badges = [];
  if (isNewListing(v) && v.status === "beschikbaar") badges.push('<span class="badge badge-new">Nieuw binnen</span>');
  if (v.status === "gereserveerd") badges.push('<span class="badge badge-reserved">Gereserveerd</span>');
  if (v.status === "verkocht") badges.push('<span class="badge badge-sold">Verkocht</span>');

  return `
  <article class="occasion-card reveal${v.status === "verkocht" ? " is-sold" : ""}" data-id="${v.id}">
    <a href="${basePath}occasions/${v.slug}/" class="media" aria-label="Bekijk ${v.title}">
      ${badges.length ? `<div class="card-badges">${badges.join("")}</div>` : ""}
      ${mediaBlock(v)}
    </a>
    <div class="card-body">
      <div>
        <span class="brand">${v.brand}</span>
        <h3><a href="${basePath}occasions/${v.slug}/">${v.model}</a></h3>
        <p class="version">${v.version}</p>
      </div>
      <div class="card-specs">
        <div><span>${v.year}</span><span>${formatMileage(v)}</span></div>
        <div><span>${v.fuel}</span><span>${v.transmission}</span></div>
      </div>
      <div class="card-footer">
        <div class="card-price${price && v.status !== "verkocht" ? "" : " on-request"}">${v.status === "verkocht" ? "Verkocht" : price ? price : "Prijs op aanvraag"}${price && v.status !== "verkocht" ? "<small>Rijklaarprijs</small>" : ""}</div>
        <span class="card-go" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
      </div>
    </div>
  </article>`;
}

function renderReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || els.length === 0) {
    els.forEach((el) => el.classList.add("in-view"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  // Kaarten die tegelijk in beeld komen verschijnen licht versprongen.
  let cardIdx = 0;
  els.forEach((el) => {
    if (el.classList.contains("occasion-card")) el.style.transitionDelay = (cardIdx++ % 4) * 90 + "ms";
    io.observe(el);
  });
}

window.AltenaVehicles = { loadVehicles, assetUrl, occasionCardHTML, formatPrice, formatMileage, statusBadge, isNewListing, icons, renderReveal };
