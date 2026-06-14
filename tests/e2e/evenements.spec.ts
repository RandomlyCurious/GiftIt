// Calendrier des événements (SUIVI.md ✅) — /evenements liste les événements
// ACTIFS de tous les proches, triés par date, avec un badge de délai (J-30/14/7).
//
// Page : src/app/evenements/page.tsx ; calcul des dates : src/lib/evenements.ts.
//
// Couverture :
//   1. Nominal    — un anniversaire proche (< 7 j) apparaît avec le badge J-7
//   2. Cas limite — un événement désactivé (actif=false) n'apparaît pas
//   3. Lien       — "Voir des idées" pointe vers la page propositions de l'événement

import { test, expect } from "@playwright/test";
import {
  creerClientSupabase,
  creerProcheAvecEvenement,
  supprimerProche,
  lireProche,
  seConnecter,
} from "./helpers/giftmatch";

// Renvoie une date de naissance (année 1990) dont l'anniversaire tombe dans
// `joursDansLeFutur` jours à partir d'aujourd'hui — pour piloter le badge de délai.
function dateNaissancePourAnniversaireDans(joursDansLeFutur: number): string {
  const cible = new Date();
  cible.setDate(cible.getDate() + joursDansLeFutur);
  const mm = String(cible.getMonth() + 1).padStart(2, "0");
  const jj = String(cible.getDate()).padStart(2, "0");
  return `1990-${mm}-${jj}`;
}

test.describe("Événements — calendrier", () => {
  test("nominal : un anniversaire dans moins de 7 jours apparaît avec le badge J-7", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    // Anniversaire dans 3 jours => bucket J-7 (jours <= 7).
    const { procheId } = await creerProcheAvecEvenement(sb, userId);
    await sb
      .from("proches")
      .update({ date_naissance: dateNaissancePourAnniversaireDans(3) })
      .eq("id", procheId);
    const { prenom } = await lireProche<{ prenom: string }>(sb, procheId, "prenom");

    try {
      await seConnecter(page);
      await page.goto("/evenements");

      // La ligne de CE proche (scopée par prénom unique) est présente...
      const ligne = page
        .locator("li", { hasText: `Anniversaire de ${prenom}` })
        .first();
      await expect(ligne).toBeVisible();
      // ...avec le badge J-7.
      await expect(ligne.getByText("J-7", { exact: true })).toBeVisible();
    } finally {
      await supprimerProche(sb, procheId);
    }
  });

  test("cas limite : un événement désactivé n'apparaît pas dans le calendrier", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId, evenementId } = await creerProcheAvecEvenement(sb, userId);
    await sb
      .from("proches")
      .update({ date_naissance: dateNaissancePourAnniversaireDans(5) })
      .eq("id", procheId);
    // Désactivation de l'unique événement du proche.
    await sb.from("evenements").update({ actif: false }).eq("id", evenementId);
    const { prenom } = await lireProche<{ prenom: string }>(sb, procheId, "prenom");

    try {
      await seConnecter(page);
      await page.goto("/evenements");

      // Le proche ne doit pas figurer (son seul événement est inactif).
      await expect(
        page.getByText(`Anniversaire de ${prenom}`),
      ).toHaveCount(0);
    } finally {
      await supprimerProche(sb, procheId);
    }
  });

  test("lien : 'Voir des idées' mène à la page propositions de l'événement", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId, evenementId } = await creerProcheAvecEvenement(sb, userId);
    await sb
      .from("proches")
      .update({ date_naissance: dateNaissancePourAnniversaireDans(3) })
      .eq("id", procheId);
    const { prenom } = await lireProche<{ prenom: string }>(sb, procheId, "prenom");

    try {
      await seConnecter(page);
      await page.goto("/evenements");

      const ligne = page
        .locator("li", { hasText: `Anniversaire de ${prenom}` })
        .first();
      const lien = ligne.getByRole("link", { name: "Voir des idées" });
      await expect(lien).toHaveAttribute(
        "href",
        `/proches/${procheId}/propositions?evenement=${evenementId}`,
      );
    } finally {
      await supprimerProche(sb, procheId);
    }
  });
});
