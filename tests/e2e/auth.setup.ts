// Authentification "une fois pour toutes" (pattern Playwright storageState).
// Le projet `setup` se connecte par l'UI et sauvegarde les cookies de session ;
// tous les autres projets réutilisent cet état => un seul sign-in pour toute la
// suite (le endpoint d'auth Supabase est rate-limité, on évite ainsi les 429).
import { test as setup } from "@playwright/test";
import { seConnecter, FICHIER_AUTH } from "./helpers/giftmatch";

setup("authentifier le compte de test", async ({ page }) => {
  await seConnecter(page);
  await page.context().storageState({ path: FICHIER_AUTH });
});
