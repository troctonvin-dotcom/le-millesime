(function () {
  "use strict";

  var SUPABASE_URL = "https://tqaaffgopecaixrjcvbi.supabase.co";
  var SUPABASE_CLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxYWFmZmdvcGVjYWl4cmpjdmJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0NzY4MDgsImV4cCI6MjExMTA1MjgwOH0.l8TBanpiQIQnvHqRCgT-WpvmOXn5PKcmtC374TknVPQ";
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_CLE);

  var LOTS = { V: "2 verres", R: "−10 %", P: "Perdu" };
  var SOURCES = { "fenetre-accueil": "Fenêtre d'accueil", "page-roue": "Page du jeu", roue: "Roue" };
  var etat = { user: null, inscrits: [], demandes: [], params: null, contenu: null, brouillon: null, modifie: false };

  // ---------- Petits outils ----------
  function $(id) { return document.getElementById(id); }
  function el(tag, props) {
    var e = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === "text") e.textContent = v;
      else if (k === "class") e.className = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else if (k === "value") e.value = v;
      else if (k === "checked") e.checked = !!v;
      else e.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x != null && x !== false) e.appendChild(typeof x === "string" ? document.createTextNode(x) : x); });
      else e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return e;
  }
  function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function dateFr(d, avecHeure) {
    if (!d) return "";
    var x = new Date(d);
    return avecHeure ? x.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + x.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      : x.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function aujourdhui() { var d = new Date(); return d.toISOString().slice(0, 10); }
  function toast(msg, erreur) {
    var t = $("toast"); t.textContent = msg; t.className = "toast" + (erreur ? " erreur" : ""); t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function telAffiche(t) {
    var m = /^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(t || "");
    return m ? "0" + m[1] + " " + m[2] + " " + m[3] + " " + m[4] + " " + m[5] : (t || "");
  }
  function statutCode(i) {
    if (i.lot === "P" || !i.code) return { cle: "", texte: "—", cls: "" };
    if (i.utilise_le) return { cle: "utilise", texte: "Utilisé le " + dateFr(i.utilise_le), cls: "badge badge--ok" };
    if (i.valide_jusqu && i.valide_jusqu < aujourdhui()) return { cle: "expire", texte: "Expiré le " + dateFr(i.valide_jusqu), cls: "badge badge--expire" };
    return { cle: "actif", texte: "À utiliser avant le " + dateFr(i.valide_jusqu), cls: "badge badge--attente" };
  }
  function get(obj, chemin) { return chemin.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }
  function set(obj, chemin, v) {
    var ks = chemin.split("."), o = obj;
    for (var i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = v;
  }

  // ---------- Connexion ----------
  async function demarrer() {
    var s = (await sb.auth.getSession()).data.session;
    if (!s) return montrerConnexion();
    var ok = await verifierAdmin(s.user);
    if (!ok) { await sb.auth.signOut(); return montrerConnexion("Ce compte n'a pas accès au tableau de bord."); }
    etat.user = s.user;
    $("ecranConnexion").hidden = true; $("app").hidden = false;
    $("userEmail").textContent = s.user.email;
    $("infoCompte").textContent = "Connecté avec " + s.user.email + ".";
    await chargerTout();
    allerA(location.hash.replace("#", "") || "apercu");
  }
  async function verifierAdmin(user) {
    var r = await sb.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    return !!(r.data && !r.error);
  }
  function montrerConnexion(msg) {
    $("app").hidden = true; $("ecranConnexion").hidden = false;
    var m = $("cxMessage"); if (msg) { m.textContent = msg; m.hidden = false; } else m.hidden = true;
  }
  $("formConnexion").addEventListener("submit", async function (e) {
    e.preventDefault();
    var b = $("cxBouton"); b.disabled = true; b.textContent = "Connexion…";
    var r = await sb.auth.signInWithPassword({ email: $("cxEmail").value.trim(), password: $("cxMdp").value });
    b.disabled = false; b.textContent = "Se connecter";
    if (r.error) return montrerConnexion("E-mail ou mot de passe incorrect.");
    demarrer();
  });
  $("btnDeconnexion").addEventListener("click", async function () { await sb.auth.signOut(); location.hash = ""; location.reload(); });

  // ---------- Navigation ----------
  var TITRES = { clients: "Comptes clients", assistant: "Assistant", apercu: "Vue d'ensemble", inscrits: "Inscrits", code: "Vérifier un code", demandes: "Demandes de réservation", site: "Modifier le site", jeu: "Jeu de la roue", compte: "Mon compte" };
  function allerA(v) {
    if (!TITRES[v]) v = "apercu";
    document.querySelectorAll(".vue").forEach(function (s) { s.hidden = s.getAttribute("data-vue") !== v; });
    document.querySelectorAll(".menu__lien").forEach(function (b) { b.classList.toggle("actif", b.getAttribute("data-vue") === v); });
    $("titreVue").textContent = TITRES[v];
    $("menu").classList.remove("ouvert");
    if (location.hash !== "#" + v) history.replaceState(null, "", "#" + v);
    if (v === "code") setTimeout(function () { $("champCode").focus(); }, 50);
  }
  document.querySelectorAll(".menu__lien").forEach(function (b) { b.addEventListener("click", function () { allerA(b.getAttribute("data-vue")); }); });
  $("ouvrirMenu").addEventListener("click", function () { $("menu").classList.toggle("ouvert"); });

  // ---------- Données ----------
  async function chargerTout() {
    var r = await Promise.all([
      sb.from("inscrits").select("*").order("created_at", { ascending: false }).limit(10000),
      sb.from("demandes").select("*").order("created_at", { ascending: false }).limit(2000),
      sb.from("parametres").select("*").eq("id", 1).single(),
      chargerContenu(),
      sb.from("clients").select("*").order("created_at", { ascending: false }).limit(10000)
    ]);
    etat.clients = (r[4] && r[4].data) || [];
    if (r[0].error || r[1].error) toast("Impossible de charger toutes les données. Rechargez la page.", true);
    etat.inscrits = r[0].data || [];
    etat.demandes = r[1].data || [];
    etat.params = r[2].data || null;
    afficherApercu(); afficherInscrits(); afficherDemandes(); afficherJeu(); afficherClients();
    if (etat.contenu) { etat.brouillon = JSON.parse(JSON.stringify(etat.contenu)); construireEditeur(); }
  }
  async function chargerContenu() {
    try {
      var rep = await fetch("/api/page?p=contenu", { cache: "no-store" });
      if (rep.ok) { etat.contenu = await rep.json(); return; }
    } catch (e) { /* hors ligne */ }
    var r = await sb.from("contenu").select("data").eq("id", "site").maybeSingle();
    etat.contenu = r.data ? r.data.data : null;
  }

  // ---------- Vue d'ensemble ----------
  function afficherApercu() {
    var I = etat.inscrits, D = etat.demandes;
    var il7j = Date.now() - 7 * 86400000;
    var semaine = I.filter(function (i) { return new Date(i.created_at).getTime() >= il7j; }).length;
    var v = I.filter(function (i) { return i.lot === "V"; }), rr = I.filter(function (i) { return i.lot === "R"; });
    var gagnants = v.concat(rr), utilises = gagnants.filter(function (i) { return i.utilise_le; }).length;
    var actifs = gagnants.filter(function (i) { return statutCode(i).cle === "actif"; }).length;
    var nouvelles = D.filter(function (d) { return d.statut === "nouvelle"; }).length;

    var stats = vider($("stats"));
    [
      { l: "Inscrits", v: I.length, d: "+" + semaine + " ces 7 derniers jours", c: "" },
      { l: "Gains « 2 verres »", v: v.length, d: v.filter(function (i) { return i.utilise_le; }).length + " déjà servis", c: "stat--vin" },
      { l: "Gains « −10 % »", v: rr.length, d: rr.filter(function (i) { return i.utilise_le; }).length + " déjà utilisés", c: "" },
      { l: "Codes en attente", v: actifs, d: utilises + " utilisés sur " + gagnants.length + " gagnés", c: "stat--marine" },
      { l: "Comptes clients", v: (etat.clients || []).length, d: (etat.clients || []).filter(function (c) { return c.newsletter; }).length + " inscrits à la newsletter", c: "stat--marine" },
      { l: "Demandes à traiter", v: nouvelles, d: D.length + " demandes au total", c: "stat--vert" }
    ].forEach(function (s) {
      stats.appendChild(el("div", { class: "stat " + s.c }, el("div", { class: "stat__label", text: s.l }), el("div", { class: "stat__valeur", text: String(s.v) }), el("div", { class: "stat__detail", text: s.d })));
    });

    // Graphique : inscriptions par jour sur 30 jours
    var jours = [], comptes = {};
    for (var k = 29; k >= 0; k--) { var d = new Date(Date.now() - k * 86400000); var cle = d.toISOString().slice(0, 10); jours.push(cle); comptes[cle] = 0; }
    I.forEach(function (i) { var c = String(i.created_at).slice(0, 10); if (c in comptes) comptes[c]++; });
    var max = Math.max(1, Math.max.apply(null, jours.map(function (j) { return comptes[j]; })));
    var W = 600, H = 200, pad = 24, bw = (W - pad * 2) / 30;
    var svg = '<svg viewBox="0 0 ' + W + " " + (H + 28) + '" role="img" aria-label="Inscriptions par jour sur 30 jours">';
    [0, 0.5, 1].forEach(function (f) { var y = pad + (H - pad) * (1 - f); svg += '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + y + '" y2="' + y + '" stroke="#EEE6D6"/><text x="' + (pad - 6) + '" y="' + (y + 4) + '" font-size="11" text-anchor="end" fill="#4A5872">' + Math.round(max * f) + "</text>"; });
    jours.forEach(function (j, idx) {
      var n = comptes[j], h = (H - pad) * n / max, x = pad + idx * bw + 2, y = H - h;
      svg += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw - 4).toFixed(1) + '" height="' + Math.max(h, n ? 2 : 0).toFixed(1) + '" rx="3" fill="' + (idx === 29 ? "#B3854A" : "#1C4377") + '"><title>' + j.split("-").reverse().join("/") + " : " + n + " inscrit" + (n > 1 ? "s" : "") + "</title></rect>";
      if (idx % 5 === 4 || idx === 29) svg += '<text x="' + (x + (bw - 4) / 2).toFixed(1) + '" y="' + (H + 18) + '" font-size="11" text-anchor="middle" fill="#4A5872">' + j.slice(8, 10) + "/" + j.slice(5, 7) + "</text>";
    });
    svg += "</svg>";
    $("graphique").innerHTML = svg;

    // Répartition des résultats
    var rep = vider($("repartition"));
    if (!I.length) rep.appendChild(el("p", { class: "vide", text: "Aucune participation pour l'instant." }));
    else {
      var box = el("div", { class: "barres-h" });
      [["V", "#7A2335"], ["R", "#B3854A"], ["P", "#1C4377"]].forEach(function (x) {
        var n = I.filter(function (i) { return i.lot === x[0]; }).length, pct = Math.round(n * 100 / I.length);
        var plein = el("div", { class: "barre-h__plein", style: "width:0;background:" + x[1] });
        box.appendChild(el("div", {}, el("div", { class: "barre-h__haut" }, el("span", { text: LOTS[x[0]] }), el("b", { text: n + " (" + pct + " %)" })), el("div", { class: "barre-h__fond" }, plein)));
        requestAnimationFrame(function () { plein.style.width = pct + "%"; });
      });
      var parSource = {};
      I.forEach(function (i) { parSource[i.source] = (parSource[i.source] || 0) + 1; });
      box.appendChild(el("p", { class: "muted", text: "Provenance : " + Object.keys(parSource).map(function (s) { return (SOURCES[s] || s) + " " + parSource[s]; }).join(" · ") }));
      rep.appendChild(box);
    }

    var li = vider($("derniersInscrits"));
    if (!I.length) li.appendChild(el("p", { class: "vide", text: "Aucun inscrit pour l'instant." }));
    else li.appendChild(el("div", { class: "mini-liste" }, I.slice(0, 6).map(function (i) {
      return el("div", { class: "mini-liste__ligne" }, el("span", {}, el("b", { text: i.prenom }), " · " + dateFr(i.created_at, true)), el("span", { class: "badge badge--" + i.lot, text: LOTS[i.lot] }));
    })));
    var ld = vider($("dernieresDemandes"));
    if (!D.length) ld.appendChild(el("p", { class: "vide", text: "Aucune demande pour l'instant." }));
    else ld.appendChild(el("div", { class: "mini-liste" }, D.slice(0, 6).map(function (d) {
      return el("div", { class: "mini-liste__ligne" }, el("span", {}, el("b", { text: d.nom }), " · " + (d.objet || "Demande")), el("span", { class: d.statut === "nouvelle" ? "badge badge--nouvelle" : "badge badge--ok", text: d.statut === "nouvelle" ? "À traiter" : (d.statut === "traitee" ? "Traitée" : "Archivée") }));
    })));
    var p = $("pastilleDemandes"); p.hidden = !nouvelles; p.textContent = String(nouvelles);
  }

  // ---------- Inscrits ----------
  function inscritsFiltres() {
    var q = $("rechInscrits").value.trim().toLowerCase(), lot = $("filtreLot").value, st = $("filtreStatut").value;
    return etat.inscrits.filter(function (i) {
      if (lot && i.lot !== lot) return false;
      if (st && statutCode(i).cle !== st) return false;
      if (!q) return true;
      return [i.prenom, i.email, i.telephone, telAffiche(i.telephone), i.code].join(" ").toLowerCase().indexOf(q) >= 0;
    });
  }
  function afficherInscrits() {
    var L = inscritsFiltres(), t = vider($("tableInscrits"));
    $("compteInscrits").textContent = L.length + " inscrit" + (L.length > 1 ? "s" : "") + (L.length !== etat.inscrits.length ? " sur " + etat.inscrits.length : "");
    t.appendChild(el("thead", {}, el("tr", {}, ["Date", "Prénom", "E-mail", "Téléphone", "Résultat", "Code", "Statut", ""].map(function (h, k) { return el("th", { class: k === 0 || k === 2 ? "cacher-mobile" : null, text: h }); }))));
    var tb = el("tbody");
    if (!L.length) tb.appendChild(el("tr", {}, el("td", { colspan: "8", class: "vide", text: etat.inscrits.length ? "Aucun résultat pour cette recherche." : "Aucun inscrit pour l'instant. Les participants à la roue apparaîtront ici." })));
    L.slice(0, 500).forEach(function (i) {
      var s = statutCode(i);
      tb.appendChild(el("tr", {},
        el("td", { class: "cacher-mobile", text: dateFr(i.created_at, true) }),
        el("td", {}, el("b", { text: i.prenom })),
        el("td", { class: "cacher-mobile" }, el("a", { href: "mailto:" + i.email, text: i.email })),
        el("td", {}, el("a", { href: "tel:" + i.telephone, text: telAffiche(i.telephone) })),
        el("td", {}, el("span", { class: "badge badge--" + i.lot, text: LOTS[i.lot] })),
        el("td", { class: "mono", text: i.code || "—" }),
        el("td", {}, s.cls ? el("span", { class: s.cls, text: s.texte }) : "—"),
        el("td", { class: "actions" },
          s.cle === "actif" ? el("button", { class: "bouton bouton--petit", text: "Marquer utilisé", onclick: function () { marquerUtilise(i); } }) : null,
          " ",
          el("button", { class: "bouton bouton--petit bouton--danger", title: "Supprimer cet inscrit", text: "Supprimer", onclick: function () { supprimerInscrit(i); } })
        )
      ));
    });
    t.appendChild(tb);
    if (L.length > 500) t.appendChild(el("caption", { class: "muted", text: "Seuls les 500 premiers sont affichés : affinez la recherche ou exportez la liste." }));
  }
  ["rechInscrits", "filtreLot", "filtreStatut"].forEach(function (id) { $(id).addEventListener("input", afficherInscrits); });

  async function marquerUtilise(i) {
    if (!confirm("Valider l'utilisation du code " + i.code + " (" + LOTS[i.lot] + ") pour " + i.prenom + " ?")) return;
    var r = await sb.from("inscrits").update({ utilise_le: new Date().toISOString() }).eq("id", i.id).is("utilise_le", null).select().single();
    if (r.error) return toast("Erreur : le code n'a pas pu être validé.", true);
    Object.assign(i, r.data); afficherInscrits(); afficherApercu(); toast("Code validé ✓");
  }
  async function supprimerInscrit(i) {
    if (!confirm("Supprimer définitivement " + i.prenom + " (" + i.email + ") ?\nÀ faire par exemple si la personne demande la suppression de ses données.")) return;
    var r = await sb.from("inscrits").delete().eq("id", i.id);
    if (r.error) return toast("Erreur : suppression impossible.", true);
    etat.inscrits = etat.inscrits.filter(function (x) { return x.id !== i.id; });
    afficherInscrits(); afficherApercu(); toast("Inscrit supprimé");
  }
  $("exportCsv").addEventListener("click", function () {
    var L = inscritsFiltres();
    function cel(v) {
      var s = String(v == null ? "" : v);
      if (/^[=@]/.test(s) || /^[+-][^\d]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    }
    var lignes = [["Date", "Prénom", "E-mail", "Téléphone", "Provenance", "Résultat", "Code", "Valable jusqu'au", "Utilisé le"].map(cel).join(";")];
    L.forEach(function (i) {
      lignes.push([dateFr(i.created_at, true), i.prenom, i.email, telAffiche(i.telephone), SOURCES[i.source] || i.source, LOTS[i.lot], i.code || "", i.valide_jusqu ? dateFr(i.valide_jusqu) : "", i.utilise_le ? dateFr(i.utilise_le) : ""].map(cel).join(";"));
    });
    var blob = new Blob(["﻿" + lignes.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = el("a", { href: URL.createObjectURL(blob), download: "inscrits-le-millesime-" + aujourdhui() + ".csv" });
    document.body.appendChild(a); a.click(); a.remove();
    toast(L.length + " inscrit" + (L.length > 1 ? "s" : "") + " exporté" + (L.length > 1 ? "s" : ""));
  });

  // ---------- Vérifier un code ----------
  $("formCode").addEventListener("submit", async function (e) {
    e.preventDefault();
    var code = $("champCode").value.trim().toUpperCase().replace(/\s+/g, "");
    var zone = vider($("resultatCode"));
    if (!code) return;
    var r = await sb.from("inscrits").select("*").eq("code", code).maybeSingle();
    if (r.error) return toast("Erreur de vérification.", true);
    if (!r.data) return zone.appendChild(el("div", { class: "fiche-code fiche-code--ko" }, el("h3", { text: "Code introuvable" }), el("p", { text: "Vérifiez l'orthographe (O et 0, I et 1 ne sont jamais utilisés)." })));
    var i = r.data, s = statutCode(i), ok = s.cle === "actif";
    var fiche = el("div", { class: "fiche-code " + (ok ? "fiche-code--ok" : "fiche-code--ko") },
      el("h3", { text: ok ? "Code valable ✓" : (s.cle === "utilise" ? "Code déjà utilisé" : "Code expiré") }),
      el("p", {}, el("b", { text: i.prenom }), " · " + telAffiche(i.telephone) + " · " + i.email),
      el("p", {}, el("span", { class: "badge badge--" + i.lot, text: LOTS[i.lot] }), " ", el("span", { class: s.cls, text: s.texte })),
      ok ? el("button", { class: "bouton bouton--or", text: "Valider l'utilisation maintenant", onclick: async function () {
        var u = await sb.from("inscrits").update({ utilise_le: new Date().toISOString() }).eq("id", i.id).is("utilise_le", null).select().single();
        if (u.error) return toast("Erreur : validation impossible.", true);
        var loc = etat.inscrits.find(function (x) { return x.id === i.id; }); if (loc) Object.assign(loc, u.data);
        afficherInscrits(); afficherApercu(); toast("Code validé ✓");
        $("champCode").value = ""; vider(zone).appendChild(el("div", { class: "fiche-code fiche-code--ok" }, el("h3", { text: "C'est validé ✓" }), el("p", { text: LOTS[i.lot] + " pour " + i.prenom + ". Bonne dégustation !" })));
      } }) : null
    );
    zone.appendChild(fiche);
  });

  // ---------- Demandes ----------
  function afficherDemandes() {
    var f = $("filtreDemandes").value;
    var L = etat.demandes.filter(function (d) { return !f ? true : (f === "ouvertes" ? d.statut === "nouvelle" : d.statut === f); });
    var box = vider($("listeDemandes"));
    if (!L.length) return box.appendChild(el("div", { class: "panneau vide", text: f === "ouvertes" ? "Aucune demande à traiter. 🎉" : "Aucune demande ici." }));
    L.forEach(function (d) {
      var sujet = "Le Millésime — votre demande" + (d.date_souhaitee ? " du " + dateFr(d.date_souhaitee) : "");
      box.appendChild(el("article", { class: "demande" + (d.statut === "nouvelle" ? " demande--nouvelle" : "") },
        el("div", { class: "demande__haut" }, el("h3", { text: d.nom }), el("span", { class: "badge " + (d.statut === "nouvelle" ? "badge--nouvelle" : "badge--ok"), text: d.statut === "nouvelle" ? "À traiter" : (d.statut === "traitee" ? "Traitée" : "Archivée") }), el("span", { class: "muted", text: "reçue le " + dateFr(d.created_at, true) })),
        el("div", { class: "demande__meta" },
          el("span", { text: "Objet : " + (d.objet || "—") }),
          d.date_souhaitee ? el("span", { text: "Date souhaitée : " + dateFr(d.date_souhaitee) }) : null,
          d.personnes ? el("span", { text: d.personnes + " personne" + (d.personnes > 1 ? "s" : "") }) : null,
          el("span", { text: d.email }), d.telephone ? el("span", { text: d.telephone }) : null),
        d.message ? el("p", { class: "demande__message", text: d.message }) : null,
        el("div", { class: "demande__actions" },
          el("a", { class: "bouton bouton--petit bouton--or", href: "mailto:" + d.email + "?subject=" + encodeURIComponent(sujet), text: "Répondre par e-mail" }),
          d.telephone ? el("a", { class: "bouton bouton--petit", href: "tel:" + d.telephone, text: "Appeler" }) : null,
          d.statut !== "traitee" ? el("button", { class: "bouton bouton--petit", text: "Marquer traitée", onclick: function () { statutDemande(d, "traitee"); } }) : null,
          d.statut === "traitee" ? el("button", { class: "bouton bouton--petit", text: "Remettre à traiter", onclick: function () { statutDemande(d, "nouvelle"); } }) : null,
          d.statut !== "archivee" ? el("button", { class: "bouton bouton--petit", text: "Archiver", onclick: function () { statutDemande(d, "archivee"); } }) : null,
          el("button", { class: "bouton bouton--petit bouton--danger", text: "Supprimer", onclick: function () { supprimerDemande(d); } })
        )
      ));
    });
  }
  $("filtreDemandes").addEventListener("change", afficherDemandes);
  async function statutDemande(d, s) {
    var r = await sb.from("demandes").update({ statut: s }).eq("id", d.id);
    if (r.error) return toast("Erreur : mise à jour impossible.", true);
    d.statut = s; afficherDemandes(); afficherApercu(); toast("Demande mise à jour");
  }
  async function supprimerDemande(d) {
    if (!confirm("Supprimer définitivement la demande de " + d.nom + " ?")) return;
    var r = await sb.from("demandes").delete().eq("id", d.id);
    if (r.error) return toast("Erreur : suppression impossible.", true);
    etat.demandes = etat.demandes.filter(function (x) { return x.id !== d.id; }); afficherDemandes(); afficherApercu(); toast("Demande supprimée");
  }

  // ---------- Jeu ----------
  function afficherJeu() {
    var p = etat.params, box = vider($("reglagesJeu"));
    if (!p) return box.appendChild(el("p", { class: "vide", text: "Réglages indisponibles." }));
    function interrupteur(cle, titre, aide) {
      return el("div", { class: "reglage" }, el("div", {}, el("b", { text: titre }), el("p", { class: "muted", text: aide })),
        el("label", { class: "interrupteur" }, el("input", { type: "checkbox", checked: p[cle], onchange: function (e) { majParam(cle, e.target.checked); } })));
    }
    box.appendChild(interrupteur("jeu_actif", "Jeu ouvert", "Coupé : plus personne ne peut tourner la roue (la page affiche « jeu terminé »)."));
    box.appendChild(interrupteur("popup_actif", "Fenêtre automatique sur la page d'accueil", "La roue s'ouvre 1 seconde après l'arrivée sur le site."));
    box.appendChild(el("div", { class: "reglage" }, el("div", {}, el("b", { text: "Durée de validité des codes" }), el("p", { class: "muted", text: "Nombre de jours pour venir utiliser son gain." })),
      el("input", { type: "number", min: "1", max: "365", value: p.validite_jours, style: "width:110px", onchange: function (e) { var n = parseInt(e.target.value, 10); if (n >= 1 && n <= 365) majParam("validite_jours", n); } })));
    box.appendChild(el("div", { class: "reglage" }, el("div", {}, el("b", { text: "Chances de gagner" }), el("p", { class: "muted", text: "2 verres : " + p.chance_verres + " % · −10 % : " + p.chance_reduction + " % · Perdu : " + (100 - p.chance_verres - p.chance_reduction) + " %. Fixées pour correspondre aux cases de la roue et au règlement." }))));
  }
  async function majParam(cle, v) {
    var maj = {}; maj[cle] = v; maj.updated_at = new Date().toISOString();
    var r = await sb.from("parametres").update(maj).eq("id", 1).select().single();
    if (r.error) { toast("Erreur : réglage non enregistré.", true); return afficherJeu(); }
    etat.params = r.data; toast("Réglage enregistré ✓ (visible sur le site d'ici 1 minute)");
  }

  // ---------- Mon compte ----------
  $("formMdp").addEventListener("submit", async function (e) {
    e.preventDefault();
    var m = $("mdpMessage"), a = $("nouveauMdp").value, b = $("nouveauMdp2").value;
    m.hidden = false; m.className = "message";
    if (a.length < 10) { m.textContent = "10 caractères minimum."; return; }
    if (a !== b) { m.textContent = "Les deux mots de passe ne sont pas identiques."; return; }
    var r = await sb.auth.updateUser({ password: a });
    if (r.error) { m.textContent = "Erreur : " + r.error.message; return; }
    m.className = "message ok"; m.textContent = "Mot de passe changé ✓"; e.target.reset();
  });

  // ---------- Éditeur du site ----------
  var T = { texte: "texte", long: "long", photo: "photo", liste: "liste", etiquettes: "etiquettes", horaires: "horaires", interrupteur: "interrupteur", galerie: "galerie" };
  var SCHEMA = [
    { titre: "Coordonnées & horaires", sous: "Téléphone, adresse, horaires, Instagram, note Google", champs: [
      { k: "infos.telephone", l: "Téléphone", t: T.texte },
      { k: "infos.email", l: "E-mail affiché sur le site", t: T.texte },
      { k: "infos.adresse", l: "Adresse", t: T.texte },
      { k: "infos.code_postal", l: "Code postal", t: T.texte },
      { k: "infos.ville", l: "Ville", t: T.texte },
      { k: "infos.instagram", l: "Compte Instagram", a: "Sans le @, par exemple : le_millesime_sens", t: T.texte },
      { k: "infos.note_google", l: "Note Google", a: "Par exemple : 4,7", t: T.texte },
      { k: "infos.nombre_avis", l: "Nombre d'avis Google", t: T.texte },
      { k: "infos.horaires", l: "Horaires d'ouverture", a: "Une fermeture après minuit s'écrit simplement 01:00.", t: T.horaires }
    ] },
    { titre: "Bandeau d'annonce", sous: "Un message en haut du site : soirée, fermeture exceptionnelle…", champs: [
      { k: "annonce.actif", l: "Afficher le bandeau", t: T.interrupteur },
      { k: "annonce.texte", l: "Message", a: "Exemple : Soirée dégustation vendredi 12 décembre dès 19h — sur réservation", t: T.texte },
      { k: "annonce.lien", l: "Lien au clic (facultatif)", a: "Exemple : contact.html pour envoyer vers la réservation", t: T.texte }
    ] },
    { titre: "Haut de la page d'accueil", sous: "Le premier écran du site", champs: [
      { k: "accueil.surtitre", l: "Petite ligne au-dessus du titre", t: T.texte },
      { k: "accueil.titre", l: "Grand titre", t: T.texte },
      { k: "accueil.accroche", l: "Phrase d'accroche", t: T.long },
      { k: "accueil.slogan", l: "Slogan", t: T.texte },
      { k: "accueil.photo", alt: "accueil.photo_alt", l: "Photo", t: T.photo }
    ] },
    { titre: "Notre histoire", champs: [
      { k: "histoire.titre", l: "Titre", t: T.texte },
      { k: "histoire.texte", l: "Texte", a: "Laissez une ligne vide pour commencer un nouveau paragraphe.", t: T.long },
      { k: "histoire.photo", alt: "histoire.photo_alt", l: "Photo", t: T.photo }
    ] },
    { titre: "Ce qu'on propose", sous: "Les 3 cartes : cave, bar, épicerie", champs: [
      { k: "offre.titre", l: "Titre de la section", t: T.texte },
      { k: "offre.intro", l: "Introduction", t: T.long },
      { k: "offre.cartes", l: "Les 3 cartes", t: T.liste, fixe: true, nomItem: "Carte", item: [
        { k: "titre", l: "Titre", t: T.texte }, { k: "texte", l: "Texte", t: T.long }, { k: "photo", alt: "photo_alt", l: "Photo", t: T.photo }] }
    ] },
    { titre: "Avis clients", sous: "Les avis affichés dans le carrousel", champs: [
      { k: "avis.titre", l: "Titre de la section", t: T.texte },
      { k: "avis.liste", l: "Avis", t: T.liste, nomItem: "Avis", nouveau: { nom: "", date: "", texte: "" }, item: [
        { k: "nom", l: "Nom du client", t: T.texte }, { k: "date", l: "Date (ex. : mars 2026)", t: T.texte }, { k: "texte", l: "Avis", t: T.long }] }
    ] },
    { titre: "Privatisation & événements", champs: [
      { k: "evenements.titre", l: "Titre", t: T.texte },
      { k: "evenements.texte", l: "Texte", t: T.long },
      { k: "evenements.etiquettes", l: "Types d'événements", a: "Tapez un mot puis Entrée pour l'ajouter.", t: T.etiquettes },
      { k: "evenements.photo", alt: "evenements.photo_alt", l: "Photo", t: T.photo }
    ] },
    { titre: "Espace Négoce (professionnels)", champs: [
      { k: "negoce.titre", l: "Titre", t: T.texte },
      { k: "negoce.texte", l: "Texte principal", t: T.long },
      { k: "negoce.etiquettes", l: "Points forts", a: "Tapez puis Entrée pour ajouter.", t: T.etiquettes },
      { k: "negoce.texte2", l: "Texte complémentaire", t: T.long },
      { k: "negoce.photo", alt: "negoce.photo_alt", l: "Photo", t: T.photo }
    ] },
    { titre: "Questions fréquentes", sous: "Très utile pour Google et ChatGPT", champs: [
      { k: "faq", l: "Questions", t: T.liste, nomItem: "Question", nouveau: { question: "", reponse: "" }, item: [
        { k: "question", l: "Question", t: T.texte }, { k: "reponse", l: "Réponse", t: T.long }] }
    ] },
    { titre: "Galerie photos", sous: "Ajouter, retirer ou réordonner les photos", champs: [
      { k: "galerie.intro", l: "Texte d'introduction", t: T.long },
      { k: "galerie.photos", l: "Photos", a: "Les 4 premières apparaissent aussi sur la page d'accueil.", t: T.galerie }
    ] },
    { titre: "Page Réservation & Contact", champs: [
      { k: "contact.titre", l: "Titre", t: T.texte },
      { k: "contact.intro", l: "Introduction", t: T.long }
    ] }
  ];

  function marquerModifie() {
    etat.modifie = true;
    $("barreEnregistrer").classList.add("modifie");
    $("etatEnregistrement").textContent = "Modifications non enregistrées";
    $("btnEnregistrer").disabled = false;
  }
  window.addEventListener("beforeunload", function (e) { if (etat.modifie) { e.preventDefault(); e.returnValue = ""; } });

  function construireEditeur() {
    var box = vider($("editeur"));
    SCHEMA.forEach(function (bloc, n) {
      var corps = el("div", { class: "bloc-edit__corps" });
      bloc.champs.forEach(function (c) { corps.appendChild(champ(etat.brouillon, c)); });
      box.appendChild(el("details", { class: "bloc-edit", open: n === 0 ? true : null }, el("summary", {}, bloc.titre, bloc.sous ? el("span", { class: "sous", text: bloc.sous }) : null), corps));
    });
  }

  function champ(obj, c) {
    var v = get(obj, c.k);
    var aide = c.a ? el("span", { class: "champ-aide", text: c.a }) : null;
    if (c.t === T.texte || c.t === T.long) {
      var input = c.t === T.texte ? el("input", { type: "text", value: v || "" }) : el("textarea", { rows: "5" });
      if (c.t === T.long) input.value = v || "";
      input.addEventListener("input", function () { set(obj, c.k, input.value); marquerModifie(); });
      return el("label", { class: c.t === T.texte ? "court" : null }, c.l, aide, input);
    }
    if (c.t === T.interrupteur) {
      return el("label", { class: "interrupteur" }, el("input", { type: "checkbox", checked: !!v, onchange: function (e) { set(obj, c.k, e.target.checked); marquerModifie(); } }), c.l);
    }
    if (c.t === T.photo) return champPhoto(obj, c);
    if (c.t === T.etiquettes) return champEtiquettes(obj, c, aide);
    if (c.t === T.horaires) return champHoraires(obj, c, aide);
    if (c.t === T.liste) return champListe(obj, c, aide);
    if (c.t === T.galerie) return champGalerie(obj, c, aide);
    return el("div");
  }

  function apercuPhoto(src) {
    if (!src) return "";
    return /^https?:\/\//.test(src) ? src : "/" + src.replace(/^\//, "");
  }
  async function televerser(fichier) {
    var blob = await redimensionner(fichier, 2000, 0.85);
    var nom = "site/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg";
    var r = await sb.storage.from("photos").upload(nom, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (r.error) throw r.error;
    return sb.storage.from("photos").getPublicUrl(nom).data.publicUrl;
  }
  function redimensionner(fichier, max, qualite) {
    return new Promise(function (ok, ko) {
      var img = new Image(), url = URL.createObjectURL(fichier);
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement("canvas"); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { b ? ok(b) : ko(new Error("conversion")); }, "image/jpeg", qualite);
      };
      img.onerror = function () { ko(new Error("image illisible")); };
      img.src = url;
    });
  }
  function choisirFichier(multiple, rappel) {
    var f = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/heic", multiple: multiple ? true : null, style: "display:none" });
    f.addEventListener("change", function () { rappel(Array.prototype.slice.call(f.files)); f.remove(); });
    document.body.appendChild(f); f.click();
  }

  function champPhoto(obj, c) {
    var img = el("img", { src: apercuPhoto(get(obj, c.k)), alt: "" });
    var alt = el("input", { type: "text", value: get(obj, c.alt) || "" });
    alt.addEventListener("input", function () { set(obj, c.alt, alt.value); marquerModifie(); });
    var bouton = el("button", { type: "button", class: "bouton bouton--petit", text: "Changer la photo", onclick: function () {
      choisirFichier(false, async function (fs) {
        if (!fs.length) return;
        bouton.disabled = true; bouton.textContent = "Envoi en cours…";
        try { var url = await televerser(fs[0]); set(obj, c.k, url); img.src = url; marquerModifie(); toast("Photo prête — pensez à enregistrer"); }
        catch (e) { toast("La photo n'a pas pu être envoyée (format JPG ou PNG, 8 Mo maximum).", true); }
        bouton.disabled = false; bouton.textContent = "Changer la photo";
      });
    } });
    return el("div", {}, el("div", { style: "font-weight:500;font-size:.9rem;margin-bottom:.35rem" }, c.l),
      el("div", { class: "photo-champ" }, img, el("div", {}, el("label", {}, "Description de la photo", el("span", { class: "champ-aide", text: "Ce que montre la photo, en une phrase (utile pour Google)." }), alt), el("div", { class: "btns" }, bouton))));
  }

  function champEtiquettes(obj, c, aide) {
    var zone = el("div", { class: "etiquettes" });
    var input = el("input", { type: "text", placeholder: "Ajouter…" });
    function rendre() {
      vider(zone);
      (get(obj, c.k) || []).forEach(function (t, idx) {
        zone.appendChild(el("span", { class: "etiquette" }, t, el("button", { type: "button", "aria-label": "Retirer " + t, text: "×", onclick: function () { var l = get(obj, c.k).slice(); l.splice(idx, 1); set(obj, c.k, l); marquerModifie(); rendre(); } })));
      });
    }
    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      var t = input.value.trim(); if (!t) return;
      set(obj, c.k, (get(obj, c.k) || []).concat([t])); input.value = ""; marquerModifie(); rendre();
    });
    rendre();
    return el("div", { style: "display:grid;gap:.4rem" }, el("span", { style: "font-weight:500;font-size:.9rem", text: c.l }), aide, zone, input);
  }

  function champHoraires(obj, c, aide) {
    var box = el("div", { class: "horaires" });
    (get(obj, c.k) || []).forEach(function (j) {
      var ouv = el("input", { type: "time", value: j.ouverture || "", disabled: !j.ouvert });
      var fer = el("input", { type: "time", value: j.fermeture || "", disabled: !j.ouvert });
      ouv.addEventListener("input", function () { j.ouverture = ouv.value; marquerModifie(); });
      fer.addEventListener("input", function () { j.fermeture = fer.value; marquerModifie(); });
      var inter = el("label", { class: "interrupteur" }, el("input", { type: "checkbox", checked: j.ouvert, onchange: function (e) {
        j.ouvert = e.target.checked; ouv.disabled = fer.disabled = !j.ouvert;
        if (j.ouvert && !j.ouverture) { j.ouverture = ouv.value = "11:00"; j.fermeture = fer.value = "22:00"; }
        marquerModifie();
      } }), "Ouvert");
      box.appendChild(el("div", { class: "horaires__ligne" }, el("b", { text: j.jour }), inter, el("label", {}, "Ouverture", ouv), el("label", {}, "Fermeture", fer)));
    });
    return el("div", { style: "display:grid;gap:.4rem" }, el("span", { style: "font-weight:500;font-size:.9rem", text: c.l }), aide, box);
  }

  function champListe(obj, c, aide) {
    var box = el("div", { class: "liste-items" });
    function rendre() {
      vider(box);
      var L = get(obj, c.k) || [];
      L.forEach(function (item, idx) {
        var haut = el("div", { class: "item-edit__haut" }, el("span", { text: c.nomItem + " " + (idx + 1) }),
          !c.fixe ? el("button", { type: "button", class: "bouton bouton--petit", title: "Monter", text: "↑", disabled: idx === 0, onclick: function () { deplacer(idx, -1); } }) : null,
          !c.fixe ? el("button", { type: "button", class: "bouton bouton--petit", title: "Descendre", text: "↓", disabled: idx === L.length - 1, onclick: function () { deplacer(idx, 1); } }) : null,
          !c.fixe ? el("button", { type: "button", class: "bouton bouton--petit bouton--danger", text: "Supprimer", onclick: function () { if (confirm("Supprimer cet élément ?")) { L.splice(idx, 1); marquerModifie(); rendre(); } } }) : null);
        var carte = el("div", { class: "item-edit" }, haut);
        c.item.forEach(function (sc) { carte.appendChild(champ(item, sc)); });
        box.appendChild(carte);
      });
      if (!c.fixe) box.appendChild(el("button", { type: "button", class: "bouton", text: "+ Ajouter : " + c.nomItem.toLowerCase(), onclick: function () {
        var l = get(obj, c.k) || []; l.push(JSON.parse(JSON.stringify(c.nouveau))); set(obj, c.k, l); marquerModifie(); rendre();
      } }));
    }
    function deplacer(idx, d) { var L = get(obj, c.k); var x = L.splice(idx, 1)[0]; L.splice(idx + d, 0, x); marquerModifie(); rendre(); }
    rendre();
    return el("div", { style: "display:grid;gap:.5rem" }, el("span", { style: "font-weight:500;font-size:.9rem", text: c.l }), aide, box);
  }

  function champGalerie(obj, c, aide) {
    var grille = el("div", { class: "galerie-edit" });
    var ajout = el("button", { type: "button", class: "bouton bouton--or", text: "+ Ajouter des photos" });
    function rendre() {
      vider(grille);
      var L = get(obj, c.k) || [];
      L.forEach(function (p, idx) {
        var alt = el("textarea", { placeholder: "Description de la photo" }); alt.value = p.alt || "";
        alt.addEventListener("input", function () { p.alt = alt.value; marquerModifie(); });
        var fmt = el("select", {}, [["normale", "Taille normale"], ["large", "Large"], ["haute", "Haute"]].map(function (o) { return el("option", { value: o[0], selected: p.format === o[0] ? true : null, text: o[1] }); }));
        fmt.addEventListener("change", function () { p.format = fmt.value; marquerModifie(); });
        grille.appendChild(el("div", { class: "galerie-edit__item" }, el("img", { src: apercuPhoto(p.src), alt: "", loading: "lazy" }),
          el("div", { class: "corps" }, alt, fmt, el("div", { class: "btns" },
            el("button", { type: "button", class: "bouton bouton--petit", text: "←", title: "Avancer", disabled: idx === 0, onclick: function () { bouger(idx, -1); } }),
            el("button", { type: "button", class: "bouton bouton--petit", text: "→", title: "Reculer", disabled: idx === L.length - 1, onclick: function () { bouger(idx, 1); } }),
            el("button", { type: "button", class: "bouton bouton--petit bouton--danger", text: "Retirer", onclick: function () { if (confirm("Retirer cette photo de la galerie ?")) { L.splice(idx, 1); marquerModifie(); rendre(); } } })))));
      });
    }
    function bouger(idx, d) { var L = get(obj, c.k); var x = L.splice(idx, 1)[0]; L.splice(idx + d, 0, x); marquerModifie(); rendre(); }
    ajout.addEventListener("click", function () {
      choisirFichier(true, async function (fs) {
        if (!fs.length) return;
        ajout.disabled = true;
        var L = get(obj, c.k) || [];
        for (var k = 0; k < fs.length; k++) {
          ajout.textContent = "Envoi " + (k + 1) + " / " + fs.length + "…";
          try { var url = await televerser(fs[k]); L.push({ src: url, alt: "", format: "normale" }); }
          catch (e) { toast("Une photo n'a pas pu être envoyée.", true); }
        }
        set(obj, c.k, L); marquerModifie(); rendre();
        ajout.disabled = false; ajout.textContent = "+ Ajouter des photos";
        toast("Photos ajoutées — ajoutez une description puis enregistrez");
      });
    });
    rendre();
    return el("div", { style: "display:grid;gap:.6rem" }, el("span", { style: "font-weight:500;font-size:.9rem", text: c.l }), aide, ajout, grille);
  }

  $("btnEnregistrer").addEventListener("click", async function () {
    var b = $("btnEnregistrer"); b.disabled = true; b.textContent = "Enregistrement…";
    var r = await sb.from("contenu").upsert({ id: "site", data: etat.brouillon, updated_at: new Date().toISOString(), updated_by: etat.user.id });
    b.textContent = "Enregistrer";
    if (r.error) { b.disabled = false; return toast("Erreur : les modifications n'ont pas été enregistrées.", true); }
    etat.modifie = false; etat.contenu = JSON.parse(JSON.stringify(etat.brouillon));
    $("barreEnregistrer").classList.remove("modifie");
    $("etatEnregistrement").textContent = "Enregistré à " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + " · visible sur le site d'ici 1 minute";
    toast("Enregistré ✓ Le site sera à jour d'ici 1 minute.");
  });

  // ---------- Comptes clients ----------
  function clientsFiltres() {
    var q = $("rechClients").value.trim().toLowerCase(), n = $("filtreNews").value;
    return (etat.clients || []).filter(function (c) {
      if (n === "oui" && !c.newsletter) return false;
      return !q || [c.prenom, c.telephone, telAffiche(c.telephone)].join(" ").toLowerCase().indexOf(q) >= 0;
    });
  }
  function afficherClients() {
    var L = clientsFiltres(), t = vider($("tableClients"));
    $("compteClients").textContent = L.length + " compte" + (L.length > 1 ? "s" : "") + " · l'e-mail de chaque client est visible dans l'export";
    t.appendChild(el("thead", {}, el("tr", {}, ["Créé le", "Prénom", "Téléphone", "Newsletter"].map(function (x) { return el("th", { text: x }); }))));
    var tb = el("tbody");
    if (!L.length) tb.appendChild(el("tr", {}, el("td", { colspan: "4", class: "vide", text: "Aucun compte client pour l'instant. Les clients créent leur compte depuis « Mon compte » sur le site." })));
    L.slice(0, 500).forEach(function (c) {
      tb.appendChild(el("tr", {}, el("td", { text: dateFr(c.created_at, true) }), el("td", {}, el("b", { text: c.prenom || "—" })),
        el("td", {}, c.telephone ? el("a", { href: "tel:" + c.telephone, text: telAffiche(c.telephone) }) : "—"),
        el("td", {}, el("span", { class: c.newsletter ? "badge badge--ok" : "badge badge--expire", text: c.newsletter ? "Oui" : "Non" }))));
    });
    t.appendChild(tb);
  }
  ["rechClients", "filtreNews"].forEach(function (id) { $(id).addEventListener("input", afficherClients); });
  $("exportClients").addEventListener("click", async function () {
    var r = await sb.rpc("export_clients");
    if (r.error) return toast("Export impossible.", true);
    var n = $("filtreNews").value, L = (r.data || []).filter(function (c) { return n !== "oui" || c.newsletter; });
    function cel(v) { var s = String(v == null ? "" : v); if (/^[=@]/.test(s) || /^[+-][^\d]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
    var lignes = [["Créé le", "Prénom", "E-mail", "Téléphone", "Newsletter"].map(cel).join(";")];
    L.forEach(function (c) { lignes.push([dateFr(c.created_at, true), c.prenom, c.email, telAffiche(c.telephone), c.newsletter ? "Oui" : "Non"].map(cel).join(";")); });
    var blob = new Blob(["\ufeff" + lignes.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = el("a", { href: URL.createObjectURL(blob), download: "comptes-clients-le-millesime-" + aujourdhui() + ".csv" });
    document.body.appendChild(a); a.click(); a.remove();
    toast(L.length + " compte" + (L.length > 1 ? "s" : "") + " exporté" + (L.length > 1 ? "s" : ""));
  });

  // ---------- Assistant (Claude) ----------
  var chat = { messages: [] };
  var SUGGESTIONS = ["Combien d'inscrits cette semaine ?", "Ajoute un bandeau : soirée dégustation vendredi à 19h", "Change le téléphone affiché", "Ajoute une question sur les cartes cadeaux", "Résume les demandes à traiter"];
  function bulle(role, texte, extra) {
    var b = el("div", { class: "bulle " + (role === "user" ? "bulle--moi" : "bulle--ia") }, role === "user" ? null : el("span", { class: "auteur", text: "Assistant" }), texte, extra || null);
    $("chatFil").appendChild(b); $("chatFil").scrollTop = $("chatFil").scrollHeight; return b;
  }
  function resumeTableau() {
    var I = etat.inscrits, D = etat.demandes, il7j = Date.now() - 7 * 86400000;
    var lignes = [
      "Date du jour : " + new Date().toLocaleDateString("fr-FR"),
      "Inscrits au total : " + I.length + " (dont " + I.filter(function (i) { return new Date(i.created_at).getTime() >= il7j; }).length + " ces 7 derniers jours)",
      "Gains 2 verres : " + I.filter(function (i) { return i.lot === "V"; }).length + ", gains -10 % : " + I.filter(function (i) { return i.lot === "R"; }).length,
      "Codes utilisés : " + I.filter(function (i) { return i.utilise_le; }).length + ", codes en attente : " + I.filter(function (i) { return statutCode(i).cle === "actif"; }).length,
      "Jeu ouvert : " + (etat.params && etat.params.jeu_actif ? "oui" : "non") + ", fenêtre d'accueil : " + (etat.params && etat.params.popup_actif ? "oui" : "non"),
      "Demandes à traiter : " + D.filter(function (d) { return d.statut === "nouvelle"; }).length + " sur " + D.length
    ];
    D.filter(function (d) { return d.statut === "nouvelle"; }).slice(0, 15).forEach(function (d) {
      lignes.push("- Demande de " + d.nom + " le " + dateFr(d.created_at) + " : " + (d.objet || "") + (d.date_souhaitee ? ", pour le " + dateFr(d.date_souhaitee) : "") + (d.personnes ? ", " + d.personnes + " pers." : "") + (d.message ? " — " + String(d.message).slice(0, 200) : ""));
    });
    return lignes.join("\n");
  }
  function afficherPropositions(b, modifs) {
    var zone = el("div", { class: "propositions" });
    modifs.forEach(function (m) { zone.appendChild(el("div", { class: "proposition" }, m.description, el("small", { text: m.chemin }))); });
    var appliquer = el("button", { type: "button", class: "bouton bouton--or bouton--petit", text: "Appliquer et publier" });
    var ignorer = el("button", { type: "button", class: "bouton bouton--petit", text: "Ignorer" });
    appliquer.addEventListener("click", async function () {
      try { modifs.forEach(function (m) { set(etat.brouillon, m.chemin, JSON.parse(m.valeur_json)); }); }
      catch (e) { return toast("Modification illisible, rien n'a été changé.", true); }
      appliquer.disabled = ignorer.disabled = true; appliquer.textContent = "Publication…";
      var r = await sb.from("contenu").upsert({ id: "site", data: etat.brouillon, updated_at: new Date().toISOString(), updated_by: etat.user.id });
      if (r.error) { appliquer.disabled = ignorer.disabled = false; appliquer.textContent = "Appliquer et publier"; return toast("Erreur : modifications non enregistrées.", true); }
      etat.contenu = JSON.parse(JSON.stringify(etat.brouillon)); etat.modifie = false;
      $("barreEnregistrer").classList.remove("modifie"); $("etatEnregistrement").textContent = "Enregistré par l'assistant";
      construireEditeur();
      appliquer.textContent = "Publié ✓"; toast("Publié ✓ Visible sur le site d'ici 1 minute.");
    });
    ignorer.addEventListener("click", function () { zone.remove(); });
    zone.appendChild(el("div", { class: "btns" }, appliquer, ignorer));
    b.appendChild(zone);
  }
  async function envoyerChat(texte) {
    texte = texte.trim(); if (!texte) return;
    if (etat.modifie) return toast("Enregistrez d'abord vos modifications en cours dans « Modifier le site ».", true);
    $("chatSuggestions").hidden = true;
    chat.messages.push({ role: "user", texte: texte }); bulle("user", texte);
    $("chatTexte").value = ""; $("chatEnvoyer").disabled = true;
    var attente = bulle("assistant", "", el("span", { class: "points" }, el("i"), el("i"), el("i")));
    try {
      var s = (await sb.auth.getSession()).data.session;
      var rep = await fetch(SUPABASE_URL + "/functions/v1/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_CLE, "Authorization": "Bearer " + (s ? s.access_token : "") },
        body: JSON.stringify({ messages: chat.messages, contenu: etat.brouillon, resume: resumeTableau() })
      });
      var d = await rep.json().catch(function () { return {}; });
      attente.remove();
      if (!rep.ok || d.erreur) {
        var msg = { cle_manquante: "L'assistant n'est pas encore activé : il manque la clé API Anthropic dans les réglages Supabase.", cle_invalide: "La clé API Anthropic n'est pas valide.", occupe: "L'assistant est très sollicité, réessayez dans une minute.", connexion: "Votre session a expiré : reconnectez-vous.", acces: "Ce compte n'a pas accès à l'assistant." }[d.erreur] || "L'assistant n'a pas pu répondre. Réessayez.";
        chat.messages.pop(); bulle("assistant", msg).classList.add("bulle--erreur");
      } else {
        chat.messages.push({ role: "assistant", texte: d.reponse });
        var b = bulle("assistant", d.reponse);
        if (d.modifications && d.modifications.length) afficherPropositions(b, d.modifications);
      }
    } catch (e) {
      attente.remove(); chat.messages.pop(); bulle("assistant", "Connexion impossible. Vérifiez internet et réessayez.").classList.add("bulle--erreur");
    }
    $("chatEnvoyer").disabled = false; $("chatTexte").focus();
  }
  (function initChat() {
    bulle("assistant", "Bonjour ! Je peux modifier les textes, horaires, avis, questions fréquentes ou le bandeau d'annonce du site, et répondre à vos questions sur les inscrits et les demandes. Que voulez-vous faire ?");
    var sug = $("chatSuggestions");
    SUGGESTIONS.forEach(function (t) { sug.appendChild(el("button", { type: "button", text: t, onclick: function () { envoyerChat(t); } })); });
    $("chatForm").addEventListener("submit", function (e) { e.preventDefault(); envoyerChat($("chatTexte").value); });
    $("chatTexte").addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyerChat($("chatTexte").value); } });
  })();

  demarrer();
})();
