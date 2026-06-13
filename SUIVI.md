# SUIVI — État des fonctionnalités GiftMatch

> Source de vérité du périmètre implémenté. **Mis à jour à chaque itération.**
> Dernière mise à jour : **2026-06-12**
> Légende : ✅ fait & vérifié · 🟡 partiel · ❌ à faire · 🔒 fondation posée, feature non codée

---

## 🎯 Priorités en cours (ordre demandé)

1. ~~Matching V2 — tous les points (Tranches 1-2-3)~~ — ✅ **TERMINÉ** (v2 branché, repli tags)
2. **Modifier / supprimer un proche** — _prochaine priorité_

---

## 🔐 Authentification
| Fonctionnalité | État |
|---|---|
| Inscription email + mot de passe | ✅ |
| Connexion Google OAuth (testé prod) | ✅ |
| Création auto du profil (trigger, email + Google) | ✅ |
| Déconnexion | ✅ |
| Protection des routes (middleware) | ✅ |
| Vérification e-mail obligatoire | 🟡 (géré en code, config non vérifiée) |
| Récupération de mot de passe | ❌ |
| OAuth Apple | ❌ |
| Profil : langue, fuseau, avatar | ❌ |

## 👥 Gestion des proches
| Fonctionnalité | État |
|---|---|
| Ajout d'un proche (champs + tags + événements) | ✅ |
| Liste (dashboard, tri par prochain événement) | ✅ |
| Fiche détaillée | ✅ |
| **Modifier un proche** | ❌ (priorité 2) |
| **Supprimer un proche** | ❌ (priorité 2) |
| Upload photo (Storage) | ❌ |
| Tags libres (hors liste) | ❌ |

## 🎯 Découverte / Calibration
| Fonctionnalité | État |
|---|---|
| Session de swipe (exclut déjà-swipés) | ✅ |
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
| 48 tags + 200 produits | ✅ |
| Enrichissement v2 (description_matching, embedding, score, attributs) — 200/200 | ✅ |
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
| QA Playwright | 🟡 (setup en place) |

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
- **2026-06-13** — Matching V2 **Tranche 3** : migrations 015 (proches onboarding) & 016 (budget), Edge Function `extract-profil`, generate-panel reranke sur la description (anti-goûts) + audace + budget. **Gate qualité passé** (v2 respecte les anti-goûts là où les tags les violent — Marc 0 vs 2, Thomas rétro vs sans-fil). Bascule frontend sur `generate-panel` (+ repli tags) + onboarding (portrait libre/budget/audace). gpt-4o-mini confirmé en prod. **Matching V2 complet.**
- **2026-06-12** — Matching V2 **Tranche 2** : migrations 013 (proche embedding + config_audace) & 014 (RPC match_produits), Edge Function `generate-panel` (3 couches + portefeuille + justifs gpt-4o), scripts embed-proches & compare-matching. Comparaison tags vs v2 : mécanique v2 validée (cohérente, sur-profil), **non branchée** (le frontend reste sur le matching tags). Secret OpenAI posé sur Supabase.
- **2026-06-12** — Matching V2 Tranche 1 (pgvector, enrichissement 200/200, HNSW). US-A1→A4 + US-B1→B3 (sprint v3). Création de ce suivi.
- _(antérieur)_ — MVP cadeau-événement complet : auth (email + Google), proches, swipe, matching tags, propositions, déploiement Vercel.
