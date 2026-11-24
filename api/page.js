// Sert les pages du site à partir du contenu enregistré dans la base (tableau de bord).
// Si la base ne répond pas, le site s'affiche avec le contenu par défaut : il ne tombe jamais.
const DEFAUT = require("../lib/contenu-defaut.js");
const R = require("../lib/rendu.js");
const { SUPABASE_URL, SUPABASE_CLE } = require("../lib/config.js");

function fusion(base, ajout) {
  if (Array.isArray(base) || Array.isArray(ajout)) return ajout !== undefined ? ajout : base;
  if (base && typeof base === "object") {
    const r = { ...base };
    if (ajout && typeof ajout === "object") for (const k of Object.keys(ajout)) r[k] = fusion(base[k], ajout[k]);
    return r;
  }
  return ajout !== undefined && ajout !== null ? ajout : base;
}

async function lire(chemin) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
      headers: { apikey: SUPABASE_CLE, Authorization: `Bearer ${SUPABASE_CLE}` },
      signal: ctrl.signal
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

module.exports = async (req, res) => {
  const p = String((req.query && req.query.p) || "accueil");
  const [lignes, params] = await Promise.all([
    lire("contenu?id=eq.site&select=data"),
    lire("parametres?id=eq.1&select=jeu_actif,popup_actif")
  ]);
  const c = fusion(DEFAUT, lignes && lignes[0] ? lignes[0].data : {});
  const pr = params && params[0] ? params[0] : { jeu_actif: true, popup_actif: true };
  const options = { popup: pr.jeu_actif && pr.popup_actif };

  let corps, type = "text/html; charset=utf-8";
  if (p === "contenu") {
    // Contenu complet (base + valeurs par défaut) pour le tableau de bord
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(JSON.stringify(c));
  }
  if (p === "galerie") corps = R.pageGalerie(c, options);
  else if (p === "contact") corps = R.pageContact(c, options);
  else if (p === "llms") { corps = R.llms(c); type = "text/plain; charset=utf-8"; }
  else corps = R.pageAccueil(c, options);

  res.setHeader("Content-Type", type);
  // Mise en cache 30 s : une modification du tableau de bord apparaît sur le site en moins d'une minute.
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=30, stale-while-revalidate=86400");
  res.status(200).send(corps);
};
