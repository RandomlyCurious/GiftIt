// Calibration par swipe (SUIVI.md ✅) — vérifie la mécanique §4 de CLAUDE.md :
//   - insertion d'un swipe (direction gauche/droite),
//   - mise à jour du vecteur de goûts (+0.5 à droite, plancher 0 à gauche),
//   - incrément de nb_swipes + passage `calibre` au seuil de 5.
//
// Page : src/app/swipe/[procheId]/page.tsx (cartes via Edge Function
// generate-swipe-cards), logique : src/lib/swipe.ts.
//
// ⚠️ Ces tests dépendent de l'Edge Function generate-swipe-cards (embeddings) :
// ils touchent un service réel. Timeouts élargis en conséquence.

import { test, expect } from "@playwright/test";
import {
  creerClientSupabase,
  creerProcheAvecEvenement,
  attacherTags,
  supprimerProche,
  lireProche,
  seConnecter,
} from "./helpers/giftmatch";

const ATTENTE_CARTES = 45_000; // génération des cartes (LLM/embeddings) : marge.

async function nbSwipes(
  sb: Awaited<ReturnType<typeof creerClientSupabase>>["sb"],
  procheId: string,
): Promise<number> {
  const p = await lireProche<{ nb_swipes: number | null }>(
    sb,
    procheId,
    "nb_swipes",
  );
  return p.nb_swipes ?? 0;
}

test.describe("Calibration — swipe", () => {
  test("swipe à droite : crée le swipe, incrémente nb_swipes, renforce le vecteur (+0.5)", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId } = await creerProcheAvecEvenement(sb, userId);
    await attacherTags(sb, procheId, 3);

    try {
      await seConnecter(page);
      await page.goto(`/swipe/${procheId}`);

      const droite = page.getByRole("button", { name: "Ça lui plairait" });
      await expect(droite).toBeVisible({ timeout: ATTENTE_CARTES });
      await droite.click();

      // nb_swipes passe à 1 en base.
      await expect.poll(() => nbSwipes(sb, procheId)).toBe(1);

      // Un swipe "droite" a bien été enregistré.
      const { data: swipes } = await sb
        .from("swipes")
        .select("produit_id, direction")
        .eq("proche_id", procheId);
      expect(swipes).toHaveLength(1);
      expect(swipes![0].direction).toBe("droite");

      // Règle §4 : chaque tag du produit swipé à droite vaut +0.5 (proche neuf).
      const { data: tagsProduit } = await sb
        .from("produit_tags")
        .select("tag_slug")
        .eq("produit_id", swipes![0].produit_id);
      const proche = await lireProche<{ vecteur_gouts: Record<string, number> }>(
        sb,
        procheId,
        "vecteur_gouts",
      );
      for (const { tag_slug } of tagsProduit ?? []) {
        expect(proche.vecteur_gouts[tag_slug]).toBe(0.5);
      }
    } finally {
      await supprimerProche(sb, procheId);
    }
  });

  test("cas limite : swipe à gauche => vecteur planché à 0 (jamais négatif)", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId } = await creerProcheAvecEvenement(sb, userId);
    await attacherTags(sb, procheId, 3);

    try {
      await seConnecter(page);
      await page.goto(`/swipe/${procheId}`);

      const gauche = page.getByRole("button", { name: "Pas pour lui/elle" });
      await expect(gauche).toBeVisible({ timeout: ATTENTE_CARTES });
      await gauche.click();

      await expect.poll(() => nbSwipes(sb, procheId)).toBe(1);

      const { data: swipes } = await sb
        .from("swipes")
        .select("produit_id, direction")
        .eq("proche_id", procheId);
      expect(swipes![0].direction).toBe("gauche");

      // -0.3 depuis 0 => planché à 0 (et jamais de valeur négative dans le vecteur).
      const { data: tagsProduit } = await sb
        .from("produit_tags")
        .select("tag_slug")
        .eq("produit_id", swipes![0].produit_id);
      const proche = await lireProche<{ vecteur_gouts: Record<string, number> }>(
        sb,
        procheId,
        "vecteur_gouts",
      );
      for (const { tag_slug } of tagsProduit ?? []) {
        expect(proche.vecteur_gouts[tag_slug]).toBe(0);
      }
      expect(
        Object.values(proche.vecteur_gouts).every((v) => v >= 0),
      ).toBe(true);
    } finally {
      await supprimerProche(sb, procheId);
    }
  });

  test("seuil : 5 swipes => badge 'Calibré !' et calibre=true en base", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId } = await creerProcheAvecEvenement(sb, userId);
    await attacherTags(sb, procheId, 3);

    try {
      await seConnecter(page);
      await page.goto(`/swipe/${procheId}`);

      const droite = page.getByRole("button", { name: "Ça lui plairait" });
      await expect(droite).toBeVisible({ timeout: ATTENTE_CARTES });

      // 5 swipes à droite. On synchronise chaque clic avec la base pour être sûr
      // que la carte a avancé avant de cliquer la suivante.
      for (let i = 1; i <= 5; i++) {
        await expect(droite).toBeEnabled();
        await droite.click();
        await expect.poll(() => nbSwipes(sb, procheId)).toBe(i);
      }

      // UI : badge de calibration.
      await expect(page.getByText("Calibré !")).toBeVisible();

      // Base : calibre basculé à true au seuil de 5 (CLAUDE.md §4).
      const proche = await lireProche<{
        calibre: boolean | null;
        nb_swipes: number | null;
      }>(sb, procheId, "calibre, nb_swipes");
      expect(proche.nb_swipes).toBe(5);
      expect(proche.calibre).toBe(true);
    } finally {
      await supprimerProche(sb, procheId);
    }
  });
});
