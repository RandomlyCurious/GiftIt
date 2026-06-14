// Authentification (SUIVI.md ✅) — login email/mdp, déconnexion, protection des
// routes par le middleware, et garde-fous de l'inscription.
//
// OAuth Google et récupération de mot de passe ne sont PAS testés ici :
// le 1er sort du périmètre e2e (redirection vers Google), le 2nd n'est pas
// implémenté (SUIVI ❌).
//
// Pages : src/app/auth/login, src/app/auth/register, src/middleware.ts,
//         déconnexion via <form action="/auth/signout" method="post">.

import { test, expect } from "@playwright/test";
import { ENV, seConnecter } from "./helpers/giftmatch";

// Ces tests vérifient le login/logout/protection : ils doivent partir d'un
// contexte NON authentifié (on n'hérite pas du storageState partagé).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentification", () => {
  test("connexion réussie => redirection vers le dashboard", async ({ page }) => {
    await seConnecter(page); // attend déjà **/dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Mes proches" })).toBeVisible();
  });

  test("cas limite : mauvais mot de passe => message d'erreur, pas de session", async ({
    page,
  }) => {
    await page.goto("/auth/login");
    await page.locator("#email").fill(ENV.testUserEmail);
    await page.locator("#motDePasse").fill("mauvais-mot-de-passe-xyz");
    await page.getByRole("button", { name: "Se connecter" }).click();

    // Message d'erreur affiché et on reste sur /auth/login (aucune session ouverte).
    await expect(page.getByText("Email ou mot de passe incorrect.")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("protection des routes : /dashboard non authentifié => redirection login", async ({
    page,
  }) => {
    // Contexte neuf (aucun cookie) : l'accès direct doit être intercepté.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("déconnexion : après logout, /dashboard renvoie vers login", async ({
    page,
  }) => {
    await seConnecter(page);

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    // Après déconnexion, la zone protégée n'est plus accessible.
    await page.waitForURL(/\/(auth\/login)?$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("inscription : email déjà utilisé => message d'échec (pas de doublon créé)", async ({
    page,
  }) => {
    // On tente de réinscrire le compte de test existant : l'app doit signaler
    // l'échec sans créer de nouveau compte ni ouvrir de session.
    await page.goto("/auth/register");
    await page.locator("#prenom").fill("QA");
    await page.locator("#email").fill(ENV.testUserEmail);
    await page.locator("#motDePasse").fill(ENV.testUserPassword);
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    // Selon la config Supabase (confirmation activée), on voit soit l'erreur
    // "déjà utilisé", soit le message de confirmation — jamais une redirection
    // dashboard (qui signifierait une session ouverte par erreur).
    await expect(
      page.getByText(
        /(email est peut-être déjà utilisé|Vérifiez votre boîte mail)/i,
      ),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});
