// Panel de propositions (SUIVI.md ✅) — génération live d'idées cadeaux pour un
// proche + événement, puis marquage "choisi".
//
// Page : src/app/proches/[id]/propositions/page.tsx. Le moteur v2 (generate-panel)
// est tenté en premier, avec REPLI sur le matching tags. On rattache des tags au
// proche pour garantir qu'au moins le repli produit des propositions.
//
// ⚠️ Dépend d'Edge Functions réelles (generate-panel / matching, LLM) :
// timeouts élargis.
//
// Couverture :
//   1. Nominal    — le panel génère ≥1 carte
//   2. Choisir    — clic "Marquer comme choisi" => ligne propositions (choisie=true) en base
//   3. Cas limite — sans paramètre `evenement` => message d'erreur explicite

import { test, expect } from "@playwright/test";
import {
  creerClientSupabase,
  creerProcheAvecEvenement,
  attacherTags,
  supprimerProche,
  seConnecter,
} from "./helpers/giftmatch";

const ATTENTE_PANEL = 60_000; // generate-panel (gpt-4o) + repli : marge confortable.

test.describe("Propositions — panel & choix", () => {
  test("nominal : le panel génère au moins une proposition", async ({ page }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId, evenementId } = await creerProcheAvecEvenement(sb, userId);
    await attacherTags(sb, procheId, 3);

    try {
      await seConnecter(page);
      await page.goto(`/proches/${procheId}/propositions?evenement=${evenementId}`);

      // Au moins une carte avec son badge de compatibilité.
      await expect(
        page.getByText(/Compatibilité\s+\d+\s*%/).first(),
      ).toBeVisible({ timeout: ATTENTE_PANEL });
      // Et au moins un bouton d'action de choix.
      await expect(
        page.getByRole("button", { name: "Marquer comme choisi" }).first(),
      ).toBeVisible();
    } finally {
      await supprimerProche(sb, procheId);
    }
  });

  test("choisir : 'Marquer comme choisi' enregistre une proposition choisie en base", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId, evenementId } = await creerProcheAvecEvenement(sb, userId);
    await attacherTags(sb, procheId, 3);

    try {
      await seConnecter(page);
      await page.goto(`/proches/${procheId}/propositions?evenement=${evenementId}`);

      const choisir = page
        .getByRole("button", { name: "Marquer comme choisi" })
        .first();
      await expect(choisir).toBeVisible({ timeout: ATTENTE_PANEL });
      await choisir.click();

      // Retour visuel : la carte passe à l'état "Choisi".
      await expect(page.getByText("Choisi").first()).toBeVisible();

      // Base : une proposition choisie=true existe pour ce proche/événement.
      await expect
        .poll(async () => {
          const { count } = await sb
            .from("propositions")
            .select("id", { count: "exact", head: true })
            .eq("proche_id", procheId)
            .eq("evenement_id", evenementId)
            .eq("choisie", true);
          return count ?? 0;
        })
        .toBeGreaterThanOrEqual(1);
    } finally {
      await supprimerProche(sb, procheId);
    }
  });

  test("cas limite : page propositions sans événement => message d'erreur", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId } = await creerProcheAvecEvenement(sb, userId);

    try {
      await seConnecter(page);
      // Pas de ?evenement=... : l'app doit signaler l'absence de cible.
      await page.goto(`/proches/${procheId}/propositions`);
      await expect(
        page.getByText("Aucun événement sélectionné."),
      ).toBeVisible();
    } finally {
      await supprimerProche(sb, procheId);
    }
  });
});
