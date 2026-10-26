/* =========================================================
   Altena Auto's — Site-brede interactie
   Header, mobiel menu, reveal-animaties, formulieren.
   ========================================================= */

(function () {
  // Sticky header schaduw
  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Mobiel menu
  const navToggle = document.querySelector(".nav-toggle");
  const mainNav = document.querySelector(".main-nav");
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", () => {
      const open = mainNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    });
    mainNav.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        mainNav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      })
    );
  }

  // Markeer huidige pagina in navigatie
  const path = window.location.pathname.replace(/index\.html$/, "");
  document.querySelectorAll(".main-nav a[href]").forEach((a) => {
    const href = a.getAttribute("href").replace(/index\.html$/, "");
    if (href && href !== "/" && (path.endsWith(href) || (href !== "/" && path.includes(href)))) {
      a.setAttribute("aria-current", "page");
    }
  });

  // Logo-fallback: als het echte logo-bestand nog ontbreekt, toon de tekstvariant.
  document.querySelectorAll(".logo img, .footer-brand img").forEach((img) => {
    img.addEventListener("error", () => {
      img.style.display = "none";
      const fallback = img.nextElementSibling;
      if (fallback && fallback.classList.contains("logo-fallback")) {
        fallback.style.display = "inline-flex";
      }
    }, { once: true });
  });
})();

/* ---------- Formulieren ----------
   Statische site zonder eigen server, dus formulieren worden rechtstreeks
   vanuit de browser verzonden via FormSubmit (https://formsubmit.co) naar
   info@altenaautos.nl -- geen account/koppeling nodig, alleen het e-mailadres
   in de aanroep hieronder. Bij het allereerste bericht stuurt FormSubmit naar
   dat e-mailadres een eenmalige activatiemail; die moet één keer worden
   geopend en bevestigd voordat berichten daadwerkelijk aankomen.
   Lukt de verzending niet (geen internet, dienst onbereikbaar), dan valt het
   formulier terug op een mailto-koppeling die het eigen e-mailprogramma opent. */
function wireMailtoForm(formEl, { to, subjectPrefix, extraFields = () => ({}) }) {
  if (!formEl) return;
  const statusEl = formEl.querySelector(".form-status");
  const submitBtn = formEl.querySelector('button[type="submit"]');

  function fallbackToMailto(bodyLines) {
    const subject = encodeURIComponent(`${subjectPrefix}${bodyLines.Auto ? ": " + bodyLines.Auto : ""}`);
    let body = "";
    Object.entries(bodyLines).forEach(([k, v]) => { if (v) body += `${k}: ${v}\n`; });
    window.location.href = `mailto:${to}?subject=${subject}&body=${encodeURIComponent(body)}`;
    if (statusEl) {
      statusEl.textContent = "Verzenden via de website lukte niet, je e-mailprogramma opent nu met je bericht klaar om naar " + to + " te sturen.";
      statusEl.className = "form-status error";
    }
  }

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const required = formEl.querySelectorAll("[required]");
    let valid = true;
    required.forEach((f) => {
      if (!f.value || !f.value.trim()) { valid = false; f.setAttribute("aria-invalid", "true"); }
      else f.removeAttribute("aria-invalid");
    });
    if (!valid) {
      if (statusEl) { statusEl.textContent = "Vul de verplichte velden in."; statusEl.className = "form-status error"; }
      return;
    }

    // FormSubmit accepteert maximaal ~5 MB aan bijlagen per bericht.
    let attachBytes = 0;
    formEl.querySelectorAll('input[type="file"]').forEach((f) => { for (const file of f.files) attachBytes += file.size; });
    if (attachBytes > 5 * 1024 * 1024) {
      if (statusEl) { statusEl.textContent = "De foto's zijn samen groter dan 5 MB. Kies minder of kleinere foto's, of app ze naar 06 - 218 16 055."; statusEl.className = "form-status error"; }
      return;
    }

    const extra = extraFields();
    const plainFields = {};
    formEl.querySelectorAll("[name]").forEach((f) => {
      if (f.type !== "file" && f.value) plainFields[f.name] = f.value;
    });
    Object.assign(plainFields, extra);

    if (submitBtn) submitBtn.disabled = true;
    if (statusEl) { statusEl.textContent = "Bezig met verzenden…"; statusEl.className = "form-status"; }

    const data = new FormData(formEl);
    Object.entries(extra).forEach(([k, v]) => { if (v) data.append(k, v); });
    data.append("_subject", `${subjectPrefix}${extra.Auto ? ": " + extra.Auto : ""}`);
    data.append("_template", "table");
    if (plainFields["E-mail"]) data.append("_replyto", plainFields["E-mail"]); // "Beantwoorden" gaat direct naar de bezoeker
    data.append("_captcha", "false");

    try {
      const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data,
      });
      if (!res.ok) throw new Error("FormSubmit gaf status " + res.status);
      // FormSubmit antwoordt ook bij weigering (bv. formulier nog niet geactiveerd) met HTTP 200,
      // dus het antwoord zelf moet success "true" melden.
      const result = await res.json();
      if (String(result.success) !== "true") throw new Error(result.message || "FormSubmit weigerde het bericht");

      formEl.reset();
      if (statusEl) {
        statusEl.textContent = "Bedankt! Je bericht is verzonden. We nemen zo snel mogelijk contact met je op.";
        statusEl.className = "form-status success";
      }
    } catch (err) {
      console.error("Formulierverzending mislukt, val terug op mailto:", err);
      fallbackToMailto(plainFields);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

window.AltenaForms = { wireMailtoForm };

/* ---------- Effecten: parallax hero, count-up, horizontale rail ---------- */
(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Parallax: de hero-foto beweegt trager dan de pagina.
  const hero = document.querySelector(".hero");
  if (hero && !reduceMotion) {
    let ticking = false;
    const update = () => {
      const y = Math.min(window.scrollY, hero.offsetHeight);
      hero.style.setProperty("--hero-shift", (y * 0.22).toFixed(1) + "px");
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
  }

  function countUp(el, to, duration = 1400) {
    if (!el) return;
    if (reduceMotion || to <= 0) { el.textContent = to; return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(to * eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Voorraad-rail met pijlknoppen, en met de muis te slepen.
  function initRail(railId, prevId, nextId) {
    const rail = document.getElementById(railId);
    const prev = document.getElementById(prevId);
    const next = document.getElementById(nextId);
    if (!rail) return;

    const step = () => {
      const card = rail.querySelector(".occasion-card");
      return card ? card.getBoundingClientRect().width + 28 : rail.clientWidth * 0.8;
    };
    const sync = () => {
      if (prev) prev.disabled = rail.scrollLeft < 8;
      if (next) next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 8;
    };
    if (prev) prev.addEventListener("click", () => rail.scrollBy({ left: -step(), behavior: "smooth" }));
    if (next) next.addEventListener("click", () => rail.scrollBy({ left: step(), behavior: "smooth" }));
    rail.addEventListener("dragstart", (e) => e.preventDefault());
    rail.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();

    // Slepen met de muis (touch scrolt al native).
    let down = false, startX = 0, startLeft = 0, moved = false;
    rail.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") return;
      down = true; moved = false; startX = e.clientX; startLeft = rail.scrollLeft;
    });
    window.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 5) { moved = true; rail.style.scrollSnapType = "none"; rail.style.cursor = "grabbing"; }
      rail.scrollLeft = startLeft - dx;
    });
    window.addEventListener("pointerup", () => {
      if (!down) return;
      down = false; rail.style.cursor = ""; rail.style.scrollSnapType = "";
    });
    // Na een sleepbeweging geen klik op de kaart laten doorgaan.
    rail.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  }

  window.AltenaFX = { countUp, initRail };
})();

/* ---------- WhatsApp (wa.me) ---------- */
(function () {
  const NUMBER = "31621816055";
  const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';

  // Op een occasion-detailpagina: bericht met de naam van de auto alvast ingevuld.
  let text = "Hallo, ik heb een vraag over Altena Auto's.";
  const card = document.querySelector(".sidebar-card h1");
  if (card) {
    const brand = document.querySelector(".sidebar-card .brand");
    const version = card.nextElementSibling;
    const car = [brand && brand.textContent, card.textContent, version && version.textContent].filter(Boolean).join(" ").trim();
    text = "Hallo, ik heb interesse in de " + car + ". Is deze nog beschikbaar?";
  }
  const href = "https://wa.me/" + NUMBER + "?text=" + encodeURIComponent(text);

  const btn = document.createElement("a");
  btn.className = "wa-float";
  btn.href = href;
  btn.target = "_blank";
  btn.rel = "noopener";
  btn.setAttribute("aria-label", "Stuur ons een WhatsApp-bericht");
  btn.innerHTML = icon;
  document.body.appendChild(btn);

  const list = document.querySelector(".footer-col:nth-child(3) ul");
  if (list) {
    const li = document.createElement("li");
    li.innerHTML = '<a href="https://wa.me/' + NUMBER + '" target="_blank" rel="noopener">WhatsApp</a>';
    list.insertBefore(li, list.children[1] || null);
  }
})();
