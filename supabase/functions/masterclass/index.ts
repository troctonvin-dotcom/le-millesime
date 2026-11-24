import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// Masterclass du Millesime : empreinte bancaire a la reservation, paiement sur place,
// prelevement du prix complet pour les absents qui n'ont pas annule 48 h avant.
// Les montants sont TOUJOURS lus en base ici, jamais recus du navigateur.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const DELAI_ANNULATION_MS = 48 * 3600 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_PUBLIC = Deno.env.get("STRIPE_PUBLISHABLE_KEY") ?? "";

class ErreurStripe extends Error {
  code: string;
  constructor(e: Record<string, unknown>) {
    super(String(e?.message ?? "Erreur Stripe"));
    this.code = String(e?.decline_code ?? e?.code ?? "stripe");
  }
}

async function stripe(chemin: string, params?: Record<string, string>, idempotence?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${STRIPE_SECRET}` };
  if (params) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotence) headers["Idempotency-Key"] = idempotence;
  const rep = await fetch(`https://api.stripe.com/v1/${chemin}`, {
    method: params ? "POST" : "GET",
    headers,
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const d = await rep.json();
  if (!rep.ok) throw new ErreurStripe(d?.error ?? {});
  return d;
}

function normaliserTel(t: string): string | null {
  const brut = t.replace(/[\s.\-()]/g, "");
  if (!/^\+?\d{9,15}$/.test(brut)) return null;
  if (/^0\d{9}$/.test(brut)) return "+33" + brut.slice(1);
  if (/^33\d{9}$/.test(brut)) return "+" + brut;
  return brut.startsWith("+") ? brut : "+" + brut;
}

function euros(c: number) {
  return (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, erreur: "methode" }, 405);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ ok: false, erreur: "format" }, 400); }
  const action = String(b.action ?? "");

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(jwt);
  const user = u?.user;
  if (!user) return json({ ok: false, erreur: "connexion" }, 401);

  const paiementActif = /^sk_(test|live)_/.test(STRIPE_SECRET) && /^pk_(test|live)_/.test(STRIPE_PUBLIC)
    && STRIPE_SECRET.slice(3, 7) === STRIPE_PUBLIC.slice(3, 7);
  const modeTest = STRIPE_SECRET.startsWith("sk_test_");

  const { data: adm } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  const estAdmin = !!adm;

  try {
    // ================= Actions du client =================
    if (action === "reserver") {
      if (!paiementActif) return json({ ok: false, erreur: "paiement_inactif" }, 503);
      if (!user.email_confirmed_at) return json({ ok: false, erreur: "email_non_confirme" }, 403);
      if (b.conditions !== true) return json({ ok: false, erreur: "conditions" }, 400);
      const mcId = String(b.masterclass_id ?? "");

      const { data: fiche } = await db.from("clients").select("prenom, telephone").eq("user_id", user.id).maybeSingle();
      const prenom = String(b.prenom ?? fiche?.prenom ?? user.user_metadata?.prenom ?? "").trim().slice(0, 80);
      const tel = normaliserTel(String(b.telephone ?? fiche?.telephone ?? user.user_metadata?.telephone ?? ""));
      if (!prenom) return json({ ok: false, erreur: "prenom" }, 400);
      if (!tel) return json({ ok: false, erreur: "telephone" }, 400);

      const { data: resa, error } = await db.rpc("reserver_place", {
        p_mc: mcId, p_user: user.id, p_email: user.email, p_prenom: prenom, p_tel: tel,
      });
      if (error) {
        const m = String(error.message);
        if (/complet/.test(m)) return json({ ok: false, erreur: "complet" }, 409);
        if (/passee/.test(m)) return json({ ok: false, erreur: "passee" }, 409);
        if (/introuvable|invalid input/.test(m)) return json({ ok: false, erreur: "introuvable" }, 404);
        throw error;
      }
      if (resa.statut !== "carte_en_attente") return json({ ok: true, deja: true, reservation_id: resa.id });

      const { data: mc } = await db.from("masterclasses").select("titre, debut, prix_cents").eq("id", mcId).single();

      // Client Stripe : on reutilise celui d'une reservation precedente
      let customer = resa.stripe_customer as string | null;
      if (!customer) {
        const { data: prec } = await db.from("reservations_mc").select("stripe_customer")
          .eq("user_id", user.id).not("stripe_customer", "is", null).limit(1).maybeSingle();
        customer = prec?.stripe_customer ?? null;
      }
      if (!customer) {
        const c = await stripe("customers", {
          email: user.email!, name: prenom, phone: tel, "metadata[user_id]": user.id,
        });
        customer = c.id;
      }

      // SetupIntent : enregistre la carte pour un eventuel prelevement ulterieur, sans rien debiter
      let si: Record<string, unknown> | null = null;
      if (resa.stripe_setup_intent) {
        si = await stripe(`setup_intents/${resa.stripe_setup_intent}`);
        if (si.status === "succeeded") {
          await confirmerResa(db, resa.id, si);
          return json({ ok: true, deja: true, reservation_id: resa.id });
        }
        if (si.status === "canceled") si = null;
      }
      if (!si) {
        si = await stripe("setup_intents", {
          customer: customer!,
          usage: "off_session",
          "payment_method_types[]": "card",
          description: `Empreinte masterclass « ${mc.titre} » du ${new Date(mc.debut).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} (${euros(mc.prix_cents)} en cas d'absence)`,
          "metadata[reservation_id]": resa.id,
          "metadata[masterclass_id]": mcId,
        });
      }
      await db.from("reservations_mc").update({ stripe_customer: customer, stripe_setup_intent: si.id }).eq("id", resa.id);
      return json({
        ok: true, reservation_id: resa.id, client_secret: si.client_secret, cle_publique: STRIPE_PUBLIC,
        prix_cents: mc.prix_cents, mode_test: modeTest,
      });
    }

    if (action === "confirmer") {
      const { data: resa } = await db.from("reservations_mc").select("*").eq("id", String(b.reservation_id ?? "")).maybeSingle();
      if (!resa || resa.user_id !== user.id) return json({ ok: false, erreur: "introuvable" }, 404);
      if (resa.statut !== "carte_en_attente") return json({ ok: true, statut: resa.statut });
      if (!resa.stripe_setup_intent) return json({ ok: false, erreur: "carte" }, 400);
      const si = await stripe(`setup_intents/${resa.stripe_setup_intent}`);
      if (si.status !== "succeeded" || si.metadata?.reservation_id !== resa.id) return json({ ok: false, erreur: "carte" }, 402);
      const { data: mc } = await db.from("masterclasses").select("titre, debut, prix_cents").eq("id", resa.masterclass_id).single();
      await confirmerResa(db, resa.id, si);
      return json({ ok: true, statut: "confirmee", masterclass: mc, prenom: resa.prenom, telephone: resa.telephone, email: resa.email });
    }

    if (action === "annuler") {
      const { data: resa } = await db.from("reservations_mc").select("*").eq("id", String(b.reservation_id ?? "")).maybeSingle();
      if (!resa || resa.user_id !== user.id) return json({ ok: false, erreur: "introuvable" }, 404);
      if (!["confirmee", "carte_en_attente"].includes(resa.statut)) return json({ ok: false, erreur: "statut" }, 409);
      const { data: mc } = await db.from("masterclasses").select("debut").eq("id", resa.masterclass_id).single();
      if (resa.statut === "confirmee" && new Date(mc.debut).getTime() - Date.now() < DELAI_ANNULATION_MS) {
        return json({ ok: false, erreur: "trop_tard" }, 409);
      }
      const { data: maj } = await db.from("reservations_mc").update({ statut: "annulee", annulee_le: new Date().toISOString() })
        .eq("id", resa.id).in("statut", ["confirmee", "carte_en_attente"]).select("id").maybeSingle();
      if (!maj) return json({ ok: false, erreur: "statut" }, 409);
      if (resa.stripe_payment_method && paiementActif) {
        try { await stripe(`payment_methods/${resa.stripe_payment_method}/detach`, {}); } catch { /* deja detachee */ }
      }
      return json({ ok: true });
    }

    // ================= Actions de l'administrateur =================
    if (["etat", "pointer", "excuser", "debiter_absents"].includes(action) && !estAdmin) {
      return json({ ok: false, erreur: "acces" }, 403);
    }

    if (action === "etat") return json({ ok: true, paiement: paiementActif, mode_test: modeTest });

    if (action === "pointer") {
      const present = b.present !== false;
      let q = db.from("reservations_mc").select("*");
      q = b.jeton ? q.eq("jeton", String(b.jeton)) : q.eq("id", String(b.reservation_id ?? ""));
      const { data: resa } = await q.maybeSingle();
      if (!resa) return json({ ok: false, erreur: "introuvable" }, 404);
      const { data: mc } = await db.from("masterclasses").select("titre, debut").eq("id", resa.masterclass_id).single();
      const avant = ["confirmee", "venu", "absent_excuse"];
      if (!avant.includes(resa.statut)) return json({ ok: false, erreur: "statut", statut: resa.statut, prenom: resa.prenom, masterclass: mc }, 409);
      const { data: maj } = await db.from("reservations_mc")
        .update({ statut: present ? "venu" : "confirmee", pointe_le: present ? new Date().toISOString() : null })
        .eq("id", resa.id).in("statut", avant).select("id, prenom, statut").maybeSingle();
      if (!maj) return json({ ok: false, erreur: "statut" }, 409);
      return json({ ok: true, reservation: maj, masterclass: mc, deja: resa.statut === "venu" && present });
    }

    if (action === "excuser") {
      const { data: maj } = await db.from("reservations_mc").update({ statut: "absent_excuse" })
        .eq("id", String(b.reservation_id ?? "")).in("statut", ["confirmee", "absent_echec"]).select("id").maybeSingle();
      if (!maj) return json({ ok: false, erreur: "statut" }, 409);
      return json({ ok: true });
    }

    if (action === "debiter_absents") {
      if (!paiementActif) return json({ ok: false, erreur: "paiement_inactif" }, 503);
      const mcId = String(b.masterclass_id ?? "");
      const { data: mc } = await db.from("masterclasses").select("*").eq("id", mcId).maybeSingle();
      if (!mc) return json({ ok: false, erreur: "introuvable" }, 404);
      if (new Date(mc.debut).getTime() > Date.now()) return json({ ok: false, erreur: "pas_commencee" }, 409);

      const { data: cibles } = await db.from("reservations_mc").select("*")
        .eq("masterclass_id", mcId).in("statut", ["confirmee", "absent_echec"]);
      const bilan = { debites: 0, echecs: 0, total_cents: 0, details: [] as unknown[] };

      for (const r of cibles ?? []) {
        // On "reserve" la ligne avant de debiter : impossible de prelever deux fois la meme personne
        const { data: pris } = await db.from("reservations_mc").update({ statut: "debit_en_cours" })
          .eq("id", r.id).eq("statut", r.statut).select("id").maybeSingle();
        if (!pris) continue;
        const cle = r.statut === "absent_echec" ? `absent-${r.id}-${Date.now()}` : `absent-${r.id}`;
        try {
          if (!r.stripe_payment_method || !r.stripe_customer) throw new ErreurStripe({ message: "Aucune carte enregistree", code: "sans_carte" });
          const pi = await stripe("payment_intents", {
            amount: String(mc.prix_cents),
            currency: "eur",
            customer: r.stripe_customer,
            payment_method: r.stripe_payment_method,
            off_session: "true",
            confirm: "true",
            description: `Absence a la masterclass « ${mc.titre} » du ${new Date(mc.debut).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`,
            "metadata[reservation_id]": r.id,
            "metadata[motif]": "absence_masterclass",
          }, cle);
          if (pi.status !== "succeeded") throw new ErreurStripe({ message: "Paiement non abouti (" + pi.status + ")", code: String(pi.status) });
          await db.from("reservations_mc").update({
            statut: "absent_debite", stripe_payment_intent: pi.id, montant_debite_cents: mc.prix_cents,
            debite_le: new Date().toISOString(), erreur: null,
          }).eq("id", r.id);
          bilan.debites++; bilan.total_cents += mc.prix_cents;
          bilan.details.push({ id: r.id, prenom: r.prenom, ok: true });
        } catch (e) {
          const err = e instanceof ErreurStripe ? e : new ErreurStripe({ message: String(e) });
          await db.from("reservations_mc").update({ statut: "absent_echec", erreur: `${err.code} : ${err.message}`.slice(0, 300) }).eq("id", r.id);
          bilan.echecs++;
          bilan.details.push({ id: r.id, prenom: r.prenom, ok: false, raison: err.code });
        }
      }
      return json({ ok: true, ...bilan });
    }

    return json({ ok: false, erreur: "action" }, 400);
  } catch (e) {
    console.error("masterclass", action, e instanceof Error ? e.message : e);
    if (e instanceof ErreurStripe) return json({ ok: false, erreur: "stripe", detail: e.code }, 502);
    return json({ ok: false, erreur: "serveur" }, 500);
  }
});

// deno-lint-ignore no-explicit-any
async function confirmerResa(db: any, id: string, si: Record<string, unknown>) {
  await db.from("reservations_mc").update({
    statut: "confirmee", stripe_payment_method: String(si.payment_method ?? ""),
  }).eq("id", id).eq("statut", "carte_en_attente");
}
