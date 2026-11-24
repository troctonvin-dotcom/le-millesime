(function () {
  "use strict";

  var URL_SB = "https://tqaaffgopecaixrjcvbi.supabase.co";
  var CLE_SB = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxYWFmZmdvcGVjYWl4cmpjdmJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0NzY4MDgsImV4cCI6MjExMTA1MjgwOH0.l8TBanpiQIQnvHqRCgT-WpvmOXn5PKcmtC374TknVPQ";
  var sb = window.supabase.createClient(URL_SB, CLE_SB);
  var liste = [], choisie = null, resaId = null, stripe = null, elements = null;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, texte) { var e = document.createElement(tag); if (cls) e.className = cls; if (texte != null) e.textContent = texte; return e; }
  function euros(c) { return (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: c % 100 ? 2 : 0 }); }
  function dateLongue(d) {
    var x = new Date(d);
    var j = x.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
    var h = x.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", "h");
    return j + " à " + h;
  }
  function duree(m) { var h = Math.floor(m / 60), r = m % 60; return h ? h + " h" + (r ? " " + (r < 10 ? "0" : "") + r : "") : r + " min"; }
  function limiteAnnulation(d) { return new Date(new Date(d).getTime() - 48 * 3600 * 1000); }
  function photoSure(u) { return /^(assets\/|https:\/\/tqaaffgopecaixrjcvbi\.supabase\.co\/storage\/)/.test(u || "") ? u : "assets/img/gallery-degustation.jpg"; }
  function message(t, ok) { var m = $("resaMsg"); m.textContent = t; m.className = "msg " + (ok ? "msg--ok" : "msg--ko"); m.hidden = !t; }
  function etape(n) { ["etapeConnexion", "etapeInfos", "etapeCarte", "etapeFin"].forEach(function (e) { $(e).hidden = e !== n; }); }

  async function appeler(action, donnees) {
    var s = (await sb.auth.getSession()).data.session;
    var rep = await fetch(URL_SB + "/functions/v1/masterclass", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CLE_SB, Authorization: "Bearer " + (s ? s.access_token : "") },
      body: JSON.stringify(Object.assign({ action: action }, donnees || {}))
    });
    var d = await rep.json().catch(function () { return {}; });
    if (!rep.ok && !d.erreur) d.erreur = "serveur";
    return d;
  }
  var ERREURS = {
    paiement_inactif: "Les réservations en ligne ouvrent très bientôt. En attendant, réservez par téléphone au 06 70 10 94 54.",
    email_non_confirme: "Confirmez d'abord votre adresse e-mail (lien reçu à la création du compte), puis réessayez.",
    complet: "Désolé, cette masterclass vient d'être complète.",
    passee: "Cette masterclass a déjà commencé.",
    introuvable: "Cette masterclass n'est plus disponible.",
    telephone: "Ce numéro de téléphone ne semble pas valide.",
    prenom: "Indiquez votre prénom.",
    conditions: "Merci d'accepter les conditions de réservation.",
    connexion: "Votre session a expiré : reconnectez-vous.",
    carte: "La carte n'a pas pu être enregistrée. Vérifiez-la ou essayez-en une autre."
  };
  function erreur(d) { return ERREURS[d.erreur] || "Une erreur est survenue. Réessayez dans un instant ou appelez-nous au 06 70 10 94 54."; }

  // ---------- Liste ----------
  async function charger() {
    var r = await sb.rpc("masterclasses_a_venir");
    var zone = $("listeMc"); zone.textContent = "";
    if (r.error) { zone.appendChild(el("p", "vide", "Impossible de charger les dates pour le moment. Réessayez plus tard ou appelez-nous.")); return; }
    liste = r.data || [];
    if (!liste.length) {
      var p = el("p", "vide", "Aucune masterclass n'est programmée pour le moment. Les prochaines dates sont annoncées sur Instagram ");
      var a = el("a", null, "@le_millesime_sens"); a.href = "https://www.instagram.com/le_millesime_sens/"; a.target = "_blank"; a.rel = "noopener";
      p.appendChild(a); p.appendChild(document.createTextNode("."));
      zone.appendChild(p); return;
    }
    liste.forEach(function (m) {
      var carte = el("article", "mc-carte");
      var ph = el("div", "mc-carte__photo"); ph.style.backgroundImage = "url('" + photoSure(m.photo).replace(/'/g, "%27") + "')"; ph.setAttribute("role", "img"); ph.setAttribute("aria-label", m.titre);
      var c = el("div", "mc-carte__corps");
      c.appendChild(el("p", "mc-carte__date", dateLongue(m.debut)));
      c.appendChild(el("h2", null, m.titre));
      if (m.description) c.appendChild(el("p", "mc-carte__desc", m.description));
      var infos = el("ul", "mc-carte__infos");
      var li1 = el("li"); li1.appendChild(el("b", null, euros(m.prix_cents))); li1.appendChild(document.createTextNode(" par personne, réglé sur place")); infos.appendChild(li1);
      infos.appendChild(el("li", null, "Durée : " + duree(m.duree_minutes)));
      c.appendChild(infos);
      var bas = el("div", "mc-carte__bas");
      var reste = m.places_restantes;
      bas.appendChild(el("span", "pastille-places" + (reste === 0 ? " pastille-places--complet" : reste <= 3 ? " pastille-places--peu" : ""),
        reste === 0 ? "Complet" : reste === 1 ? "Dernière place" : reste + " places restantes"));
      if (reste > 0) {
        var b = el("button", "btn btn--gold", "Réserver ma place"); b.type = "button";
        b.addEventListener("click", function () { ouvrir(m); });
        bas.appendChild(b);
      }
      c.appendChild(bas);
      carte.appendChild(ph); carte.appendChild(c);
      zone.appendChild(carte);
    });
  }

  // ---------- Réservation ----------
  async function ouvrir(m) {
    choisie = m; resaId = null; message("");
    $("resaResume").textContent = m.titre + " · " + dateLongue(m.debut) + " · " + euros(m.prix_cents) + " réglé sur place";
    $("resaFond").hidden = false; document.body.style.overflow = "hidden";
    var s = (await sb.auth.getSession()).data.session;
    if (!s) {
      $("lienConnexion").href = "compte.html?retour=" + encodeURIComponent("masterclass.html?mc=" + m.id);
      return etape("etapeConnexion");
    }
    var f = await sb.from("clients").select("prenom, telephone").eq("user_id", s.user.id).maybeSingle();
    var meta = s.user.user_metadata || {};
    $("rPrenom").value = (f.data && f.data.prenom) || meta.prenom || "";
    $("rTel").value = (f.data && f.data.telephone) || meta.telephone || "";
    var limite = limiteAnnulation(m.debut), dansDelai = limite.getTime() > Date.now();
    var regles = $("resaRegles"); regles.textContent = "";
    regles.appendChild(el("p", null, "Rien n'est débité aujourd'hui : vous réglez " + euros(m.prix_cents) + " sur place le jour J."));
    regles.appendChild(el("p", null, dansDelai
      ? "Annulation gratuite jusqu'au " + dateLongue(limite) + ", depuis « Mon compte »."
      : "Attention : la masterclass commence dans moins de 48 h, cette réservation ne pourra plus être annulée gratuitement."));
    regles.appendChild(el("p", null, "En cas d'absence sans annulation dans ce délai, " + euros(m.prix_cents) + " seront prélevés sur votre carte."));
    $("rConditionsTexte").textContent = "J'accepte ces conditions et j'autorise Le Millésime à prélever " + euros(m.prix_cents) + " sur ma carte si je ne viens pas sans avoir annulé au moins 48 h avant. J'ai 18 ans ou plus.";
    $("rConditions").checked = false;
    etape("etapeInfos");
  }
  function fermer() { $("resaFond").hidden = true; document.body.style.overflow = ""; if (elements) { try { elements.getElement("payment").destroy(); } catch (e) { /* */ } elements = null; } }
  $("resaFermer").addEventListener("click", fermer);
  $("resaFond").addEventListener("click", function (e) { if (e.target === $("resaFond")) fermer(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("resaFond").hidden) fermer(); });

  function chargerStripeJs() {
    if (window.Stripe) return Promise.resolve();
    return new Promise(function (ok, ko) {
      var s = document.createElement("script"); s.src = "https://js.stripe.com/v3/"; s.onload = ok; s.onerror = ko; document.head.appendChild(s);
    });
  }

  $("etapeInfos").addEventListener("submit", async function (e) {
    e.preventDefault(); message("");
    if (!$("rPrenom").value.trim()) return message(ERREURS.prenom);
    if (!/^\+?\d{9,15}$/.test($("rTel").value.replace(/[\s.\-()]/g, ""))) return message(ERREURS.telephone);
    if (!$("rConditions").checked) return message(ERREURS.conditions);
    var b = $("btnContinuer"); b.disabled = true; b.textContent = "Un instant…";
    var d = await appeler("reserver", { masterclass_id: choisie.id, conditions: true, prenom: $("rPrenom").value.trim(), telephone: $("rTel").value.trim() });
    b.disabled = false; b.textContent = "Continuer";
    if (!d.ok) return message(erreur(d));
    resaId = d.reservation_id;
    if (d.deja) { $("finTexte").textContent = "Vous êtes déjà inscrit(e) à cette masterclass. Votre billet est dans « Mon compte »."; return etape("etapeFin"); }
    try { await chargerStripeJs(); } catch (x) { return message("Le module de paiement n'a pas pu se charger. Vérifiez votre connexion et réessayez."); }
    stripe = window.Stripe(d.cle_publique, { locale: "fr" });
    elements = stripe.elements({ clientSecret: d.client_secret, appearance: { theme: "stripe", variables: { colorPrimary: "#123259", fontFamily: "Work Sans, system-ui, sans-serif", borderRadius: "2px" } } });
    var zone = $("carteStripe"); zone.textContent = "";
    elements.create("payment", { layout: "tabs" }).mount(zone);
    $("modeTest").hidden = !d.mode_test;
    etape("etapeCarte");
  });

  $("etapeCarte").addEventListener("submit", async function (e) {
    e.preventDefault(); message("");
    var b = $("btnCarte"); b.disabled = true; b.textContent = "Enregistrement…";
    var r = await stripe.confirmSetup({
      elements: elements, redirect: "if_required",
      confirmParams: { return_url: location.origin + "/masterclass.html?r=" + encodeURIComponent(resaId) }
    });
    if (r.error) { b.disabled = false; b.textContent = "Enregistrer ma carte et réserver"; return message(r.error.message || ERREURS.carte); }
    await terminer(resaId);
    b.disabled = false; b.textContent = "Enregistrer ma carte et réserver";
  });

  async function terminer(id) {
    var d = await appeler("confirmer", { reservation_id: id });
    if (!d.ok) return message(erreur(d));
    if (d.masterclass) prevenirLeBar(d);
    $("finTexte").textContent = "C'est réservé ! " + (d.prenom ? d.prenom + ", " : "") + "on vous attend " + (d.masterclass ? dateLongue(d.masterclass.debut) : "") + ". Votre billet (avec QR code) est dans « Mon compte ».";
    etape("etapeFin");
    charger();
  }

  function prevenirLeBar(d) {
    try {
      var fd = new FormData();
      fd.append("_subject", "Nouvelle réservation masterclass : " + d.masterclass.titre);
      fd.append("_template", "table");
      fd.append("Masterclass", d.masterclass.titre + " — " + dateLongue(d.masterclass.debut));
      fd.append("Prénom", d.prenom || ""); fd.append("Téléphone", d.telephone || ""); fd.append("E-mail", d.email || "");
      fetch("https://formsubmit.co/ajax/contact.nrdiffusion@gmail.com", { method: "POST", body: fd, headers: { Accept: "application/json" } }).catch(function () {});
    } catch (x) { /* facultatif */ }
  }

  // ---------- Démarrage ----------
  (async function () {
    await charger();
    var q = new URLSearchParams(location.search);
    // Retour de la validation bancaire (3D Secure)
    if (q.get("r") && q.get("setup_intent")) {
      $("resaFond").hidden = false; $("resaResume").textContent = "";
      history.replaceState(null, "", "masterclass.html");
      if (q.get("redirect_status") === "succeeded") { message("Validation de votre carte…", true); await terminer(q.get("r")); message(""); }
      else { etape(""); message(ERREURS.carte); }
      return;
    }
    // Retour après connexion : on rouvre la masterclass choisie
    if (q.get("mc")) {
      var m = liste.filter(function (x) { return x.id === q.get("mc"); })[0];
      history.replaceState(null, "", "masterclass.html");
      if (m && m.places_restantes > 0) ouvrir(m);
    }
  })();
})();
