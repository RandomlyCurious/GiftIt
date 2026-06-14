// US-A3 [MVP] — Marquer un cadeau comme "offert" (distinct de "choisi").
//
// Met à jour propositions.offert (bool) + propositions.offert_le (date).
// Ne touche jamais à `choisie`. UI : bouton "Marquer offert" / "Offert" dans
// src/components/HistoriquePropositionItem.tsx, page /proches/[id]/historique.
//
// Couverture :
//   1. Scénario nominal — clic "Marquer offert" => offert=true + offert_le en base
//   2. Cas limite        — double bascule (offert puis annulation) => offert=false, date effacée
//   3. Non-régression    — `choisie` reste inchangée après bascule de `offert`

import { test, expect } from "@playwright/test";
import {
  creerClientSupabase,
  creerProcheAvecEvenement,
  creerProposition,
  supprimerProche,
  seConnecter,
} from "./helpers/giftmatch";

// Date du jour au format YYYY-MM-DD (comme le fait lib/propositions.ts).
function aujourdhuiISO(): string {
  return new Date().toISOString().slice(0, 10);
}

test.describe("US-A3 — marquer offert", () => {
  test("scénario nominal : marquer offert persiste offert + offert_le", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId, evenementId } = await creerProcheAvecEvenement(sb, userId);

    try {
      await creerProposition(sb, procheId, evenementId, { offert: false });

      await seConnecter(page);
      await page.goto(`/proches/${procheId}/historique`);

      const bouton = page.getByRole("button", { name: "Marquer offert" });
      await expect(bouton).toBeVisible();
      await bouton.click();

      // L'UI bascule sur l'état "Offert".
      await expect(page.getByRole("button", { name: "Offert" })).toBeVisible();

      // Vérification en base : offert=true ET date du jour renseignée.
      await expect
        .poll(async () => {
          const { data } = await sb
            .from("propositions")
            .select("offert, offert_le")
            .eq("proche_id", procheId)
            .single();
          return data;
        })
        .toMatchObject({ offert: true, offert_le: aujourdhuiISO() });
    } finally {
      await supprimerProche(sb, procheId);
    }
  });

  test("cas limite : annuler 'offert' remet offert=false et efface la date", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId, evenementId } = await creerProcheAvecEvenement(sb, userId);

    try {
      // Démarre déjà "offert" pour tester l'annulation (toggle inverse).
      await creerProposition(sb, procheId, evenementId, { offert: true });

      await seConnecter(page);
      await page.goto(`/proches/${procheId}/historique`);

      // Au chargement le bouton est "Offert" ; un clic l'annule.
      await page.getByRole("button", { name: "Offert" }).click();
      await expect(
        page.getByRole("button", { name: "Marquer offert" }),
      ).toBeVisible();

      await expect
        .poll(async () => {
          const { data } = await sb
            .from("propositions")
            .select("offert, offert_le")
            .eq("proche_id", procheId)
            .single();
          return data;
        })
        .toMatchObject({ offert: false, offert_le: null });
    } finally {
      await supprimerProche(sb, procheId);
    }
  });

  test("non-régression : marquer offert ne modifie pas `choisie`", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId, evenementId } = await creerProcheAvecEvenement(sb, userId);

    try {
      // choisie=true au départ : doit le rester après la bascule de offert.
      await creerProposition(sb, procheId, evenementId, {
        choisie: true,
        offert: false,
      });

      await seConnecter(page);
      await page.goto(`/proches/${procheId}/historique`);
      await page.getByRole("button", { name: "Marquer offert" }).click();
      await expect(page.getByRole("button", { name: "Offert" })).toBeVisible();

      await expect
        .poll(async () => {
          const { data } = await sb
            .from("propositions")
            .select("choisie, offert")
            .eq("proche_id", procheId)
            .single();
          return data;
        })
        .toMatchObject({ choisie: true, offert: true });
    } finally {
      await supprimerProche(sb, procheId);
    }
  });
});
