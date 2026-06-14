// Gestion des proches (SUIVI.md ✅) — ajout (UI complet), affichage dashboard,
// modification, suppression (modale + cascade).
//
// Pages : src/app/proches/nouveau, src/app/dashboard, src/app/proches/[id],
//         src/app/proches/[id]/modifier, src/components/ProcheActions.
//
// Note : on ne renseigne PAS le "Portrait libre" dans ces tests, pour éviter de
// déclencher l'Edge Function extract-profil (LLM) — hors périmètre de ces cas.

import { test, expect } from "@playwright/test";
import {
  creerClientSupabase,
  creerProcheAvecEvenement,
  supprimerProche,
  lireProche,
  seConnecter,
} from "./helpers/giftmatch";

// Récupère l'id du proche depuis une URL /swipe/<id> ou /proches/<id>.
function idDepuisURL(url: string): string | null {
  const m = url.match(/\/(?:swipe|proches)\/([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

test.describe("Proches — CRUD", () => {
  test("ajout via le formulaire : crée le proche + son événement, puis lance la calibration", async ({
    page,
  }) => {
    const { sb } = await creerClientSupabase();
    const prenom = `QA-Ajout-${Date.now()}`;
    let procheId: string | null = null;

    try {
      await seConnecter(page);
      await page.goto("/proches/nouveau");

      await page.locator("#prenom").fill(prenom);
      await page.locator("#dateNaissance").fill("1991-03-22");
      await page.locator("#relation").selectOption("ami");
      // Sélectionne l'événement "Anniversaire" (bouton bascule).
      await page.getByRole("button", { name: "Anniversaire" }).click();

      await page
        .getByRole("button", { name: "Ajouter et commencer la calibration" })
        .click();

      // L'app enchaîne sur la session de swipe : /swipe/<id>.
      await page.waitForURL(/\/swipe\/[0-9a-f-]{36}/i);
      procheId = idDepuisURL(page.url());
      expect(procheId).not.toBeNull();

      // Vérification en base : proche créé avec les bons champs + 1 événement.
      const proche = await lireProche<{ prenom: string; relation: string }>(
        sb,
        procheId!,
        "prenom, relation",
      );
      expect(proche.prenom).toBe(prenom);
      expect(proche.relation).toBe("ami");

      const { data: evs } = await sb
        .from("evenements")
        .select("type")
        .eq("proche_id", procheId!);
      expect(evs?.map((e) => e.type)).toContain("anniversaire");
    } finally {
      if (procheId) await supprimerProche(sb, procheId);
    }
  });

  test("cas limite : prénom vide => le formulaire bloque la soumission", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();

    await seConnecter(page);
    await page.goto("/proches/nouveau");

    // On remplit tout SAUF le prénom (champ requis) et on soumet.
    await page.locator("#dateNaissance").fill("1991-03-22");
    await page
      .getByRole("button", { name: "Ajouter et commencer la calibration" })
      .click();

    // La validation HTML empêche la navigation : on reste sur /proches/nouveau.
    await expect(page).toHaveURL(/\/proches\/nouveau/);
    await expect(page.locator("#prenom")).toBeFocused();

    // Aucun proche "vide" n'a été créé pour cet utilisateur dans la foulée.
    const { count } = await sb
      .from("proches")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("prenom", "");
    expect(count ?? 0).toBe(0);
  });

  test("affichage : un proche existant apparaît sur le dashboard et sa fiche", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId } = await creerProcheAvecEvenement(sb, userId);
    const proche = await lireProche<{ prenom: string }>(sb, procheId, "prenom");

    try {
      await seConnecter(page);

      // Dashboard : la carte du proche est présente.
      await expect(page.getByText(proche.prenom)).toBeVisible();

      // Fiche : titre = prénom, section "Événements & rappels" présente.
      await page.goto(`/proches/${procheId}`);
      await expect(
        page.getByRole("heading", { name: new RegExp(proche.prenom) }),
      ).toBeVisible();
      await expect(page.getByText("Événements & rappels")).toBeVisible();
    } finally {
      await supprimerProche(sb, procheId);
    }
  });

  test("modification : changer le prénom est persisté et affiché", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId } = await creerProcheAvecEvenement(sb, userId);
    const nouveauPrenom = `QA-Modif-${Date.now()}`;

    try {
      await seConnecter(page);
      await page.goto(`/proches/${procheId}/modifier`);

      // Attend le chargement du formulaire (prénom pré-rempli).
      await expect(page.locator("#prenom")).not.toHaveValue("");
      await page.locator("#prenom").fill(nouveauPrenom);
      await page
        .getByRole("button", { name: "Enregistrer les modifications" })
        .click();

      // Retour sur la fiche, avec le nouveau prénom dans le titre.
      await page.waitForURL(new RegExp(`/proches/${procheId}$`));
      await expect(
        page.getByRole("heading", { name: new RegExp(nouveauPrenom) }),
      ).toBeVisible();

      // Vérification en base.
      const proche = await lireProche<{ prenom: string }>(sb, procheId, "prenom");
      expect(proche.prenom).toBe(nouveauPrenom);
    } finally {
      await supprimerProche(sb, procheId);
    }
  });

  test("suppression : la modale supprime le proche (cascade) et renvoie au dashboard", async ({
    page,
  }) => {
    const { sb, userId } = await creerClientSupabase();
    const { procheId } = await creerProcheAvecEvenement(sb, userId);
    let supprime = false;

    try {
      await seConnecter(page);
      await page.goto(`/proches/${procheId}`);

      // Ouvre la modale puis confirme.
      await page.getByRole("button", { name: "Supprimer" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page
        .getByRole("button", { name: "Supprimer définitivement" })
        .click();

      // Retour au dashboard.
      await page.waitForURL(/\/dashboard/);

      // Vérification en base : le proche n'existe plus.
      const { data } = await sb
        .from("proches")
        .select("id")
        .eq("id", procheId)
        .maybeSingle();
      expect(data).toBeNull();
      supprime = true;
    } finally {
      if (!supprime) await supprimerProche(sb, procheId);
    }
  });
});
