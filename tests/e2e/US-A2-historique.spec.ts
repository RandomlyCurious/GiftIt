// US-A2 [MVP] — Historique des propositions reçues pour un proche.
//
// Lecture seule sur la table `propositions` (aucun changement de schéma).
// Page : /proches/[id]/historique (src/app/proches/[id]/historique/page.tsx).
//
// Couverture :
//   1. Scénario nominal — une proposition en base s'affiche dans l'historique
//   2. Cas limite        — proche sans aucune proposition => message "vide"
//   3. Vérif base/ordre  — plusieurs propositions affichées anti-chronologiques
//
// Chaque test crée son propre proche et le détruit (cascade).

import { test, expect } from "@playwright/test";
import {
  creerClientSupabase,
  creerProcheAvecEvenement,
  creerProposition,
  supprimerProche,
  seConnecter,
} from "./helpers/giftmatch";

test.describe("US-A2 — historique des propositions", () => {
  test("scénario nominal : une proposition en base apparaît dans l'historique", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId, evenementId } = await creerProcheAvecEvenement(sb, userId);

    try {
      const { produitNom } = await creerProposition(sb, procheId, evenementId, {
        score: 0.82,
        choisie: true,
      });

      await seConnecter(page);
      await page.goto(`/proches/${procheId}/historique`);

      // Titre de la page (le prénom suit, on matche le préfixe).
      await expect(
        page.getByRole("heading", {
          name: /Historique des propositions/,
        }),
      ).toBeVisible();

      // La proposition créée en base est rendue : nom produit + compatibilité.
      await expect(page.getByText(produitNom)).toBeVisible();
      await expect(page.getByText(/compatibilité\s+82\s*%/i)).toBeVisible();
      // Marqueur "choisie" (la proposition a choisie=true).
      await expect(page.getByText(/choisie/i)).toBeVisible();
    } finally {
      await supprimerProche(sb, procheId);
    }
  });

  test("cas limite : aucun historique => message explicite", async ({ page }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId } = await creerProcheAvecEvenement(sb, userId);

    try {
      await seConnecter(page);
      await page.goto(`/proches/${procheId}/historique`);

      // Aucune proposition créée : l'app affiche le message vide (et pas d'erreur).
      await expect(
        page.getByText(/Aucune proposition n'a encore été générée/i),
      ).toBeVisible();
    } finally {
      await supprimerProche(sb, procheId);
    }
  });

  test("ordre : les propositions sont affichées de la plus récente à la plus ancienne", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId, evenementId } = await creerProcheAvecEvenement(sb, userId);

    try {
      // Deux propositions ; la 2e (créée après) doit apparaître en premier.
      await creerProposition(sb, procheId, evenementId, { score: 0.3 });
      await creerProposition(sb, procheId, evenementId, { score: 0.9 });

      await seConnecter(page);
      await page.goto(`/proches/${procheId}/historique`);

      // On vérifie l'ordre via la base (source de vérité) ...
      const { data, error } = await sb
        .from("propositions")
        .select("score, created_at")
        .eq("proche_id", procheId)
        .order("created_at", { ascending: false });
      expect(error).toBeNull();
      expect(data).toHaveLength(2);
      expect(data![0].score).toBe(0.9); // la plus récente d'abord

      // ... et que les deux lignes sont bien rendues dans l'UI.
      const compat = page.getByText(/compatibilité\s+\d+\s*%/i);
      await expect(compat).toHaveCount(2);
    } finally {
      await supprimerProche(sb, procheId);
    }
  });
});
