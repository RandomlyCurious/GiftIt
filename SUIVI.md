# SUIVI — État des fonctionnalités GiftMatch

> Source de vérité du périmètre implémenté. **Mis à jour à chaque itération.**
> Dernière mise à jour : **2026-06-14**
> Légende : ✅ fait & vérifié · 🟡 partiel · ❌ à faire · 🔒 fondation posée, feature non codée

---

## 🎯 Priorités en cours (ordre demandé)

1. ~~Matching V2 — tous les points (Tranches 1-2-3)~~ — ✅ **TERMINÉ** (v2 branché, repli tags)
2. ~~Modifier / supprimer un proche~~ — ✅ **TERMINÉ**

---

## 🔐 Authentification
| Fonctionnalité | État |
|---|---|
| Inscription email + mot de passe | ✅ |
| Connexion Google OAuth (testé prod) | ✅ |
| Création auto du profil (trigger, email + Google) | ✅ |
| Déconnexion | ✅ |
| Protection des routes (middleware) | ✅ |
| Confirmation e-mail à l'inscription | ❌ **désactivée** (choix produit : friction zéro) — toggle dashboard à confirmer |
| Récupération de mot de passe | ❌ |
| OAuth Apple | ❌ |
| Profil : langue, fuseau, avatar | ❌ |

## 👥 Gestion des proches
| Fonctionnalité | État |
|---|---|
| Ajout d'un proche (champs + tags + événements) | ✅ |
| Liste (dashboard, tri par prochain événement) | ✅ |
| Fiche détaillée | ✅ |
| **Modifier un proche** (tous champs + portrait/budget/audace) | ✅ |
| **Supprimer un proche** (modale + cascade) | ✅ |
| Upload photo (Storage) | ❌ |
| Tags libres (hors liste) | ❌ |

## 🎯 Découverte / Calibration
| Fonctionnalité | État |
|---|---|
| Session de swipe **personnalisée** (generate-swipe-cards : cœur/discriminante/exploratoire §3) | ✅ |
| MAJ vecteur de goûts (+0.5/−0.3, plancher 0) | ✅ |
| Seuil calibration (≥5) + barre de progression | ✅ |
| Re-calibration | ✅ |
| Swipe gestuel (tactile) | ❌ (boutons seulement) |

## 🎁 Événements & Propositions
| Fonctionnalité | État |
|---|---|
| Calendrier /evenements (badges J-30/14/7) | ✅ |
| Calcul des dates (tous types) | ✅ |
| Panel de propositions (matching live + régénérer) | ✅ |
| Marquer « choisi » | ✅ |
| US-A1 — fréquence des rappels par événement | ✅ |
| US-A2 — historique des propositions | ✅ |
| US-A3 — marquer « offert » + date | ✅ |
| US-A4 — satisfaction (😞🙂🤩) | ✅ |
| Envoi réel des e-mails | ❌ (N8n non lancé, Resend non configuré) |
| Push notifications (J-14/J-7) | ❌ |

## 🧮 Matching
| Fonctionnalité | État |
|---|---|
| Edge Function matching (cosinus sur tags) | ✅ |
| Fallback tags manuels / vecteur appris | ✅ |
| **Matching V2 — Tranche 1** (infra pgvector + enrichissement) | ✅ |
| **Matching V2 — Tranche 2** (moteur `generate-panel` en parallèle + comparaison) | ✅ (construit & comparé, **pas branché**) |
| **Matching V2 — Tranche 3** (onboarding description/budget/audace, extract-profil, **bascule** generate-panel) | ✅ (gpt-4o-mini en prod, repli tags) |
| config_audace / composition portefeuille / justifications | ✅ (via generate-panel) |
| **Le matching de l'app = embeddings + reranking LLM** (repli tags si pas de profil sémantique) | ✅ |
| Calibration manuelle des scores d'originalité | ❌ |

## 📦 Catalogue
| Fonctionnalité | État |
|---|---|
| 48 tags + **1200 produits** (200 curés + 1000 concepts `genere_test` pour dev/test matching) | ✅ |
| Enrichissement v2 (description_matching, embedding, score, attributs) — **1200/1200, 0 embedding null** | ✅ |
| Âge normalisé : `age_min`/`age_max` numériques (migration 018, filtre dur futur) — 1200/1200 | ✅ |
| Cohérence catégories (passe LLM + correctif aliments/boissons) — `autre` à 2.7 % | ✅ |
| pgvector + index HNSW | ✅ |
| Tracking liens affiliés | ❌ |
| Intégration API marchandes (Phase 2) | ❌ |

## 🏗️ Fondations & infra
| Fonctionnalité | État |
|---|---|
| Schéma BDD migrations 001-012 + RLS | ✅ |
| Tables `declencheurs` + `interactions` (US-B1/B2) | ✅ |
| Workflows N8n découplés via declencheurs (US-B3) + RPC e-mail | ✅ (fichiers) |
| Déploiement Vercel (auto-deploy GitHub) | ✅ |
| QA Playwright (e2e) | ✅ suite 32/32 verte (desktop + mobile) ; points QA non bloquants traités |

## 🚀 Roadmap / business (non commencé)
| Fonctionnalité | État |
|---|---|
| Petites attentions (Epic C) | 🔒 fondations posées |
| Budget par proche | ❌ (Tranche 3) |
| Freemium / Premium / achat intégré | ❌ |
| RGPD (export, effacement) + CGU/confidentialité | ❌ |
| Voie pro (BL-03) | ❌ |

---

## 📜 Journal des itérations
- **2026-06-14** — Nettoyage catalogue (3 points) : (1) `tranche_age` normalisé en `age_min`/`age_max` numériques (migration 018 additive, champ texte conservé ; scripts/normalize-age.mjs paginé sur 1200) ; (2) passe de cohérence catégorie (scripts/fix-categories.mjs, revue LLM par lots) — sur-réaction corrigée par scripts/fix-cat-correctif.mjs (7 vins/bières/chocolats remis en gastronomie) ; (3) récaps finaux. Distribution finale : catégories équilibrées (gastro 14.7 % → autre 2.7 %), prix 27/53/17/3 % (<20/20-50/50-150/>150), originalité en cloche centrée sur 3, âge 1200/1200 rempli.
- **2026-06-14** — Catalogue étendu à **1200** (migration 017 colonne `source`; 1000 concepts `genere_test` générés via scripts/generate-catalogue.mjs : noms concrets, dédup nom+embedding>0.92, scores ancrés 1-5, descriptions variées, URLs=recherche). 0 embedding null. experiences saturée (rejet ~51%) plafonnée à 80.
- **2026-06-14** — QA 2.4 tranché : **pas de confirmation e-mail** à l'inscription (choix produit). Réglage = toggle Supabase « Confirm email » OFF (dashboard) ; le code gère déjà la session immédiate (aucun changement).
- **2026-06-14** — Prise en compte du rapport QA (tests/e2e/RAPPORT_QA.md) : 2.1 FrequenceEvenement sérialisé (select désactivé pendant l'écriture), 2.2 MAJ optimistes avec rollback + message (HistoriquePropositionItem), 2.3 sharp installé. 2.4 (confirmation e-mail) = décision de config en attente.
- **2026-06-14** — US-03 : modifier (page /proches/[id]/modifier, tous champs + re-extract-profil si portrait changé) & supprimer un proche (modale + cascade vérifiée). lib/proches.ts, composant ProcheActions.
- **2026-06-14** — Fix UX : la 1ère session de swipe était non personnalisée (15 produits par id = high-tech). Edge Function `generate-swipe-cards` (compo v2 §3 : cœur de cible / discriminante / exploratoire via embedding) ; page swipe branchée dessus. Cartes désormais pertinentes au profil. Swipe reste optionnel (skippable via retour fiche).
- **2026-06-13** — Matching V2 **Tranche 3** : migrations 015 (proches onboarding) & 016 (budget), Edge Function `extract-profil`, generate-panel reranke sur la description (anti-goûts) + audace + budget. **Gate qualité passé** (v2 respecte les anti-goûts là où les tags les violent — Marc 0 vs 2, Thomas rétro vs sans-fil). Bascule frontend sur `generate-panel` (+ repli tags) + onboarding (portrait libre/budget/audace). gpt-4o-mini confirmé en prod. **Matching V2 complet.**
- **2026-06-12** — Matching V2 **Tranche 2** : migrations 013 (proche embedding + config_audace) & 014 (RPC match_produits), Edge Function `generate-panel` (3 couches + portefeuille + justifs gpt-4o), scripts embed-proches & compare-matching. Comparaison tags vs v2 : mécanique v2 validée (cohérente, sur-profil), **non branchée** (le frontend reste sur le matching tags). Secret OpenAI posé sur Supabase.
- **2026-06-12** — Matching V2 Tranche 1 (pgvector, enrichissement 200/200, HNSW). US-A1→A4 + US-B1→B3 (sprint v3). Création de ce suivi.
- _(antérieur)_ — MVP cadeau-événement complet : auth (email + Google), proches, swipe, matching tags, propositions, déploiement Vercel.
