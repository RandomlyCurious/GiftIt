# GiftMatch — User Stories & Préparation Roadmap v3

> Document d'orientation pour les agents Claude Code
> À lire APRÈS CLAUDE.md et GiftMatch_Specs_Matching_v2.md
> Juin 2026

---

## ⚠️ RÈGLES ANTI-RÉGRESSION — À LIRE AVANT TOUTE ACTION

Ce document prépare l'avenir SANS casser l'existant. Les agents DOIVENT respecter ces règles :

1. **Ne jamais modifier ou supprimer une table, colonne ou fonction existante** sauf instruction explicite. On ajoute, on ne remplace pas.
2. **Toute évolution du schéma = nouvelle migration numérotée** (005, 006…). Jamais d'édition d'une migration déjà appliquée.
3. **Les fonctionnalités "à venir" de ce document ne sont PAS à implémenter maintenant.** Elles sont décrites pour que les fondations posées aujourd'hui les accueillent sans refonte. Sauf mention `[MVP]`, une US n'est pas à coder dans le sprint courant.
4. **En cas de doute ou de contradiction avec un document existant** : CLAUDE.md prime, puis Specs_Matching_v2, puis ce document. Ne jamais inventer une résolution — demander.
5. **Périmètre du sprint courant = uniquement les US taguées `[MVP]`.** Le reste est du contexte directionnel.

---

## 1. Vision produit consolidée (contexte directionnel)

GiftMatch n'est pas une "app à cadeaux" mais un **booster de relation**. Le cadeau aux événements est la porte d'entrée rassurante ; le cœur de valeur à terme est l'entretien continu des relations via des petites attentions au bon moment.

- **Porte d'entrée (MVP actuel)** : cadeaux aux événements (anniversaire, Noël…)
- **Cœur à venir (prochaine grande feature)** : petites attentions relationnelles
- **Segment cible** : 25-40 ans, cadres et professions intermédiaires techniques, manque de temps, culpabilité latente sur l'entretien des liens
- **Positionnement émotionnel** : éviter la perte ("la routine qui s'installe") plus que le gain

Ce cadrage explique POURQUOI certaines fondations sont posées dès maintenant. Les agents n'ont pas à implémenter cette vision — juste à ne pas la rendre impossible.

---

## 2. État de l'existant (ne pas régresser)

Ce qui fonctionne déjà et doit rester intact :

| Composant | Statut | Ne pas toucher sauf instruction |
|---|---|---|
| Schéma BDD de base (proches, produits, evenements, swipes, propositions…) | ✅ Déployé | ✅ |
| Migrations 001-003 (+ 004 matching v2) | ✅ Appliquées | ✅ |
| Cycle : ajout proche → capture goûts → génération propositions | ✅ Fonctionnel | ✅ |
| Edge Functions matching v2 | 🟡 En cours | Étendre, pas réécrire |

---

## 3. User Stories — Sprint courant `[MVP]`

Ces US complètent le MVP cadeau-événement. Elles sont à implémenter.

### Epic A — Boucle de valeur cadeau (finalisation MVP)

| # | User Story | Priorité | Notes techniques |
|---|---|---|---|
| US-A1 `[MVP]` | En tant qu'utilisateur, je veux choisir l'intervalle de génération des propositions (avant chaque événement) afin de recevoir les idées au bon moment. | Must | Champ `frequence` sur l'événement ou config globale. Réutilise le scheduler N8n existant. |
| US-A2 `[MVP]` | En tant qu'utilisateur, je veux voir l'historique des propositions reçues pour un proche afin de ne pas oublier ce que j'ai déjà envisagé. | Must | Lecture seule sur table `propositions` existante. Aucun changement de schéma. |
| US-A3 `[MVP]` | En tant qu'utilisateur, je veux marquer un cadeau comme "offert" (et pas juste "choisi") afin de tenir un historique réel. | Should | Ajouter colonne `offert boolean` + `offert_le date` sur `propositions` via migration 005. Ne pas toucher au champ `choisi`. |
| US-A4 `[MVP]` | En tant qu'utilisateur, je veux un feedback simple après un événement ("ce cadeau a-t-il plu ?") afin d'améliorer les futures recommandations. | Could | Signal précieux pour la recalibration. Colonne `retour_satisfaction` nullable. |

---

## 4. User Stories — Préparation des fondations `[FONDATION]`

Ces US ne livrent pas une fonctionnalité visible mais garantissent que les petites attentions s'intégreront sans refonte. À implémenter dans le sprint courant car elles touchent des structures de base.

### Epic B — Socle générique de notifications & déclencheurs

| # | User Story | Priorité | Notes techniques |
|---|---|---|---|
| US-B1 `[FONDATION]` | En tant que système, je veux un modèle de "déclencheur" générique (pas seulement lié aux événements) afin d'accueillir plus tard les petites attentions sans refonte. | Must | Créer table `declencheurs` générique : `type` ('evenement' \| 'attention' \| 'pro'), `proche_id`, `regle_temporelle`, `actif`. Les événements actuels deviennent un type de déclencheur. Migration 006. |
| US-B2 `[FONDATION]` | En tant que système, je veux une table `interactions` qui logge tout contact suggéré et son issue afin de mesurer l'impact et calibrer le rythme. | Must | Table `interactions` : `proche_id`, `declencheur_id`, `type_suggestion`, `statut` (proposé/vu/agi/ignoré), `date`. Fondation de la mesure d'impact émotionnel future. |
| US-B3 `[FONDATION]` | En tant que système, je veux que le moteur de notifications soit découplé du type d'événement afin qu'un nouveau type de déclencheur n'exige pas de réécrire la logique d'envoi. | Must | Refactor léger : le workflow N8n lit la table `declencheurs` au lieu de calculer uniquement les dates d'événements. Garder la compatibilité avec les événements existants. |

> 🔑 Pourquoi maintenant : ces trois tables/refactors sont au cœur du système. Les poser correctement aujourd'hui évite une migration douloureuse quand les petites attentions arriveront. C'est le seul investissement "futur" qui justifie d'être fait tout de suite.

---

## 5. User Stories — Petites attentions `[À VENIR — NE PAS CODER]`

Décrites pour contexte uniquement. Les agents NE doivent PAS les implémenter dans le sprint courant. Elles montrent vers quoi tendent les fondations de l'Epic B.

### Epic C — Moteur de petites attentions

| # | User Story | Notes |
|---|---|---|
| US-C1 | En tant qu'utilisateur, je veux activer "petites attentions" par proche afin de recevoir des suggestions de plaisirs anodins hors événement. | Case à cocher par proche. S'appuiera sur le déclencheur type 'attention' (US-B1). |
| US-C2 | En tant qu'utilisateur, je veux que le rythme des attentions soit optimisé pour l'impact émotionnel afin que ça reste spécial et non routinier. | Logique de timing — le cœur différenciant. S'appuiera sur la table `interactions` (US-B2) pour apprendre. |
| US-C3 | En tant qu'utilisateur, je veux des suggestions variées (activité week-end, fleurs, pâtisserie sur le trajet…) afin de casser la routine. | Nécessitera une typologie de suggestions (cf. backlog BL-01 : axes consommation/social). |
| US-C4 | En tant qu'utilisateur en couple, je veux des suggestions discrètes et asynchrones (je gère seul, mon partenaire ne voit rien) afin de préserver l'effet de surprise. | Confirme le choix asymétrique : un seul membre du couple utilise l'app. |
| US-C5 | En tant qu'utilisateur, je veux pouvoir laisser un petit mot personnel afin de personnaliser l'attention. | Préfigure le premium (validation + mot). |

---

## 6. Backlog haut niveau `[LOINTAIN]`

Gardé volontairement non détaillé — ces directions évolueront. Aucune action agent.

| # | Direction | Note stratégique |
|---|---|---|
| BL-01 | Typologie cadeaux 2 axes (consommation : se consomme/s'utilise/se porte/se vit/se lit — social : seul/groupe/avec l'offreur) | L'axe social est un potentiel argument marketing |
| BL-02 | Petites attentions (détaillé en Epic C) | Cœur de valeur à terme |
| BL-03 | Voie pro : entretien de relations professionnelles & partenariats commerciaux | Même produit, acheteur à ROI explicite. Signal marché confirmé (cas Dior/gifters). Phase 2. |
| BL-04 | Premium : abonnement, promotions, logistique de bout en bout (l'utilisateur valide + mot, le reste est automatisé) | Modèle de revenu le plus sain. |
| BL-05 | Partenariats locaux (activités, commerces) | Exige une densité d'utilisateurs locale d'abord. |
| BL-06 | Valorisation interne de la donnée gifter via partenariats marques (PAS de revente directe — RGPD + réputation) | La donnée participe à la valeur de la boîte plutôt qu'à un revenu direct. |

---

## 7. Definition of Done (rappel, inchangé)

Une US `[MVP]` ou `[FONDATION]` est terminée quand :
- [ ] Code écrit, sans erreur TypeScript (`tsc --noEmit`)
- [ ] Migration numérotée et testée (`supabase db reset` en local)
- [ ] Aucune régression sur l'existant (le cycle ajout proche → propositions fonctionne toujours)
- [ ] Variables d'env documentées dans `.env.example`
- [ ] CLAUDE.md mis à jour si un nouveau choix technique structurant est fait

---

## 8. Ordre de travail recommandé pour les agents

```
1. US-A1, US-A2          → finalisation boucle de valeur (aucun risque, lecture/config)
2. US-A3, US-A4          → migration 005 (ajout colonnes, non destructif)
3. US-B1, US-B2          → migration 006 (nouvelles tables génériques)
4. US-B3                 → refactor N8n découplé (LE point sensible — tester la non-régression des événements existants AVANT de merger)
```

> ⚠️ US-B3 est la seule étape à risque de régression. L'agent qui la traite doit d'abord vérifier que les événements existants continuent de déclencher correctement, puis seulement généraliser. Tester avant/après.
