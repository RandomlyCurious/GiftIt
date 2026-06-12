# GiftMatch — Specs Matching & Onboarding v2

> Document technique & fonctionnel — cœur de valeur de l'app
> Référence pour les agents Claude Code · À lire avec CLAUDE.md (qui prime sur la stack)
> Juin 2026

---

## 0. Objectif de ce document

Spécifier le cœur de valeur de GiftMatch : capturer le profil d'un proche avec un effort minimal, et générer des recommandations de cadeaux pertinentes, originales et personnalisées. Ce document remplace et précise les sections 3.2, 3.3 et 4 du CdC fonctionnel v1.

**Principe directeur** : maximiser le ratio signal / effort. On extrait un maximum d'information utile par seconde d'attention de l'utilisateur.

---

## 1. Vue d'ensemble de l'approche

Le système repose sur trois piliers :

1. **Capture par description libre + LLM** — l'utilisateur décrit son proche en langage naturel, un LLM extrait un profil structuré + un embedding sémantique.
2. **Matching hybride en 3 couches** — filtres durs SQL → retrieval par embeddings (pgvector) → reranking LLM.
3. **Composition en portefeuille** — le panel de 5 cadeaux est composé selon un gradient d'originalité pour exploiter l'effet de compromis comportemental.

Le système de tags fermés du v1 est abandonné comme moteur de matching. Les tags restent uniquement pour l'affichage UI (chips lisibles).

---

## 2. Parcours de création d'un proche (onboarding)

### Écran 1 — Les bases (~10 sec)

| Champ | Type | Notes |
|---|---|---|
| Prénom | Texte | Obligatoire |
| Date de naissance | Date | Obligatoire — calcul anniversaire |
| Relation | Enum | Conjoint·e, Enfant, Parent, Grand-parent, Ami·e, Collègue, Autre |
| Budget | Enum + custom | 4 choix : 20€ / 50€ / 150€ / Sans limite. Option fourchette personnalisée. Modifiable à tout moment. |

### Écran 2 — Le portrait libre (~20 sec)

- Une seule question ouverte : *"Décris [Prénom] comme tu le ferais à un ami qui ne le/la connaît pas."*
- Placeholder d'exemple : *"Ma sœur, 28 ans, fan de céramique et de rando, végétarienne, déteste les gadgets…"*
- 3 chips de secours optionnels si l'inspiration manque (ex : 🏠 maison / 🎒 aventure / 🎨 créatif) — un tap pré-remplit une amorce.
- Le texte libre est la source d'information principale du système.

### Écran 3 — La restitution + curseur d'audace (effet wahou, ~10 sec)

- Le LLM affiche le portrait compris : intérêts détectés (chips verts) + anti-goûts (chips rouges barrés).
- L'utilisateur valide d'un tap ou corrige (ajout/suppression de chips).
- **Curseur d'audace** : slider de 0 à 100, icône 😴 (classique) ←→ 🎢 (audacieux), réglé sur 50 (neutre) par défaut.
- Proposition du mini-swipe optionnel (voir §3).

> Ce moment de restitution — *"l'app m'a compris"* — est l'effet wahou central. Il conforte l'utilisateur et l'incite à renseigner d'autres proches.

---

## 3. Mini-swipe — calibration ludique (optionnel)

### Rôle (double)
1. **Montrer la valeur** : prouver que l'app a ciblé des choses pertinentes → conforter l'utilisateur, l'inciter à ajouter d'autres proches.
2. **Affiner le profil** : ajuster le vecteur du proche avec un signal implicite.

### Composition des cartes (8 à 10 cartes, sélection stratégique)

| Type de carte | Quantité | Sélection | Objectif |
|---|---|---|---|
| Cœur de cible | 5-6 | Matching fort | Effet "ils m'ont compris" |
| Discriminante | 2-3 | Départage 2 hypothèses ambiguës du profil | Maximiser l'info par swipe |
| Exploratoire | 1 | Originalité haute, matching moyen | Tester l'ouverture à la surprise |

### Effet d'un swipe
- Swipe droite : le vecteur du proche se rapproche de l'embedding du produit (moyenne pondérée).
- Swipe gauche : le vecteur s'éloigne légèrement.
- Un swipe positif sur la carte exploratoire = signal fort d'ouverture → augmente l'audace effective du proche.

### Seuil
- Le mini-swipe est optionnel (l'utilisateur peut le passer).
- S'il est joué, minimum 5 swipes pour considérer le profil "affiné".

---

## 4. Le moteur de matching (3 couches)

### Couche 1 — Filtres durs (SQL classique)
Élimine ~80% du catalogue avant tout calcul coûteux :
- Budget : prix dans la fourchette du proche
- Âge approprié (si applicable)
- Déjà offert à ce proche (via historique)
- Déjà swipé à gauche dans la session
- Produit actif uniquement

### Couche 2 — Retrieval par embeddings (pgvector)
- Le profil du proche = un vecteur (embedding de la description enrichie + ajustements de swipe).
- Requête pgvector : récupérer les ~20 produits les plus proches sémantiquement (distance cosinus).
- Coût quasi nul, instantané, natif Supabase.

### Couche 3 — Reranking LLM (composition du panel)
- Un appel LLM reçoit : le profil du proche, le curseur d'audace, et les ~20 candidats.
- Il compose le panel final de 5 selon la structure de portefeuille (§5).
- Il génère pour chaque cadeau une **phrase de justification** ("Parce qu'elle adore la céramique, ce cours de poterie…").
- Déclenché uniquement aux jalons d'événement (J-30 / J-14 / J-7) → volume maîtrisé, coût ~0,01€ par panel.

---

## 5. Composition du panel — portefeuille à gradient d'originalité

On ne prend pas les 5 meilleurs scores bruts. On compose un portefeuille exploitant l'**effet de compromis** (compromise effect, Simonson 1989) : face à un gradient, l'utilisateur choisit majoritairement l'option du milieu, perçue comme le risque raisonnable.

### Répartition par défaut (curseur neutre = 50)

| Slot | Quantité | Matching | Originalité | Rôle |
|---|---|---|---|---|
| Valeur sûre | 2 | Fort | 1-2 | Rassurer, ancrer la pertinence |
| Équilibré | 2 | Fort | 3-4 | Zone de choix visée |
| Wildcard | 1 | Correct (seuil min.) | 4-5 | Effet "AH cool !", mémorable |

### Modulation par le curseur d'audace

| Position curseur | Répartition (sûre / équilibré / wildcard) |
|---|---|
| 😴 Classique (0-33) | 3 / 2 / 0 |
| Neutre (34-66) | 2 / 2 / 1 |
| 🎢 Audacieux (67-100) | 1 / 2 / 2 |

> ⚙️ Ces répartitions sont stockées dans une table de configuration (`config_audace`) facilement modifiable pour permettre des tests A/B sans toucher au code.

### Garde-fous
- Le wildcard conserve toujours un **matching minimum décent** — jamais hors-sol, sous peine de détruire la crédibilité.
- L'originalité ne doit jamais coûter la pertinence perçue.

### Bonus exploration
Si l'utilisateur clique/choisit le wildcard, c'est un signal très informatif → on élargit le vecteur du proche dans cette direction (mécanisme léger d'exploration/exploitation, évite l'enfermement dans une bulle de goûts).

---

## 6. Le score d'originalité

### Méthode (MVP)
Score LLM attribué à l'ingestion, échelle 1-5, calibré par ancres explicites dans le prompt :
- **1** = très commun (bougie parfumée, coffret chocolat)
- **3** = original accessible (abonnement box spécialisée)
- **5** = très original (cours de forge, baptême en planeur)

Les ancres garantissent la consistance du LLM (sans elles, il dérive).

### Calibration
Passe manuelle de vérification sur les ~200 premiers produits : validation/correction du score dans la table Supabase (≈1h de travail).

### Évolution (v1.5)
Recalibration par signal comportemental réel (taux de clic, taux de "choisi" observés en production).

### Note sur la relativité
L'originalité perçue est partiellement relative au profil (un coffret de thé est banal pour un amateur de thé). Pour le MVP, le score intrinsèque suffit — le reranker LLM gère la relativité naturellement puisqu'il voit le profil.

---

## 7. Schéma BDD — modifications

### Table `proches` — ajouts
```sql
ALTER TABLE proches ADD COLUMN description_libre text;
ALTER TABLE proches ADD COLUMN embedding vector(1536);        -- profil sémantique
ALTER TABLE proches ADD COLUMN audace integer DEFAULT 50;     -- 0-100
ALTER TABLE proches ADD COLUMN budget_type text DEFAULT '50'; -- '20' | '50' | '150' | 'nolimit' | 'custom'
ALTER TABLE proches ADD COLUMN budget_min numeric(10,2);      -- si custom
ALTER TABLE proches ADD COLUMN budget_max numeric(10,2);      -- si custom
ALTER TABLE proches ADD COLUMN profil_valide boolean DEFAULT false;
```

### Table `produits` (anciennement `cadeaux`) — ajouts
```sql
ALTER TABLE produits ADD COLUMN description_matching text;    -- description enrichie "pour qui c'est un bon cadeau"
ALTER TABLE produits ADD COLUMN embedding vector(1536);       -- embedding de description_matching
ALTER TABLE produits ADD COLUMN score_originalite integer;    -- 1-5
ALTER TABLE produits ADD COLUMN tranche_age text;             -- structuré, optionnel
ALTER TABLE produits ADD COLUMN occasions text[];             -- structuré, optionnel
```

### Index pgvector
```sql
CREATE INDEX ON produits USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### Nouvelle table `config_audace`
```sql
CREATE TABLE config_audace (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  position_min integer NOT NULL,   -- ex: 0
  position_max integer NOT NULL,   -- ex: 33
  nb_valeur_sure integer NOT NULL,
  nb_equilibre integer NOT NULL,
  nb_wildcard integer NOT NULL
);
-- Seed : 3 lignes (classique / neutre / audacieux)
```

> ⚠️ La table `cadeaux` doit être renommée `produits`. La table `propositions` continue de pointer vers les produits. Le champ `choisi` reste dans `propositions`.

---

## 8. Edge Functions Supabase à créer

Toutes les Edge Functions appellent le LLM via un **fournisseur paramétrable** (variable d'env `LLM_PROVIDER`, défaut `openai`). Permet de basculer OpenAI / Claude / Mistral sans réécrire la logique.

### 8.1 `extract-profil`
- Input : `{ proche_id, description_libre }`
- Action : appel LLM → extrait intérêts, anti-goûts, attributs structurés. Génère l'embedding (OpenAI `text-embedding-3-small`). Stocke dans `proches`.
- Output : `{ interets[], anti_gouts[], tags_ui[] }` pour affichage écran 3.

### 8.2 `generate-swipe-cards`
- Input : `{ proche_id }`
- Action : sélectionne 8-10 cartes selon la stratégie §3 (cœur de cible + discriminantes + exploratoire).
- Output : `{ cards[] }`

### 8.3 `generate-panel`
- Input : `{ proche_id, evenement_id }`
- Action : exécute les 3 couches de matching (§4), compose le portefeuille selon l'audace (§5), génère les justifications.
- Output : `{ propositions[] }` avec `{ produit_id, score, originalite, slot, justification }`

### 8.4 `update-vector-from-swipe`
- Input : `{ proche_id, produit_id, direction }`
- Action : ajuste l'embedding du proche (moyenne pondérée). Détecte signal d'ouverture sur carte exploratoire.

---

## 9. Configuration des modèles LLM

| Usage | Modèle (défaut) | Paramétrable | Notes |
|---|---|---|---|
| Embedding catalogue (ingestion) | OpenAI `text-embedding-3-small` (1536d) | — | ~0,01€ pour 300 produits |
| Embedding profil proche | OpenAI `text-embedding-3-small` | — | Cohérence avec le catalogue (même espace) |
| Extraction de portrait | OpenAI (défaut, crédits dispo) | ✅ `LLM_PROVIDER` | |
| Reranking / composition panel | OpenAI (défaut) | ✅ `LLM_PROVIDER` | |

Variables d'env à ajouter : `OPENAI_API_KEY`, `LLM_PROVIDER`, (`ANTHROPIC_API_KEY`, `MISTRAL_API_KEY` optionnels).

---

## 10. Pipeline d'initialisation de la base produit (ELT)

### Étape 1 — Sourcing
- Liste brute de 200-300 produits, curation manuelle assistée par LLM (ex : "génère 30 idées cadeaux bien-être entre 20 et 50€").
- Vérification manuelle des URLs réelles et des prix.

### Étape 2 — Enrichissement LLM
Pour chaque produit, un appel LLM génère :
- `description_matching` : description riche orientée **"pour qui c'est un bon cadeau"** (c'est ELLE qui sera embeddée, pas le nom du produit).
- `score_originalite` : 1-5 selon les ancres §6.
- attributs structurés : `tranche_age`, `occasions`.
- `tags` lisibles pour l'UI.

> 🔑 Point crucial : on n'embedde PAS "Coffret thé vert" mais *"Coffret de dégustation pour amateur de thé, idéal pour quelqu'un qui aime les rituels calmes, la cuisine asiatique, les moments cosy à la maison"*. La qualité du matching dépend entièrement de cette description-pivot.

### Étape 3 — Embedding
- `description_matching` → OpenAI `text-embedding-3-small` → colonne `embedding`.

### Étape 4 — Calibration manuelle
- Vérification des scores d'originalité sur les 200 premiers produits dans la table Supabase.

---

## 11. Backlog produit (idées parquées pour plus tard)

| # | Idée | Horizon | Notes |
|---|---|---|---|
| BL-01 | Typologie de cadeaux à 2 axes : mode de consommation (se consomme / s'utilise / se porte / se vit / se lit) + axe social (seul / en groupe / avec celui qui offre) | v2+ | L'axe social est émotionnellement fort, potentiel argument marketing ("cadeaux à vivre ensemble") |
| BL-02 | Option "petites attentions" : case à cocher par proche déclenchant des notifs occasionnelles pour plaisirs anodins hors événement | v2+ | Transforme l'app en compagnon relationnel continu, bon pour la rétention. À rapprocher de la fonctionnalité budget |

---

## 12. Points ouverts mis à jour

| # | Question | Statut |
|---|---|---|
| PO-01 | Algorithme de matching | ✅ Résolu — hybride embeddings + reranking LLM |
| PO-03 | Tags fermés vs ouverts | ✅ Résolu — tags = affichage UI uniquement, matching = embeddings |
| PO-07 | Séparation produit / produit_vendeur | Hors MVP — v1.5 |
| PO-08 | Seuil de "matching minimum décent" du wildcard à calibrer empiriquement | À tester en production |
| PO-09 | Relativité du score d'originalité au profil | Géré implicitement par le reranker au MVP |
