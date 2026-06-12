// Helpers partagés pour les tests e2e GiftMatch.
//
// IMPORTANT : ce module ne contient AUCUN état partagé entre tests.
// Il n'expose que des fonctions pures + des fabriques de données. Chaque test
// crée ses propres fixtures (un proche dédié) et les détruit en fin de test,
// pour rester totalement indépendant des autres (cf. règles QA).

import { type Page, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  get testUserEmail() {
    return requireEnv("TEST_USER_EMAIL");
  },
  get testUserPassword() {
    return requireEnv("TEST_USER_PASSWORD");
  },
};

// --- Client Supabase authentifié (vérification en base) ------------------

// Crée un client supabase-js connecté avec le compte de test. La RLS s'applique
// donc exactement comme pour l'utilisateur réel : on ne vérifie que ses données.
export async function creerClientSupabase(): Promise<{
  sb: SupabaseClient;
  userId: string;
}> {
  const sb = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({
    email: ENV.testUserEmail,
    password: ENV.testUserPassword,
  });
  if (error || !data.user) {
    throw new Error(
      `Connexion Supabase échouée pour ${ENV.testUserEmail} : ${error?.message}`,
    );
  }
  return { sb, userId: data.user.id };
}

// --- Connexion via l'interface (parcours utilisateur réel) ---------------

// Connecte l'utilisateur de test par le formulaire UI et attend l'arrivée sur
// le dashboard. Sélecteurs alignés sur src/app/auth/login/page.tsx.
export async function seConnecter(page: Page): Promise<void> {
  await page.goto("/auth/login");
  await page.locator("#email").fill(ENV.testUserEmail);
  await page.locator("#motDePasse").fill(ENV.testUserPassword);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL("**/dashboard");
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
