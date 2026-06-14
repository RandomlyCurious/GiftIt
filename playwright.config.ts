import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// Charge .env.local (mêmes variables que l'app Next) dans process.env, pour que
// les tests disposent des creds Supabase + du compte TEST_USER. @next/env est
// déjà présent (dépendance de Next) ; pas de dépendance dotenv à ajouter.
loadEnvConfig(process.cwd());

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

// Auto-start de l'app uniquement si la cible est locale ; si PLAYWRIGHT_BASE_URL
// pointe vers un déploiement distant, on ne lance rien.
const estLocal = /localhost|127\.0\.0\.1/.test(baseURL);

// Session partagée produite par le projet `setup` (cf. tests/e2e/auth.setup.ts).
const authFile = "tests/e2e/.auth/user.json";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Le serveur Next dev compile les routes à la demande : trop de workers en
  // parallèle le saturent (login > 30 s). On plafonne pour des tests stables.
  workers: process.env.CI ? 1 : 4,
  // Timeout par test élargi : certains parcours dépendent d'Edge Functions LLM
  // (génération de panel / cartes de swipe) qui peuvent prendre plusieurs dizaines de secondes.
  timeout: 90_000,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
  },
  projects: [
    // Se connecte une fois et sauvegarde la session (tests/e2e/.auth/user.json).
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: authFile },
      dependencies: ["setup"],
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"], storageState: authFile },
      dependencies: ["setup"],
    },
  ],
  // Démarre automatiquement l'app Next en local pour les tests, et réutilise un
  // serveur déjà lancé si présent (dev confortable). Désactivé si PLAYWRIGHT_BASE_URL
  // pointe vers un environnement distant (déploiement).
  // On sert un BUILD DE PRODUCTION (compilé une fois) plutôt que `next dev` :
  // en dev, Next compile chaque route à la demande et se fait saturer par les
  // tests parallèles (les logins concurrents dépassent alors 60 s). Le build
  // prod est stable sous charge. reuseExistingServer évite de rebuild si un
  // serveur tourne déjà sur le port.
  webServer: estLocal
    ? {
        command: "npm run build && npm run start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      }
    : undefined,
});
