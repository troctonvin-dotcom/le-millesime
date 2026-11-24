// Fabrique les pages HTML du site à partir du contenu (base + valeurs par défaut).
const SITE = "https://le-millesime.fr";

function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function paragraphes(texte, cls) {
  return String(texte || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p${cls ? ` class="${cls}"` : ""}>${esc(p).replace(/\n/g, "<br>")}</p>`).join("\n        ");
}
function urlPhoto(src) {
  const s = String(src || "");
  if (/^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/photos\//.test(s)) return s;
  if (/^assets\/[A-Za-z0-9/_.-]+$/.test(s)) return s;
  return "assets/img/gallery-cave.jpg";
}
function absolu(src) { const u = urlPhoto(src); return u.startsWith("http") ? u : `${SITE}/${u}`; }
function telLien(t) {
  const d = String(t || "").replace(/[^\d+]/g, "");
  if (/^0\d{9}$/.test(d)) return "+33" + d.slice(1);
  return d;
}
function heure(h) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(h || "");
  if (!m) return esc(h);
  const hh = String(parseInt(m[1], 10));
  return m[2] === "00" ? `${hh}h` : `${hh}h${m[2]}`;
}
const JOURS_EN = { Lundi: "Monday", Mardi: "Tuesday", Mercredi: "Wednesday", Jeudi: "Thursday", Vendredi: "Friday", Samedi: "Saturday", Dimanche: "Sunday" };

// Regroupe les jours consécutifs aux mêmes horaires : « Mardi – Mercredi : 11h – 22h »
function groupesHoraires(horaires) {
  const g = [];
  (horaires || []).forEach((j) => {
    const cle = j.ouvert ? `${j.ouverture}-${j.fermeture}` : "ferme";
    const der = g[g.length - 1];
    if (der && der.cle === cle) { der.fin = j.jour; der.n++; } else g.push({ cle, debut: j.jour, fin: j.jour, j, n: 1 });
  });
  return g;
}
function lignesHoraires(horaires) {
  return groupesHoraires(horaires).filter((x) => x.cle !== "ferme").map((x) => {
    const jours = x.n === 1 ? x.debut : (x.n === 2 ? `${x.debut} et ${x.fin.toLowerCase()}` : `Du ${x.debut.toLowerCase()} au ${x.fin.toLowerCase()}`);
    return `${jours} : ${heure(x.j.ouverture)} – ${heure(x.j.fermeture)}`;
  });
}
function joursFermes(horaires) {
  const f = (horaires || []).filter((j) => !j.ouvert).map((j) => j.jour.toLowerCase());
  return f.length ? `Fermé le ${f.join(" et le ")}` : "";
}
function texteHoraires(horaires) {
  const l = lignesHoraires(horaires);
  const f = joursFermes(horaires);
  return l.join(". ") + (f ? `. ${f}.` : ".");
}

function jsonLd(c) {
  const i = c.infos;
  const specs = groupesHoraires(i.horaires).filter((x) => x.cle !== "ferme").map((x) => {
    const jours = i.horaires.filter((j) => j.ouvert && `${j.ouverture}-${j.fermeture}` === x.cle).map((j) => JOURS_EN[j.jour]);
    return { "@type": "OpeningHoursSpecification", dayOfWeek: [...new Set(jours)], opens: x.j.ouverture, closes: x.j.fermeture };
  });
  const uniq = []; const vu = new Set();
  specs.forEach((s) => { const k = s.opens + s.closes; if (!vu.has(k)) { vu.add(k); uniq.push(s); } });
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["BarOrPub", "LiquorStore"], "@id": `${SITE}/#etablissement`, name: i.nom,
        alternateName: [`${i.nom} ${i.ville}`, `Cave ${i.nom}`, `Bar à vin ${i.nom}`],
        description: `Cave à vin et bar à vin à ${i.ville} : ${c.offre.cartes.map((x) => x.titre).join(", ")}. ${c.evenements.titre}.`,
        slogan: c.accueil.slogan, url: `${SITE}/`, telephone: telLien(i.telephone), email: i.email,
        logo: `${SITE}/assets/logo.png`, image: c.galerie.photos.slice(0, 4).map((p) => absolu(p.src)),
        address: { "@type": "PostalAddress", streetAddress: i.adresse, postalCode: i.code_postal, addressLocality: i.ville, addressRegion: "Bourgogne-Franche-Comté", addressCountry: "FR" },
        hasMap: `https://www.google.com/maps?q=${encodeURIComponent(`${i.adresse}, ${i.code_postal} ${i.ville}`)}`,
        openingHoursSpecification: uniq,
        areaServed: [{ "@type": "City", name: i.ville }, { "@type": "AdministrativeArea", name: "Yonne" }],
        acceptsReservations: true,
        sameAs: i.instagram ? [`https://www.instagram.com/${i.instagram}/`] : []
      },
      { "@type": "WebSite", "@id": `${SITE}/#site`, url: `${SITE}/`, name: `${i.nom} — Cave & bar à vin à ${i.ville}`, inLanguage: "fr-FR", publisher: { "@id": `${SITE}/#etablissement` } },
      { "@type": "FAQPage", "@id": `${SITE}/#faq`, mainEntity: c.faq.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.reponse } })) }
    ]
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/</g, "\\u003c")}\n</script>`;
}

function tete(c, o) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(o.titre)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${SITE}${o.chemin}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(c.infos.nom)}">
<meta property="og:url" content="${SITE}${o.chemin}">
<meta property="og:title" content="${esc(o.titre)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:image" content="${esc(absolu(c.galerie.photos[0] ? c.galerie.photos[0].src : ""))}">
<meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary_large_image">
${o.jsonld || ""}
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
</head>`;
}

function entete(liens, cta) {
  return `<a class="skip-link" href="#contenu">Aller au contenu</a>

<header class="site-header" id="top">
  <div class="site-header__inner">
    <a href="index.html" class="brand">
      <img src="assets/logo.png" alt="Le Millésime" width="112" height="75" class="brand__logo">
    </a>
    <button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="siteNav">
      <span class="nav-toggle__bar"></span>
      <span class="nav-toggle__bar"></span>
      <span class="nav-toggle__bar"></span>
      <span class="visually-hidden">Ouvrir le menu</span>
    </button>
    <nav class="site-nav" id="siteNav" aria-label="Navigation principale">
      <ul>
${liens.map(([h, t]) => `        <li><a href="${h}">${t}</a></li>`).join("\n")}
      </ul>
      <a href="${cta}" class="btn btn--gold nav-cta">Réserver une table</a>
    </nav>
  </div>
</header>`;
}

function annonce(c) {
  const a = c.annonce || {};
  if (!a.actif || !String(a.texte || "").trim()) return "";
  const lien = /^(https:\/\/|[a-z]+\.html|#)/.test(a.lien || "") ? a.lien : "";
  const t = esc(a.texte);
  return `<div class="annonce" role="note">${lien ? `<a href="${esc(lien)}">${t}</a>` : t}</div>`;
}

function piedDePage(c, p) {
  const i = c.infos;
  const lien = (ancre) => (p === "accueil" ? `#${ancre}` : `index.html#${ancre}`);
  return `<footer class="site-footer">
  <div class="site-footer__inner">
    <a href="${p === "accueil" ? "#top" : "index.html"}" class="brand brand--footer">
      <img src="assets/logo.png" alt="Le Millésime" width="54" height="36" class="brand__logo">
      <span class="brand__name">${esc(i.nom)}</span>
    </a>
    <nav aria-label="Liens du pied de page">
      <ul class="footer-nav">
        <li><a href="${lien("histoire")}">Histoire</a></li>
        <li><a href="${lien("propose")}">Ce qu'on propose</a></li>
        <li><a href="galerie.html">Galerie</a></li>
        <li><a href="${lien("avis")}">Avis</a></li>
        <li><a href="${lien("evenements")}">Événements</a></li>
        <li><a href="${lien("negoce")}">Espace Négoce</a></li>
        <li><a href="${lien("faq")}">Questions fréquentes</a></li>
        <li><a href="${lien("infos-pratiques")}">Infos pratiques</a></li>
        <li><a href="contact.html">Réservation &amp; Contact</a></li>
        <li><a href="roue.html">Tentez votre chance</a></li>
      </ul>
    </nav>
    ${i.instagram ? `<a href="https://www.instagram.com/${esc(i.instagram)}/" class="footer-instagram" target="_blank" rel="noopener">@${esc(i.instagram)}</a>` : ""}
  </div>
  <p class="site-footer__legal">L'abus d'alcool est dangereux pour la santé, à consommer avec modération.</p>
</footer>`;
}

function blocInfos(c, classeLiens) {
  const i = c.infos;
  const lignes = lignesHoraires(i.horaires);
  return `<dl class="infos__list">
          <div>
            <dt>Adresse</dt>
            <dd>${esc(i.adresse)}<br>${esc(i.code_postal)} ${esc(i.ville)}</dd>
          </div>
          <div>
            <dt>Horaires</dt>
            <dd>${lignes.map(esc).join("<br>")}${joursFermes(i.horaires) ? `<br>${esc(joursFermes(i.horaires))}` : ""}</dd>
          </div>
          <div>
            <dt>Téléphone</dt>
            <dd><a href="tel:${esc(telLien(i.telephone))}">${esc(i.telephone)}</a></dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd><a href="mailto:${esc(i.email)}">${esc(i.email)}</a></dd>
          </div>${i.instagram ? `
          <div>
            <dt>Instagram</dt>
            <dd><a href="https://www.instagram.com/${esc(i.instagram)}/" target="_blank" rel="noopener">@${esc(i.instagram)}</a></dd>
          </div>` : ""}
        </dl>`;
}

const SVG_GOOGLE = '<svg viewBox="0 0 18 18" width="14" height="14"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>';

function figureGalerie(p) {
  const cls = p.format === "large" ? " galerie__item--wide" : (p.format === "haute" ? " galerie__item--tall" : "");
  return `<figure class="galerie__item${cls}" data-reveal="media">
          <img src="${esc(urlPhoto(p.src))}" alt="${esc(p.alt)}" loading="lazy">
        </figure>`;
}

function pageAccueil(c, p) {
  const i = c.infos;
  const nav = [["#histoire", "Histoire"], ["#propose", "Ce qu'on propose"], ["galerie.html", "Galerie"], ["#avis", "Avis"], ["#evenements", "Événements"], ["#negoce", "Espace Négoce"], ["#infos-pratiques", "Infos pratiques"]];
  const adresseCarte = encodeURIComponent(`${i.adresse}, ${i.code_postal} ${i.ville}`).replace(/%20/g, "+");
  return `${tete(c, {
    titre: `${i.nom} — Cave à vin & bar à vin à ${i.ville} (Yonne)`,
    description: `${i.nom}, cave à vin et bar à vin à ${i.ville} (${i.code_postal}) : ${c.offre.cartes[0] ? c.offre.cartes[0].texte.slice(0, 80) : ""} ${texteHoraires(i.horaires)}`.slice(0, 300),
    chemin: "/", jsonld: jsonLd(c)
  })}
<body data-roue-popup="${p.popup ? "1" : "0"}">

${entete(nav, "contact.html")}
${annonce(c)}

<main id="contenu">

  <!-- HERO -->
  <section class="hero">
    <div class="hero__content">
      <div class="hero__text">
        <p class="eyebrow-quiet">${esc(c.accueil.surtitre)}</p>
        <h1 class="hero__title">${esc(c.accueil.titre)}</h1>
        <p class="hero__tagline">${esc(c.accueil.accroche)}</p>
        <p class="hero__slogan">${esc(c.accueil.slogan)}</p>
        <div class="hero__actions">
          <a href="contact.html" class="btn btn--gold">Réserver une table</a>
          <a href="#infos-pratiques" class="btn btn--ghost">Voir les horaires</a>
        </div>
      </div>
      <figure class="hero__photo">
        <img src="${esc(urlPhoto(c.accueil.photo))}" alt="${esc(c.accueil.photo_alt)}" width="765" height="1020" fetchpriority="high" style="object-position: center 8%;">
      </figure>
    </div>
  </section>

  <!-- HISTOIRE -->
  <section id="histoire" class="section histoire">
    <div class="histoire__grid">
      <figure class="histoire__figure" data-reveal="media">
        <img src="${esc(urlPhoto(c.histoire.photo))}" alt="${esc(c.histoire.photo_alt)}" loading="lazy">
      </figure>
      <div class="histoire__text" data-reveal>
        <h2 class="title-left">${esc(c.histoire.titre)}</h2>
        ${paragraphes(c.histoire.texte)}
      </div>
    </div>
  </section>

  <!-- CE QU'ON PROPOSE -->
  <section id="propose" class="section propose">
    <div class="section__inner">
      <h2 class="section__title">${esc(c.offre.titre)}</h2>
      ${c.offre.intro ? `<p class="section__intro" style="color:var(--creme);opacity:.85;">${esc(c.offre.intro)}</p>` : ""}
      <div class="propose__grid">
${c.offre.cartes.slice(0, 3).map((x, k) => `        <article class="propose__card propose__card--${["cave", "bar", "epicerie"][k]}" data-reveal="media">
          <img src="${esc(urlPhoto(x.photo))}" alt="${esc(x.photo_alt)}" loading="lazy">
          <div class="propose__body">
            <div class="propose__caption">
              <h3>${esc(x.titre)}</h3>
              <p>${esc(x.texte)}</p>
            </div>
          </div>
        </article>`).join("\n")}
      </div>
    </div>
  </section>

  <!-- GALERIE -->
  <section id="galerie" class="section galerie">
    <div class="section__inner">
      <h2 class="section__title">Galerie</h2>
      <p class="section__intro">Un aperçu de l'ambiance du Millésime : cave, bar et bonnes tables.</p>
      <div class="galerie__grid">
        ${c.galerie.photos.slice(0, 4).map(figureGalerie).join("\n        ")}
      </div>
      <p class="galerie__more">
        <a href="galerie.html" class="btn btn--gold">Voir toute la galerie</a>
      </p>
    </div>
  </section>

  <!-- AVIS -->
  <section id="avis" class="section avis">
    <div class="section__inner">
      <h2 class="section__title">${esc(c.avis.titre)}</h2>
      ${i.note_google ? `<p class="section__intro" style="color:var(--or);font-weight:600;font-size:1.1rem;">${esc(i.note_google)}/5 sur Google${i.nombre_avis ? ` · ${esc(i.nombre_avis)} avis` : ""}</p>` : ""}
      <div class="carousel" data-carousel role="region" aria-roledescription="carrousel" aria-label="Avis clients">
        <div class="carousel__viewport">
          <ul class="carousel__track" data-carousel-track>
${c.avis.liste.map((a, k, l) => `            <li class="carousel__slide" role="group" aria-roledescription="diapositive" aria-label="Avis ${k + 1} sur ${l.length}">
              <blockquote class="avis__card">
                <div class="avis__avatar">
                  <span class="avis__avatar-initial">${esc((a.nom || "?").trim().charAt(0).toUpperCase())}</span>
                  <span class="avis__avatar-badge avis__avatar-badge--google" aria-hidden="true">${SVG_GOOGLE}</span>
                </div>
                <p class="avis__name">${esc(a.nom)}</p>
                <p class="avis__source">Avis Google${a.date ? ` · ${esc(a.date)}` : ""}</p>
                <p class="avis__stars" aria-label="5 étoiles sur 5">★★★★★</p>
                <p class="avis__text">« ${esc(a.texte)} »</p>
              </blockquote>
            </li>`).join("\n")}
          </ul>
        </div>
        <p class="visually-hidden" aria-live="polite" data-carousel-status>Avis 1 sur ${c.avis.liste.length}</p>
        <div class="carousel__controls">
          <button type="button" class="carousel__arrow" data-carousel-prev aria-label="Avis précédent">‹</button>
          <div class="carousel__progress" aria-hidden="true"><div class="carousel__progress-fill" data-carousel-progress></div></div>
          <button type="button" class="carousel__arrow" data-carousel-next aria-label="Avis suivant">›</button>
        </div>
      </div>
    </div>
  </section>

  <!-- ÉVÉNEMENTS -->
  <section id="evenements" class="section evenements">
    <div class="evenements__grid">
      <div class="evenements__text" data-reveal>
        <h2 class="title-left">${esc(c.evenements.titre)}</h2>
        ${paragraphes(c.evenements.texte)}
        <ul class="tag-list">
          ${(c.evenements.etiquettes || []).map((t) => `<li class="tag">${esc(t)}</li>`).join("\n          ")}
        </ul>
        <a href="contact.html" class="btn btn--gold">Contact</a>
      </div>
      <figure class="evenements__figure" data-reveal="media">
        <img src="${esc(urlPhoto(c.evenements.photo))}" alt="${esc(c.evenements.photo_alt)}" loading="lazy">
      </figure>
    </div>
  </section>

  <!-- NÉGOCE -->
  <section id="negoce" class="section negoce">
    <div class="histoire__grid">
      <figure class="histoire__figure" data-reveal="media">
        <img src="${esc(urlPhoto(c.negoce.photo))}" alt="${esc(c.negoce.photo_alt)}" loading="lazy">
      </figure>
      <div class="histoire__text" data-reveal>
        <p class="eyebrow-quiet">Professionnels</p>
        <h2 class="title-left">${esc(c.negoce.titre)}</h2>
        ${paragraphes(c.negoce.texte)}
        <ul class="tag-list">
          ${(c.negoce.etiquettes || []).map((t) => `<li class="tag">${esc(t)}</li>`).join("\n          ")}
        </ul>
        ${paragraphes(c.negoce.texte2)}
        <a href="contact.html" class="btn btn--gold">Nous contacter</a>
      </div>
    </div>
  </section>

  <!-- FAQ -->
  <section id="faq" class="section faq">
    <div class="section__inner faq__inner">
      <h2 class="section__title">Questions fréquentes</h2>
      <div class="faq__list">
${c.faq.map((q) => `        <details class="faq__item">
          <summary>${esc(q.question)}</summary>
          <p>${esc(q.reponse)}</p>
        </details>`).join("\n")}
      </div>
    </div>
  </section>

  <!-- INFOS PRATIQUES -->
  <section id="infos-pratiques" class="section infos">
    <div class="section__inner infos__grid">
      <div class="infos__text" data-reveal>
        <h2 class="title-left">Infos pratiques</h2>
        ${blocInfos(c)}
      </div>
      <div class="infos__map" data-reveal="media">
        <iframe title="Localisation du Millésime, ${esc(i.adresse)}, ${esc(i.code_postal)} ${esc(i.ville)}" src="https://www.google.com/maps?q=${adresseCarte}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
      </div>
    </div>
  </section>

</main>

${piedDePage(c, "accueil")}

<aside class="reserve-popup" id="reservePopup" data-reserve-popup hidden aria-label="Proposition de réservation">
  <button type="button" class="reserve-popup__close" data-reserve-popup-close aria-label="Fermer">×</button>
  <p class="reserve-popup__title">Une envie de vin ce soir ?</p>
  <p class="reserve-popup__text">Réservez votre table au Millésime en quelques secondes.</p>
  <a href="contact.html" class="btn btn--gold reserve-popup__cta" data-reserve-popup-cta>Réserver une table</a>
</aside>

<svg class="wine-progress" data-wine-progress viewBox="0 0 40 70" width="34" height="60" aria-hidden="true" focusable="false">
  <defs><clipPath id="wineProgressClip"><path d="M9,5 L31,5 L25,38 Q25,45 20,45 Q15,45 15,38 Z" /></clipPath></defs>
  <rect class="wine-progress__liquid" data-wine-progress-liquid x="9" y="45" width="22" height="0" clip-path="url(#wineProgressClip)"></rect>
  <path class="wine-progress__glass" d="M8,4 L32,4 L25,38 Q25,46 20,46 Q15,46 15,38 Z" fill="none" stroke="currentColor" stroke-width="1.4"></path>
  <path class="wine-progress__stem" d="M20,46 L20,60 M11,62 L29,62" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"></path>
</svg>

<script src="script.js"></script>
</body>
</html>
`;
}

function navSecondaire() {
  return [["index.html#histoire", "Histoire"], ["index.html#propose", "Ce qu'on propose"], ["galerie.html", "Galerie"], ["index.html#avis", "Avis"], ["index.html#evenements", "Événements"], ["index.html#negoce", "Espace Négoce"], ["index.html#infos-pratiques", "Infos pratiques"]];
}

function pageGalerie(c) {
  const i = c.infos;
  return `${tete(c, {
    titre: `Galerie photos — ${i.nom}, cave & bar à vin à ${i.ville}`,
    description: `Photos du Millésime, cave à vin et bar à vin à ${i.ville} : la cave, le bar, la terrasse et les planches.`,
    chemin: "/galerie.html"
  })}
<body>

${entete(navSecondaire(), "contact.html")}
${annonce(c)}

<main id="contenu">
  <section class="section contact-hero">
    <div class="section__inner">
      <p class="eyebrow-quiet">${esc(i.nom)} · Cave &amp; bar à vin à ${esc(i.ville)}</p>
      <h1 class="title-left contact-hero__title">Galerie</h1>
      <p class="contact-hero__lead">${esc(c.galerie.intro)}</p>
    </div>
  </section>
  <section class="section galerie">
    <div class="section__inner">
      <div class="galerie__grid">
        ${c.galerie.photos.map(figureGalerie).join("\n        ")}
      </div>
    </div>
  </section>
</main>

${piedDePage(c, "galerie")}

<script src="script.js"></script>
</body>
</html>
`;
}

function pageContact(c) {
  const i = c.infos;
  return `${tete(c, {
    titre: `Réserver une table ou demander un devis — ${i.nom}, bar à vin à ${i.ville}`,
    description: `Réservez une table au ${i.nom}, cave et bar à vin à ${i.ville} (${i.code_postal}), ou demandez un devis pour privatiser le lieu : anniversaire, mariage, séminaire, soirée d'entreprise.`,
    chemin: "/contact.html"
  })}
<body>

${entete(navSecondaire(), "#reserver")}
${annonce(c)}

<main id="contenu">
  <section class="section contact-hero">
    <div class="section__inner">
      <p class="eyebrow-quiet">${esc(i.nom)} · ${esc(i.ville)}</p>
      <h1 class="title-left contact-hero__title">${esc(c.contact.titre)}</h1>
      <p class="contact-hero__lead">${esc(c.contact.intro)}</p>
    </div>
  </section>

  <section id="reserver" class="section contact">
    <div class="section__inner contact__grid">

      <form name="contact" method="POST" class="form" id="contactForm">
        <p class="form__honeypot" aria-hidden="true">
          <label>Ne pas remplir si vous êtes humain : <input name="bot-field" tabindex="-1" autocomplete="off"></label>
        </p>
        <div class="form__row form__row--split">
          <div><label for="name">Nom complet</label><input type="text" id="name" name="name" autocomplete="name" required></div>
          <div><label for="email">Email</label><input type="email" id="email" name="email" autocomplete="email" required></div>
        </div>
        <div class="form__row form__row--split">
          <div><label for="phone">Téléphone</label><input type="tel" id="phone" name="phone" autocomplete="tel"></div>
          <div>
            <label for="subject">Objet de la demande</label>
            <select id="subject" name="subject" required>
              <option value="">Choisir…</option>
              <option value="Réservation table">Réservation de table</option>
              <option value="Privatisation / événement">Privatisation / événement (devis)</option>
              <option value="Demande professionnelle (négoce)">Demande professionnelle (négoce)</option>
              <option value="Question générale">Question générale</option>
            </select>
          </div>
        </div>
        <div class="form__row form__row--split">
          <div><label for="date">Date souhaitée</label><input type="date" id="date" name="date"></div>
          <div><label for="guests">Nombre de personnes</label><input type="number" id="guests" name="guests" min="1" step="1" required></div>
        </div>
        <div class="form__row">
          <label for="message">Votre message</label>
          <textarea id="message" name="message" rows="5" required></textarea>
        </div>
        <button type="submit" class="btn btn--gold form__submit">Envoyer la demande</button>
        <p class="form__status" data-form-status role="status" aria-live="polite" hidden></p>
      </form>

      <div class="contact__info" data-reveal>
        <h2 class="title-left">Nous trouver</h2>
        ${blocInfos(c)}
        <a href="index.html#infos-pratiques" class="contact__map-link">Voir la carte sur la page d'accueil →</a>
      </div>

    </div>
  </section>
</main>

${piedDePage(c, "contact")}

<script src="script.js"></script>
</body>
</html>
`;
}

function llms(c) {
  const i = c.infos;
  return `# ${i.nom} — Cave à vin & bar à vin à ${i.ville} (Yonne)

> ${i.nom} est une cave à vin, un bar à vin et une épicerie fine situés ${i.adresse}, ${i.code_postal} ${i.ville} (Yonne, Bourgogne-Franche-Comté, France).

## L'essentiel
- Adresse : ${i.adresse}, ${i.code_postal} ${i.ville}, France
- Téléphone : ${i.telephone}
- E-mail : ${i.email}
${i.instagram ? `- Instagram : https://www.instagram.com/${i.instagram}/\n` : ""}- Horaires : ${texteHoraires(i.horaires)}
${i.note_google ? `- Note Google : ${i.note_google}/5${i.nombre_avis ? ` (${i.nombre_avis} avis)` : ""}\n` : ""}
## Ce qu'on y trouve
${c.offre.cartes.map((x) => `- ${x.titre} : ${x.texte}`).join("\n")}
- ${c.evenements.titre} : ${(c.evenements.etiquettes || []).join(", ")}.
- ${c.negoce.titre} (professionnels) : ${c.negoce.texte}

## Questions fréquentes
${c.faq.map((q) => `- ${q.question} ${q.reponse}`).join("\n")}

## Pages
- [Accueil](${SITE}/)
- [Réservation & Contact](${SITE}/contact.html)
- [Galerie](${SITE}/galerie.html)
`;
}

module.exports = { pageAccueil, pageGalerie, pageContact, llms, texteHoraires, lignesHoraires };
