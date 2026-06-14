// US-A4 [MVP] — Feedback de satisfaction post-événement ("ce cadeau a-t-il plu ?").
//
// Écrit propositions.retour_satisfaction (smallint 1|2|3 ; contrainte CHECK).
// 1 = 😞 Déçu, 2 = 🙂 Bien, 3 = 🤩 Adoré.
// UI : 3 boutons emoji dans src/components/HistoriquePropositionItem.tsx
//      (chacun a aria-label / title = libellé), page /proches/[id]/historique.
//
// Couverture :
//   1. Scénario nominal — choisir "Adoré" (3) => retour_satisfaction=3 en base
//   2. Cas limite        — changer d'avis (Déçu puis Adoré) => dernière note conservée
//   3. État initial      — note déjà en base => emoji correspondant pré-sélectionné

import { test, expect } from "@playwright/test";
import {
  creerClientSupabase,
  creerProcheAvecEvenement,
  creerProposition,
  supprimerProche,
  seConnecter,
} from "./helpers/giftmatch";

async function lireSatisfaction(
  sb: Awaited<ReturnType<typeof creerClientSupabase>>["sb"],
  procheId: string,
): Promise<number | null> {
  const { data } = await sb
    .from("propositions")
    .select("retour_satisfaction")
    .eq("proche_id", procheId)
    .single();
  return data?.retour_satisfaction ?? null;
}

test.describe("US-A4 — feedback de satisfaction", () => {
  test("scénario nominal : noter 'Adoré' persiste retour_satisfaction = 3", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId, evenementId } = await creerProcheAvecEvenement(sb, userId);

    try {
      await creerProposition(sb, procheId, evenementId, {
        retour_satisfaction: null,
      });

      await seConnecter(page);
      await page.goto(`/proches/${procheId}/historique`);

      // Bouton ciblé par son libellé accessible (aria-label="Adoré").
      await page.getByRole("button", { name: "Adoré" }).click();

      await expect.poll(() => lireSatisfaction(sb, procheId)).toBe(3);
    } finally {
      await supprimerProche(sb, procheId);
    }
  });

  test("cas limite : changer d'avis conserve la dernière note", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId, evenementId } = await creerProcheAvecEvenement(sb, userId);

    try {
      await creerProposition(sb, procheId, evenementId, {
        retour_satisfaction: null,
      });

      await seConnecter(page);
      await page.goto(`/proches/${procheId}/historique`);

      // L'utilisateur note "Déçu" (1) puis se ravise et note "Adoré" (3).
      await page.getByRole("button", { name: "Déçu" }).click();
      await page.getByRole("button", { name: "Adoré" }).click();

      // La valeur finale en base est la dernière choisie, pas une valeur figée.
      await expect.poll(() => lireSatisfaction(sb, procheId)).toBe(3);
    } finally {
      await supprimerProche(sb, procheId);
    }
  });

  test("état initial : une note existante est pré-sélectionnée à l'affichage", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId, evenementId } = await creerProcheAvecEvenement(sb, userId);

    try {
      // "Bien" (2) déjà en base : l'emoji correspondant doit être actif (opacité pleine).
      await creerProposition(sb, procheId, evenementId, {
        retour_satisfaction: 2,
      });

      await seConnecter(page);
      await page.goto(`/proches/${procheId}/historique`);

      const bien = page.getByRole("button", { name: "Bien" });
      const decu = page.getByRole("button", { name: "Déçu" });
      // L'emoji sélectionné est opacity-100, les autres opacity-40.
      await expect(bien).toHaveClass(/opacity-100/);
      await expect(decu).toHaveClass(/opacity-40/);
    } finally {
      await supprimerProche(sb, procheId);
    }
  });
});
