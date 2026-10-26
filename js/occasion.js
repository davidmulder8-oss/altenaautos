/* =========================================================
   Altena Auto's, occasion-detailpagina
   Eén pagina voor alle auto's: leest de voorraad live (zie vehicles.js)
   en vult de pagina voor /occasions/<slug>/. Zo hoeft de site niet
   opnieuw gepubliceerd te worden als er een auto bijkomt of verdwijnt.
   ========================================================= */

(async function () {
  const SITE = "https://www.altenaautos.nl";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nl = (n) => new Intl.NumberFormat("nl-NL").format(n);
  const euro = (n) => "€ " + nl(n) + ",-";
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 12l6 6L20 6"/></svg>';
  const EXT = '<svg class="ext-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 17L17 7M9 7h8v8"/></svg>';

  $("footer-year").textContent = new Date().getFullYear();

  const parts = location.pathname.split("/").filter(Boolean);
  const slug = new URLSearchParams(location.search).get("auto") || (parts[0] === "occasions" ? parts[1] : null);

  let vehicle = null;
  try {
    vehicle = (await AltenaVehicles.loadVehicles()).find((v) => v.slug === slug);
  } catch (e) {
    console.error(e);
  }
  $("loading").style.display = "none";
  if (!vehicle) {
    document.title = "Auto niet gevonden | Altena Auto's";
    $("not-found").style.display = "block";
    return;
  }
  render(vehicle);
  $("content").style.display = "block";

  function row(label, value) {
    if (value === null || value === undefined || String(value).trim() === "") return "";
    return `<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`;
  }

  function render(v) {
    const sold = v.status === "verkocht";
    const hasPrice = !v.priceOnRequest && v.price != null;
    const priceText = sold ? "Verkocht" : hasPrice ? euro(v.price) : "Prijs op aanvraag";
    const priceNote = sold ? "Deze auto is niet meer beschikbaar" : hasPrice ? "Rijklaarprijs" : "Neem contact op voor de actuele prijs";
    const url = `${SITE}/occasions/${v.slug}/`;
    const firstImage = v.images && v.images[0] ? AltenaVehicles.assetUrl(v.images[0]) : "";

    // Titel, meta en structured data
    const pageTitle = `${v.title} | ${hasPrice ? euro(v.price) : "Prijs op aanvraag"} | Altena Auto's`;
    const metaDesc = `${v.title} uit ${v.year}, ${nl(v.mileage)} km, ${v.fuel}, ${v.transmission}. ${hasPrice ? euro(v.price) : "Prijs op aanvraag"} bij Altena Auto's in 's-Hertogenbosch.`;
    document.title = pageTitle;
    const setMeta = (sel, attr, val) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val); };
    setMeta('meta[name="description"]', "content", metaDesc);
    setMeta('link[rel="canonical"]', "href", url);
    const addMeta = (prop, val) => { const m = document.createElement("meta"); m.setAttribute("property", prop); m.setAttribute("content", val); document.head.appendChild(m); };
    addMeta("og:title", pageTitle); addMeta("og:description", metaDesc); addMeta("og:url", url);
    if (firstImage) addMeta("og:image", firstImage);

    const ld = {
      "@context": "https://schema.org", "@type": "Car", name: v.title,
      brand: { "@type": "Brand", name: v.brand }, model: v.model, vehicleModelDate: String(v.year),
      mileageFromOdometer: { "@type": "QuantitativeValue", value: v.mileage, unitCode: "KMT" },
      fuelType: v.fuel, vehicleTransmission: v.transmission, color: v.color,
      offers: {
        "@type": "Offer", priceCurrency: "EUR",
        availability: sold ? "https://schema.org/SoldOut" : v.status === "gereserveerd" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock",
        itemCondition: "https://schema.org/UsedCondition", url,
        seller: { "@type": "AutoDealer", name: "Altena Auto's", telephone: "+31621816055" },
      },
    };
    if (hasPrice) ld.offers.price = v.price;
    if (v.images && v.images.length) ld.image = v.images.map(AltenaVehicles.assetUrl);
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(ld);
    document.head.appendChild(script);

    // Broodkruimel en zijbalk
    $("crumb").textContent = `${v.brand} ${v.model}`;
    $("s-brand").textContent = v.brand;
    $("s-model").textContent = v.model;
    $("s-version").textContent = v.version;
    $("s-price").textContent = priceText;
    $("s-price-note").textContent = priceNote;
    $("q-year").textContent = v.year;
    $("q-km").textContent = nl(v.mileage) + " km";
    $("q-fuel").textContent = v.fuel;
    $("q-trans").textContent = v.transmission;
    $("description").textContent = v.description || "";

    // Status
    if (v.status === "gereserveerd") {
      $("s-badge").innerHTML = '<span class="badge badge-reserved" style="margin-bottom:14px;">Gereserveerd</span>';
      $("status-notice").innerHTML = '<div class="selected-vehicle-chip" style="background:#FBEFD9;border-color:rgba(180,116,14,0.3);"><span>Deze auto is op dit moment <strong>gereserveerd</strong>. Interesse? Neem contact op, dan laten we weten of er nog mogelijkheden zijn of houden we je op de hoogte.</span></div>';
    } else if (sold) {
      $("s-badge").innerHTML = '<span class="badge badge-sold" style="margin-bottom:14px;">Verkocht</span>';
      $("status-notice").innerHTML = '<div class="selected-vehicle-chip" style="background:var(--color-gray-100);border-color:var(--color-gray-300);"><span>Deze auto is inmiddels <strong>verkocht</strong>. Bekijk onze <a href="/occasions.html">actuele occasions</a> voor vergelijkbare auto\'s.</span></div>';
      $("gallery-main").classList.add("is-sold");
    }

    // Galerij
    if (v.images && v.images.length) {
      $("gallery-main").innerHTML = `<img src="${esc(AltenaVehicles.assetUrl(v.images[0]))}" alt="${esc(v.title)}" width="960" height="720">`;
      $("gallery-thumbs").innerHTML = v.images.map((src, i) => {
        const u = esc(AltenaVehicles.assetUrl(src));
        return `<button type="button" class="${i === 0 ? "active" : ""}" data-src="${u}"><img src="${u}" alt="Foto ${i + 1}" loading="lazy"></button>`;
      }).join("");
      $("gallery-thumbs").querySelectorAll("button[data-src]").forEach((btn) => btn.addEventListener("click", () => {
        $("gallery-thumbs").querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        $("gallery-main").querySelector("img").src = btn.dataset.src;
      }));
    } else {
      $("gallery-main").innerHTML = `<div class="media-placeholder" style="height:100%;">${AltenaVehicles.icons.car}<span>Foto's volgen binnenkort</span></div>`;
    }

    // Specificaties
    const power = v.power ? `${v.power.pk} pk (${v.power.kw} kW)` : null;
    const delivery = typeof v.deliveryCosts === "string" ? v.deliveryCosts : v.deliveryCosts ? euro(v.deliveryCosts) : null;
    $("spec-rows").innerHTML = [
      row("Merk", v.brand), row("Model", v.model), row("Uitvoering", v.version), row("Bouwjaar", v.year),
      row("Kilometerstand", nl(v.mileage) + " km"), row("Brandstof", v.fuel),
      row("Transmissie", v.transmissionGears ? `${v.transmission}, ${v.transmissionGears} versnellingen` : v.transmission),
      row("Carrosserie", v.bodyType), row("Vermogen", power), row("Cilinderinhoud", v.displacement),
      row("Aantal deuren", v.doors), row("Aantal zitplaatsen", v.seats), row("Kleur", v.color), row("APK", v.apk),
      row("Onderhoudsboekjes", v.maintenanceBooklet === true ? "Aanwezig" : v.maintenanceBooklet === false ? "Niet aanwezig" : null),
      row("Dealeronderhouden", v.dealerMaintained === true ? "Ja" : null),
      row("NAP-check", v.nap === true ? "Logisch bevonden" : null),
      row("Eerste eigenaar", v.firstOwner === true ? "Ja" : null),
      row("Aantal sleutels", v.keys), row("Garantie", v.warranty), row("Afleverkosten", delivery), row("BTW/marge", v.vatMargin),
      row("Motorrijtuigenbelasting", v.roadTax), row("Bandenmaat", v.tireSize), row("Afmetingen (L x B x H)", v.dimensions),
      row("Wielbasis", v.wheelbase), row("Laadvermogen", v.loadCapacity), row("Gewicht (GVW)", v.gvw),
      row("0-100 km/u", v.acceleration), row("Topsnelheid", v.topSpeed),
      row("Verbruik stad", v.fuelConsumptionCity), row("Verbruik snelweg", v.fuelConsumptionHighway),
      row("CO2-uitstoot", v.co2), row("Energielabel", v.energyLabel),
    ].join("");

    // Uitrusting en zekerheden
    $("equipment").innerHTML = v.equipment && v.equipment.length
      ? v.equipment.map((e) => `<li>${CHECK} ${esc(e)}</li>`).join("")
      : '<li style="color:var(--color-text-muted);">Uitrustingsgegevens voor deze auto zijn nog niet beschikbaar. Vraag ernaar bij het bekijken van de auto.</li>';

    const trust = [];
    if (v.nap === true) trust.push("NAP-gecontroleerd, logische kilometerstand");
    if (v.dealerMaintained === true) trust.push("Dealer onderhouden");
    if (v.maintenanceBooklet === true) trust.push("Onderhoudsboekjes aanwezig");
    if (v.firstOwner === true) trust.push("Eerste eigenaar");
    trust.push(`APK: ${v.apk}`, "Voertuig geschikt voor alle milieu-/emissiezones");
    $("trust").innerHTML = trust.map((t) => `<li>${CHECK} ${esc(t)}</li>`).join("");

    // Links
    const q = encodeURIComponent(v.slug);
    $("l-contact").href = `/contact.html?auto=${q}`;
    $("l-contact-mobile").href = `/contact.html?auto=${q}`;
    $("l-visit").href = `/contact.html?auto=${q}&bezichtiging=1`;
    if (v.marktplaatsUrl) $("l-mp").innerHTML = `<a href="${esc(v.marktplaatsUrl)}" target="_blank" rel="noopener" class="link-quiet">Originele advertentie bekijken ${EXT}</a>`;

    // WhatsApp-knop (staat al op de pagina via main.js): bericht met deze auto
    const wa = document.querySelector(".wa-float");
    if (wa) {
      const text = `Hallo, ik heb interesse in de ${v.brand} ${v.model} ${v.version}. Is deze nog beschikbaar?`;
      wa.href = "https://wa.me/31621816055?text=" + encodeURIComponent(text);
    }
  }
})();
