// Helpers partagés pour les tests e2e GiftMatch.
//
// IMPORTANT : ce module ne contient AUCUN état partagé entre tests.
// Il n'expose que des fonctions pures + des fabriques de données. Chaque test
// crée ses propres fixtures (un proche dédié) et les détruit en fin de test,
// pour rester totalement indépendant des autres (cf. règles QA).

import { type Page, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Fichier de session partagé, produit par le projet `setup` et réutilisé par
// les projets de test (storageState). Voir playwright.config.ts.
export const FICHIER_AUTH = "tests/e2e/.auth/user.json";

// --- Variables d'environnement -------------------------------------------

function requireEnv(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) {
    throw new Error(
      `Variable d'environnement manquante : ${nom}. ` +
        `Renseignez NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ` +
        `TEST_USER_EMAIL et TEST_USER_PASSWORD avant de lancer les tests.`,
    );
  }
  return valeur;
}

export const ENV = {
  get supabaseUrl() {
    return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get serviceRoleKey() {
    return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  },
  get testUserEmail() {
    return requireEnv("TEST_USER_EMAIL");
  },
  get testUserPassword() {
    return requireEnv("TEST_USER_PASSWORD");
  },
};

// --- Client Supabase pour le setup & la vérification en base -------------

// On utilise la SERVICE ROLE pour préparer/lire les données de test : aucun
// sign-in (le endpoint d'auth est rate-limité), insertions/lectures fiables.
// La RLS « réelle » reste exercée côté navigateur, qui agit sous la session de
// l'utilisateur de test. Le user_id des fixtures = l'id du compte de test, donc
// le navigateur (même utilisateur) voit bien ces données.
let _userId: string | null = null;

export async function creerClientSupabase(): Promise<{
  sb: SupabaseClient;
  userId: string;
}> {
  const sb = createClient(ENV.supabaseUrl, ENV.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Résout l'id du compte de test une seule fois par worker (via l'API admin,
  // non soumise au rate-limit du sign-in par mot de passe).
  if (!_userId) {
    const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
    if (error) {
      throw new Error(`Lecture des utilisateurs (admin) échouée : ${error.message}`);
    }
    const cible = ENV.testUserEmail.toLowerCase();
    const user = data.users.find((u) => u.email?.toLowerCase() === cible);
    if (!user) {
      throw new Error(
        `Compte de test introuvable (${ENV.testUserEmail}). Créez-le dans Supabase Auth.`,
      );
    }
    _userId = user.id;
  }

  return { sb, userId: _userId };
}

// --- Connexion via l'interface (parcours utilisateur réel) ---------------

// Garantit une session active sur la page.
// - Si le contexte est déjà authentifié (storageState réutilisé), /dashboard
//   reste accessible : on ne refait PAS de login (évite le rate-limit auth).
// - Sinon, connexion par le formulaire UI (sélecteurs alignés sur
//   src/app/auth/login/page.tsx). C'est le chemin emprunté par le projet `setup`
//   et par auth.spec.ts (contexte volontairement non authentifié).
export async function seConnecter(page: Page): Promise<void> {
  await page.goto("/dashboard");
  if (new URL(page.url()).pathname.startsWith("/dashboard")) {
    return; // déjà connecté via storageState
  }
  await page.goto("/auth/login");
  await page.locator("#email").fill(ENV.testUserEmail);
  await page.locator("#motDePasse").fill(ENV.testUserPassword);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
}

// --- Fixtures (création / destruction de données de test) ----------------

export type FixtureProche = {
  procheId: string;
  evenementId: string;
};

// Crée un proche dédié au test + un événement (anniversaire) attaché.
// `frequence` laissée à undefined => valeur par défaut SQL ('j30_j14_j7').
// Passez `frequence: null` pour tester l'affichage du défaut côté UI.
export async function creerProcheAvecEvenement(
  sb: SupabaseClient,
  userId: string,
  options: { frequence?: string | null } = {},
): Promise<FixtureProche> {
  const { data: proche, error: errProche } = await sb
    .from("proches")
    .insert({
      user_id: userId,
      prenom: `QA-${Date.now()}`,
      date_naissance: "1990-06-15",
      relation: "ami",
    })
    .select("id")
    .single();
  if (errProche || !proche) {
    throw new Error(`Création proche échouée : ${errProche?.message}`);
  }

  const evenement: Record<string, unknown> = {
    proche_id: proche.id,
    type: "anniversaire",
  };
  if (options.frequence !== undefined) {
    evenement.frequence = options.frequence;
  }

  const { data: ev, error: errEv } = await sb
    .from("evenements")
    .insert(evenement)
    .select("id")
    .single();
  if (errEv || !ev) {
    await sb.from("proches").delete().eq("id", proche.id);
    throw new Error(`Création événement échouée : ${errEv?.message}`);
  }

  return { procheId: proche.id, evenementId: ev.id };
}

// Rattache `nb` centres d'intérêt (tags de référence) au proche. Donne au
// moteur de matching tags de quoi produire des propositions, même sans swipe
// ni profil sémantique (cf. CLAUDE.md §4 : avant calibration, on matche sur les
// tags manuels). Retourne les slugs effectivement rattachés.
export async function attacherTags(
  sb: SupabaseClient,
  procheId: string,
  nb = 3,
): Promise<string[]> {
  const { data: tags, error } = await sb
    .from("tags")
    .select("slug")
    .limit(nb);
  if (error || !tags || tags.length === 0) {
    throw new Error(`Aucun tag de référence disponible : ${error?.message}`);
  }
  const slugs = tags.map((t) => t.slug);
  const { error: errLien } = await sb
    .from("proche_tags")
    .insert(slugs.map((slug) => ({ proche_id: procheId, tag_slug: slug, poids: 1.0 })));
  if (errLien) {
    throw new Error(`Rattachement des tags échoué : ${errLien.message}`);
  }
  return slugs;
}

// Lit une seule colonne d'un proche (helper de vérification en base).
export async function lireProche<T = Record<string, unknown>>(
  sb: SupabaseClient,
  procheId: string,
  colonnes: string,
): Promise<T> {
  const { data, error } = await sb
    .from("proches")
    .select(colonnes)
    .eq("id", procheId)
    .single();
  if (error || !data) {
    throw new Error(`Lecture proche échouée : ${error?.message}`);
  }
  return data as T;
}

// Crée une proposition (cadeau proposé) pour un proche + événement donnés.
// Réutilise un produit existant du catalogue (lecture publique) pour ne pas
// polluer la table produits. Sert aux US-A2 / A3 / A4.
export async function creerProposition(
  sb: SupabaseClient,
  procheId: string,
  evenementId: string,
  champs: {
    score?: number;
    choisie?: boolean;
    offert?: boolean;
    retour_satisfaction?: 1 | 2 | 3 | null;
  } = {},
): Promise<{ propositionId: string; produitNom: string }> {
  const { data: produit, error: errProduit } = await sb
    .from("produits")
    .select("id, nom")
    .eq("actif", true)
    .limit(1)
    .single();
  if (errProduit || !produit) {
    throw new Error(
      `Aucun produit actif dans le catalogue : ${errProduit?.message}`,
    );
  }

  const { data: prop, error } = await sb
    .from("propositions")
    .insert({
      proche_id: procheId,
      evenement_id: evenementId,
      produit_id: produit.id,
      score: champs.score ?? 0.5,
      choisie: champs.choisie ?? false,
      offert: champs.offert ?? false,
      retour_satisfaction: champs.retour_satisfaction ?? null,
    })
    .select("id")
    .single();
  if (error || !prop) {
    throw new Error(`Création proposition échouée : ${error?.message}`);
  }

  return { propositionId: prop.id, produitNom: produit.nom };
}

// Supprime le proche de test (cascade : événements, propositions, swipes...).
// À appeler dans un finally pour garantir l'absence de résidu même si le test
// échoue. Idempotent.
export async function supprimerProche(
  sb: SupabaseClient,
  procheId: string,
): Promise<void> {
  await sb.from("proches").delete().eq("id", procheId);
}

// Petit garde-fou réutilisable : un select de fréquence doit afficher ✓ après
// sauvegarde (état "saved" du composant FrequenceEvenement).
export async function attendreSauvegarde(page: Page): Promise<void> {
  await expect(page.getByText("✓")).toBeVisible();
}
