(function () {
  "use strict";

  var sb = window.supabase.createClient(
    "https://tqaaffgopecaixrjcvbi.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxYWFmZmdvcGVjYWl4cmpjdmJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0NzY4MDgsImV4cCI6MjExMTA1MjgwOH0.l8TBanpiQIQnvHqRCgT-WpvmOXn5PKcmtC374TknVPQ"
  );
  var LOTS = { V: "2 verres de vin offerts", R: "10 % de réduction", P: "Pas de gain cette fois" };
  var user = null;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, texte) { var e = document.createElement(tag); if (cls) e.className = cls; if (texte != null) e.textContent = texte; return e; }
  function dateFr(d) { return d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("fr-FR") : ""; }
  function message(texte, ok) {
    var m = $("messageGlobal"); m.textContent = texte; m.className = "msg " + (ok ? "msg--ok" : "msg--ko"); m.hidden = false;
    m.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function cacherMessage() { $("messageGlobal").hidden = true; }
  function montrer(zone) {
    ["zoneAccueil", "zoneNouveauMdp", "zoneEspace"].forEach(function (z) { $(z).hidden = z !== zone; });
  }
  function telValide(t) { return /^\+?\d{9,15}$/.test(String(t).replace(/[\s.\-()]/g, "")); }
  function emailValide(e) { return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(e); }
  function traduire(err) {
    var m = String((err && err.message) || "");
    if (/Invalid login/i.test(m)) return "E-mail ou mot de passe incorrect.";
    if (/Email not confirmed/i.test(m)) return "Votre adresse e-mail n'est pas encore confirmée : cliquez sur le lien reçu par e-mail.";
    if (/already registered|already been registered/i.test(m)) return "Un compte existe déjà avec cette adresse. Connectez-vous ou utilisez « Mot de passe oublié ».";
    if (/Password should be/i.test(m)) return "Mot de passe trop court (8 caractères minimum).";
    if (/rate limit|too many/i.test(m)) return "Trop de tentatives. Patientez quelques minutes puis réessayez.";
    return "Une erreur est survenue. Réessayez dans un instant.";
  }

  // ---------- Connexion ----------
  $("formConnexion").addEventListener("submit", async function (e) {
    e.preventDefault(); cacherMessage();
    var r = await sb.auth.signInWithPassword({ email: $("cxEmail").value.trim(), password: $("cxMdp").value });
    if (r.error) return message(traduire(r.error));
    afficherEspace(r.data.user);
  });

  $("btnOubli").addEventListener("click", async function () {
    var email = $("cxEmail").value.trim();
    if (!emailValide(email)) return message("Indiquez d'abord votre adresse e-mail dans le champ « E-mail », puis cliquez à nouveau sur « Mot de passe oublié ».");
    var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/compte.html" });
    if (r.error) return message(traduire(r.error));
    message("Si un compte existe avec cette adresse, vous allez recevoir un e-mail pour choisir un nouveau mot de passe.", true);
  });

  // ---------- Inscription ----------
  $("formInscription").addEventListener("submit", async function (e) {
    e.preventDefault(); cacherMessage();
    var prenom = $("inPrenom").value.trim(), email = $("inEmail").value.trim(), tel = $("inTel").value.trim(), mdp = $("inMdp").value;
    if (!prenom) return message("Indiquez votre prénom.");
    if (!emailValide(email)) return message("Cette adresse e-mail ne semble pas valide.");
    if (!telValide(tel)) return message("Ce numéro de téléphone ne semble pas valide.");
    if (mdp.length < 8) return message("Mot de passe trop court (8 caractères minimum).");
    if (!$("inMajeur").checked) return message("Le compte est réservé aux personnes de 18 ans et plus.");
    var r = await sb.auth.signUp({
      email: email, password: mdp,
      options: { emailRedirectTo: location.origin + "/compte.html", data: { type: "client", prenom: prenom, telephone: tel, newsletter: $("inNews").checked } }
    });
    if (r.error) return message(traduire(r.error));
    if (r.data.session) { afficherEspace(r.data.user); return message("Bienvenue " + prenom + " ! Votre compte est créé.", true); }
    $("formInscription").reset();
    message("Presque fini ! Nous vous avons envoyé un e-mail à " + email + " : cliquez sur le lien pour confirmer votre adresse et activer votre compte.", true);
  });

  // ---------- Nouveau mot de passe ----------
  $("formNouveauMdp").addEventListener("submit", async function (e) {
    e.preventDefault();
    var r = await sb.auth.updateUser({ password: $("nmMdp").value });
    if (r.error) return message(traduire(r.error));
    message("Mot de passe enregistré ✓", true);
    afficherEspace(r.data.user);
  });

  // ---------- Espace connecté ----------
  async function afficherEspace(u) {
    user = u; montrer("zoneEspace");
    var r = await Promise.all([
      sb.from("clients").select("*").eq("user_id", u.id).maybeSingle(),
      sb.from("inscrits").select("lot, code, valide_jusqu, utilise_le, created_at").order("created_at", { ascending: false }),
      sb.from("demandes").select("objet, date_souhaitee, personnes, statut, created_at").order("created_at", { ascending: false }),
      sb.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()
    ]);
    var fiche = r[0].data || {};
    var prenom = fiche.prenom || (u.user_metadata && u.user_metadata.prenom) || "";
    $("bonjour").textContent = "Bonjour" + (prenom ? " " + prenom : "") + " !";
    $("prPrenom").value = prenom; $("prTel").value = fiche.telephone || ""; $("prNews").checked = !!fiche.newsletter;
    $("lienAdmin").hidden = !r[3].data;

    var g = $("mesGains"); g.textContent = "";
    var gains = r[1].data || [];
    if (!gains.length) {
      g.appendChild(el("p", "vide", "Vous n'avez pas encore tourné la roue."));
      var a = el("a", "btn btn--gold", "Tourner la roue"); a.href = "roue.html"; g.appendChild(a);
    }
    gains.forEach(function (x) {
      var d = el("div", "gain gain--" + x.lot);
      d.appendChild(el("b", null, LOTS[x.lot] || ""));
      if (x.code) d.appendChild(el("span", "code", x.code));
      var aujourdhui = new Date().toISOString().slice(0, 10);
      if (x.lot !== "P") {
        if (x.utilise_le) d.appendChild(el("span", "etiquette-statut etiquette-statut--ok", "Utilisé le " + dateFr(x.utilise_le)));
        else if (x.valide_jusqu && x.valide_jusqu < aujourdhui) d.appendChild(el("span", "etiquette-statut etiquette-statut--gris", "Expiré"));
        else d.appendChild(el("span", "etiquette-statut", "À utiliser avant le " + dateFr(x.valide_jusqu)));
      }
      g.appendChild(d);
    });

    var dm = $("mesDemandes"); dm.textContent = "";
    var demandes = r[2].data || [];
    if (!demandes.length) dm.appendChild(el("p", "vide", "Aucune demande pour l'instant."));
    demandes.forEach(function (x) {
      var d = el("div", "gain");
      d.appendChild(el("b", null, x.objet || "Demande"));
      d.appendChild(el("span", null, "Envoyée le " + dateFr(x.created_at) + (x.date_souhaitee ? " · pour le " + dateFr(x.date_souhaitee) : "") + (x.personnes ? " · " + x.personnes + " pers." : "")));
      d.appendChild(el("span", "etiquette-statut" + (x.statut === "nouvelle" ? "" : " etiquette-statut--ok"), x.statut === "nouvelle" ? "En attente de réponse" : "Traitée"));
      dm.appendChild(d);
    });
  }

  $("formProfil").addEventListener("submit", async function (e) {
    e.preventDefault();
    var tel = $("prTel").value.trim();
    if (tel && !telValide(tel)) return message("Ce numéro de téléphone ne semble pas valide.");
    var r = await sb.from("clients").update({ prenom: $("prPrenom").value.trim().slice(0, 80), telephone: tel || null, newsletter: $("prNews").checked }).eq("user_id", user.id).select().maybeSingle();
    if (r.error || !r.data) return message("Votre profil n'a pas pu être enregistré.");
    $("bonjour").textContent = "Bonjour " + r.data.prenom + " !";
    message("Profil enregistré ✓", true);
  });

  $("formMdp").addEventListener("submit", async function (e) {
    e.preventDefault();
    var r = await sb.auth.updateUser({ password: $("mdpNouveau").value });
    if (r.error) return message(traduire(r.error));
    e.target.reset(); message("Mot de passe changé ✓", true);
  });

  $("btnDeconnexion").addEventListener("click", async function () { await sb.auth.signOut(); user = null; cacherMessage(); montrer("zoneAccueil"); });

  $("btnSupprimer").addEventListener("click", async function () {
    if (!confirm("Supprimer définitivement votre compte ? Vos codes de gain déjà obtenus restent valables au comptoir.")) return;
    var r = await sb.rpc("supprimer_mon_compte");
    if (r.error) return message("La suppression n'a pas pu être faite. Écrivez-nous et nous la ferons pour vous.");
    await sb.auth.signOut(); montrer("zoneAccueil"); message("Votre compte a été supprimé.", true);
  });

  // ---------- Démarrage ----------
  sb.auth.onAuthStateChange(function (evt) {
    if (evt === "PASSWORD_RECOVERY") { cacherMessage(); montrer("zoneNouveauMdp"); }
  });
  sb.auth.getSession().then(function (r) {
    var s = r.data.session;
    if (/type=recovery/.test(location.hash)) return;
    if (s) {
      afficherEspace(s.user);
      if (/type=signup|type=email/.test(location.hash)) message("Adresse confirmée ✓ Bienvenue au Millésime !", true);
    } else montrer("zoneAccueil");
  });
})();
