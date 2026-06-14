# Rapport QA — GiftMatch (à destination de l'agent de développement)

> Rédigé par l'agent QA. **Aucun fichier applicatif n'a été modifié** : tout le
> travail QA est confiné à `tests/e2e/` et `playwright.config.ts`.
> Périmètre testé = fonctionnalités **✅ vérifié** de `SUIVI.md`.
> Date du run : 2026-06-14 · Cible : Supabase de prod + compte de test dédié.

---

## 1. Verdict global

**Aucune régression fonctionnelle détectée.** La suite e2e passe à 100 % sur les
deux viewports.

| Projet | Résultat | Durée |
|---|---|---|
| chromium (desktop) | ✅ 32/32 (1 setup + 31 tests) | ~40 s |
| Mobile Chrome (Pixel 5) | ✅ 32/32 | ~44 s |

Parcours couverts (nominal + cas limite + vérification en base à chaque fois) :
auth (login/logout/protection routes/inscription), proches (ajout/affichage/
modification/suppression), calibration swipe (+0.5 / plancher 0 / seuil 5),
événements (badges J-7, masquage inactif), propositions (panel v2+repli, « choisi »),
US-A1→A4 (fréquence, historique, offert, satisfaction).

---

## 2. Points d'attention (non bloquants) — pour décision/dev

Ce ne sont pas des tests en échec, mais des observations relevées en lisant le
code pendant la rédaction des tests. Classées par priorité.

### 2.1 — `FrequenceEvenement` : pas de garde anti-concurrence (latent) · Priorité : moyenne
**Fichier** : `src/components/FrequenceEvenement.tsx:26-32`
`handleChange` lance `mettreAJourFrequence` sans annuler la requête précédente ni
verrouiller le `<select>` pendant l'écriture. Si l'utilisateur change deux fois
très vite, deux `UPDATE` partent en parallèle ; rien ne garantit que c'est la
**dernière** valeur choisie qui « gagne » si les réponses Supabase arrivent dans
le désordre.
- État actuel : le test « double changement rapide » **passe** (en pratique les
  écritures se résolvent dans l'ordre d'émission).
- Risque : silencieux et difficile à reproduire ; la fréquence persistée pourrait
  diverger de l'affichage.
- Piste : désactiver le `<select>` pendant `etat === "saving"`, ou ignorer la
  réponse d'une requête devenue obsolète (compteur de version / `AbortController`).

### 2.2 — Mises à jour optimistes sans rollback en cas d'erreur · Priorité : basse
**Fichier** : `src/components/HistoriquePropositionItem.tsx:34-43`
`toggleOffert` et `noter` mettent l'état local à jour **puis** persistent ; si la
mutation échoue (`marquerOffert` / `enregistrerSatisfaction` renvoient `false`),
l'erreur n'est que `console.error` : l'UI reste sur le nouvel état alors que la
base n'a pas changé → divergence silencieuse pour l'utilisateur.
- Piste : restaurer l'état précédent + message visible si la persistance échoue.

### 2.3 — `sharp` absent en production · Priorité : basse (info)
Au démarrage du build de prod, Next.js avertit :
`For production Image Optimization … the optional 'sharp' package is strongly
recommended`. N'empêche rien (les images produits s'affichent), mais
l'optimisation d'images est dégradée en prod.
- Piste : `npm i sharp`.

### 2.4 — Confirmation d'e-mail à l'inscription : comportement à confirmer · Priorité : basse
**Fichier** : `src/app/auth/register/page.tsx:49-56`
Selon la config Supabase (confirmation activée ou non), l'inscription ouvre soit
une session immédiate, soit affiche « Vérifiez votre boîte mail ». `SUIVI.md`
note d'ailleurs « Vérification e-mail obligatoire 🟡 (config non vérifiée) ».
Le test d'inscription tolère les deux issues — **il faudrait figer le
comportement attendu** côté config Supabase puis resserrer le test.

---

## 3. Élément d'infra à connaître (pas un bug applicatif)

**Rate-limiting Supabase Auth sur le sign-in par mot de passe.** En enchaînant
beaucoup de connexions (tests parallèles), Supabase renvoie « Email ou mot de
passe incorrect » **avec des identifiants pourtant valides**. Ce n'est pas un
défaut de l'app, mais c'est bon à savoir pour tout scénario automatisé/charge.
Côté QA, c'est contourné proprement (connexion unique réutilisée via
`storageState`, pas un contournement applicatif).

---

## 4. Non couvert (et pourquoi) — pas d'action attendue

- **Non implémenté** (SUIVI ❌) : OAuth Google/Apple, récupération de mot de passe,
  upload photo (Storage), envoi réel d'e-mails (N8n/Resend), push.
- **Fondations B1–B3** (`declencheurs`, `interactions`, N8n découplé) : structures
  back/automation sans UI dédiée → non couvrables en e2e d'interface. À valider
  par des tests d'intégration côté Edge Functions / N8n si souhaité.

---

## 5. Comment rejouer la suite

```bash
npx playwright test                      # setup + chromium + Mobile Chrome
npx playwright test --project=chromium   # desktop seul
npx playwright show-report               # rapport HTML détaillé
```
Pré-requis : `.env.local` rempli (creds Supabase + `TEST_USER_EMAIL` /
`TEST_USER_PASSWORD`). La suite démarre l'app en build de prod et crée/supprime
ses propres données sous le compte de test (invoque les Edge Functions LLM
réelles → coût OpenAI mineur).

---

## 6. Fichiers QA livrés (périmètre QA uniquement)

```
tests/e2e/
├── helpers/giftmatch.ts        ← login UI, client service-role, fixtures
├── auth.setup.ts               ← connexion unique → storageState
├── auth.spec.ts
├── proches.spec.ts
├── calibration-swipe.spec.ts
├── evenements.spec.ts
├── propositions.spec.ts
├── US-A1-frequence.spec.ts … US-A4-feedback.spec.ts
playwright.config.ts            ← projets, webServer prod, storageState
```
