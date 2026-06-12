// US-A1 [MVP] — Choix de l'intervalle de génération des propositions.
//
// L'utilisateur règle, par événement, la fréquence des rappels avant
// l'échéance (J-30 / J-14 / J-7). Le réglage est stocké dans
// `evenements.frequence` et lu plus tard par le workflow N8n.
//
// UI : src/components/FrequenceEvenement.tsx (un <select> par événement),
//      section "Événements & rappels" de la fiche /proches/[id].
//
// Couverture :
//   1. Scénario nominal      — changer la fréquence + persistance en base
//   2. Cas limite            — double changement rapide (last-write-wins)
//   3. Valeur par défaut     — frequence NULL en base => défaut affiché en UI
//
// Chaque test crée son propre proche et le détruit : aucun état partagé.

import { test, expect } from "@playwright/test";
import {
  creerClientSupabase,
  creerProcheAvecEvenement,
  supprimerProche,
  seConnecter,
  attendreSauvegarde,
} from "./helpers/giftmatch";

test.describe("US-A1 — fréquence des rappels", () => {
  test("scénario nominal : changer la fréquence la persiste en base", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    // Fréquence par défaut au départ ('j30_j14_j7' via défaut SQL).
    const { procheId, evenementId } = await creerProcheAvecEvenement(
      sb,
      userId,
    );

    try {
      await seConnecter(page);
      await page.goto(`/proches/${procheId}`);

      // Un seul événement => un seul sélecteur de fréquence sur la page.
      const select = page.getByRole("combobox");
      await expect(select).toBeVisible();
      await expect(select).toHaveValue("j30_j14_j7");

      // L'utilisateur choisit "J-7 seulement".
      await select.selectOption("j7");
      await attendreSauvegarde(page); // ✓ affiché => mutation terminée
      await expect(select).toHaveValue("j7");

      // Vérification EN BASE (et pas seulement dans l'UI).
      const { data, error } = await sb
        .from("evenements")
        .select("frequence")
        .eq("id", evenementId)
        .single();
      expect(error).toBeNull();
      expect(data?.frequence).toBe("j7");
    } finally {
      await supprimerProche(sb, procheId);
    }
  });

  test("cas limite : deux changements rapides — la dernière valeur gagne", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId, evenementId } = await creerProcheAvecEvenement(
      sb,
      userId,
    );

    try {
      await seConnecter(page);
      await page.goto(`/proches/${procheId}`);

      const select = page.getByRole("combobox");
      await expect(select).toBeVisible();

      // Deux sélections successives sans attendre la 1re sauvegarde :
      // simule un utilisateur indécis / double clic. La valeur finale
      // persistée doit être la dernière choisie, pas une valeur intermédiaire.
      await select.selectOption("j30");
      await select.selectOption("j14_j7");

      await attendreSauvegarde(page);
      await expect(select).toHaveValue("j14_j7");

      // Vérification en base : pas d'écriture obsolète ("j30") qui resterait.
      await expect
        .poll(async () => {
          const { data } = await sb
            .from("evenements")
            .select("frequence")
            .eq("id", evenementId)
            .single();
          return data?.frequence;
        })
        .toBe("j14_j7");
    } finally {
      await supprimerProche(sb, procheId);
    }
  });

  test("valeur par défaut : frequence NULL en base => défaut affiché en UI", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    // Force explicitement frequence = null pour vérifier le fallback UI
    // (FrequenceEvenement : `frequence ?? FREQUENCE_DEFAUT`).
    const { procheId } = await creerProcheAvecEvenement(sb, userId, {
      frequence: null,
    });

    try {
      await seConnecter(page);
      await page.goto(`/proches/${procheId}`);

      const select = page.getByRole("combobox");
      await expect(select).toBeVisible();
      // Aucune valeur en base, mais l'UI doit présélectionner le défaut.
      await expect(select).toHaveValue("j30_j14_j7");
    } finally {
      await supprimerProche(sb, procheId);
    }
  });
});
