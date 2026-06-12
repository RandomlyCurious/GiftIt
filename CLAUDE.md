# CLAUDE.md — GiftMatch
> Fichier de référence partagé par tous les agents Claude Code.
> **Lire ce fichier en entier avant toute action sur le projet.**

---

## 0. Contexte produit

GiftMatch est une application B2C qui aide les utilisateurs à trouver des cadeaux pour leurs proches.
Mécanisme central : swipe gauche/droite sur des cadeaux pour calibrer les goûts d'un proche,
puis envoi automatique d'un panel de 5 propositions avant chaque événement (anniversaire, Noël, etc.).

**Auteur** : analytics engineer — pas développeur web. Privilégier la simplicité et la lisibilité du code
sur la performance ou l'optimisation prématurée. Chaque choix technique doit pouvoir s'expliquer en une phrase.

---

## 1. Stack technique — FIXE, ne pas dévier

| Couche | Outil | Rôle |
|---|---|---|
| Base de données | Supabase (PostgreSQL) | Stockage de toutes les données |
| Auth | Supabase Auth | Inscription / connexion (email + OAuth Google) |
| API | Supabase Auto-API (PostgREST) | CRUD automatique sur toutes les tables |
| Logique métier | Supabase Edge Functions (Deno/TypeScript) | Algo de matching uniquement |
| Automations | N8n (self-hosted ou cloud) | Rappels événements + envoi d'e-mails |
| E-mails | Resend (via N8n) | Transactionnel simple, gratuit jusqu'à 3 000/mois |
| Frontend | Next.js 14 (App Router, TypeScript) | Interface utilisateur |
| Hébergement frontend | Vercel | Déploiement automatique depuis GitHub |
| Stockage fichiers | Supabase Storage | Photos de proches et images produits |

> Note d'implémentation auth : le frontend utilise `@supabase/ssr` (sessions par cookies + `src/middleware.ts` pour le rafraîchissement et la protection des routes). Client navigateur via `@/lib/supabase`, client serveur via `@/lib/supabase-server`.

### Ce qu'on n'utilise PAS (et pourquoi)
- ❌ Prisma / backend Node.js custom → Supabase PostgREST le remplace
- ❌ Redis / cache → inutile au stade MVP
- ❌ Docker / Kubernetes → Vercel + Supabase gèrent tout
- ❌ GraphQL → REST Supabase suffit largement

---

## 2. Structure du projet

```
giftmatch/
├── CLAUDE.md                  ← ce fichier
├── .env.local                 ← variables d'env (jamais committé)
├── .env.example               ← template des variables (committé)
│
├── supabase/
│   ├── migrations/            ← fichiers SQL numérotés (001_, 002_...)
│   ├── seed/
│   │   ├── tags.sql           ← liste des tags normalisés
│   │   └── catalogue.sql      ← ~200 produits de base
│   └── functions/
│       └── matching/
│           └── index.ts       ← Edge Function algo de matching
│
├── src/
│   ├── app/                   ← pages Next.js (App Router)
│   │   ├── page.tsx           ← landing / accueil
│   │   ├── auth/              ← login, register
│   │   ├── dashboard/         ← liste des proches
│   │   ├── proches/
│   │   │   ├── [id]/          ← fiche d'un proche
│   │   │   └── nouveau/       ← formulaire ajout
│   │   ├── swipe/
│   │   │   └── [procheId]/    ← session de swipe
│   │   └── evenements/        ← calendar view
│   │
│   ├── components/            ← composants React réutilisables
│   │   ├── ui/                ← boutons, inputs, modales (shadcn/ui)
│   │   ├── SwipeCard.tsx      ← carte cadeau swipeable
│   │   ├── ProcheCard.tsx     ← carte résumé d'un proche
│   │   └── PropositionCard.tsx← carte cadeau proposé
│   │
│   ├── lib/
│   │   ├── supabase.ts        ← client Supabase (browser)
│   │   ├── supabase-server.ts ← client Supabase (server components)
│   │   └── utils.ts           ← fonctions utilitaires générales
│   │
│   └── types/
│       └── database.types.ts  ← types générés depuis Supabase (auto)
│
└── n8n/
    └── workflows/
        ├── rappel-anniversaire.json
        ├── rappel-noel.json
        └── envoi-propositions.json
```

---

## 3. Schéma de base de données

### Règles générales SQL
- Toutes les tables ont `id uuid DEFAULT gen_random_uuid() PRIMARY KEY`
- Toutes les tables ont `created_at timestamptz DEFAULT now()`
- Nommage : snake_case pour tables et colonnes
- Préfixe de migration : `001_`, `002_` etc. (ordre croissant)

### Tables

```sql
-- Utilisateurs (géré par Supabase Auth, on étend avec un profil)
CREATE TABLE profils (
  id uuid REFERENCES auth.users PRIMARY KEY,
  prenom text NOT NULL,
  nom text,
  created_at timestamptz DEFAULT now()
);

-- Proches
CREATE TABLE proches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profils(id) ON DELETE CASCADE NOT NULL,
  prenom text NOT NULL,
  nom text,
  date_naissance date NOT NULL,
  relation text CHECK (relation IN ('conjoint', 'enfant', 'parent', 'grand_parent', 'ami', 'collegue', 'autre')) NOT NULL,
  adresse text,
  photo_url text,
  vecteur_gouts jsonb DEFAULT '{}',  -- { "sport": 1.5, "lecture": 0.7, ... }
  nb_swipes integer DEFAULT 0,
  calibre boolean DEFAULT false,     -- true si nb_swipes >= 5
  created_at timestamptz DEFAULT now()
);

-- Tags normalisés (table de référence)
CREATE TABLE tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,         -- ex: "sport", "high_tech", "cuisine"
  libelle text NOT NULL,             -- ex: "Sport", "High-tech", "Cuisine"
  categorie text NOT NULL            -- ex: "loisirs", "culture", "lifestyle"
);

-- Tags associés à un proche (saisie manuelle initiale)
CREATE TABLE proche_tags (
  proche_id uuid REFERENCES proches(id) ON DELETE CASCADE,
  tag_slug text REFERENCES tags(slug),
  poids float DEFAULT 1.0,
  PRIMARY KEY (proche_id, tag_slug)
);

-- Événements
CREATE TABLE evenements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proche_id uuid REFERENCES proches(id) ON DELETE CASCADE NOT NULL,
  type text CHECK (type IN ('anniversaire', 'noel', 'fete_meres', 'fete_peres', 'fete_grands_parents', 'saint_valentin', 'autre')) NOT NULL,
  date_fixe date,                    -- pour type = 'autre'
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Catalogue de produits (cadeaux)
-- NB : renommée cadeaux -> produits (CdC §4.2). MVP = table unique simplifiée
--      (un produit = un vendeur, champs marchands inline). Le split
--      produits / produit_vendeur est prévu pour la v1.5.
CREATE TABLE produits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom text NOT NULL,
  description text,
  categorie text NOT NULL,
  prix_min numeric(10,2),
  prix_max numeric(10,2),
  url_produit text NOT NULL,
  url_image text,
  affilie boolean DEFAULT false,
  actif boolean DEFAULT true,
  nb_tags integer DEFAULT 0,         -- dénormalisé pour perf
  created_at timestamptz DEFAULT now()
);

-- Tags associés à un produit
CREATE TABLE produit_tags (
  produit_id uuid REFERENCES produits(id) ON DELETE CASCADE,
  tag_slug text REFERENCES tags(slug),
  PRIMARY KEY (produit_id, tag_slug)
);

-- Historique des swipes
CREATE TABLE swipes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proche_id uuid REFERENCES proches(id) ON DELETE CASCADE NOT NULL,
  produit_id uuid REFERENCES produits(id) NOT NULL,
  direction text CHECK (direction IN ('gauche', 'droite')) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (proche_id, produit_id)     -- un produit ne peut être swipé qu'une fois par proche
);

-- Propositions envoyées
CREATE TABLE propositions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proche_id uuid REFERENCES proches(id) ON DELETE CASCADE NOT NULL,
  evenement_id uuid REFERENCES evenements(id) NOT NULL,
  produit_id uuid REFERENCES produits(id) NOT NULL,
  score float NOT NULL,              -- score de matching calculé
  choisie boolean DEFAULT false,     -- l'utilisateur a marqué ce cadeau comme "choisi"
  envoyee_le timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### Évolutions v3 — migrations 008-010 (additif, non destructif)

**008** — colonnes : `evenements.frequence text` (US-A1, défaut `'j30_j14_j7'`) ; `propositions.offert boolean` + `propositions.offert_le date` (US-A3) ; `propositions.retour_satisfaction smallint CHECK IN (1,2,3)` (US-A4). `choisie` inchangée.

**009** — tables génériques `[FONDATION]` :
- `declencheurs(id, proche_id, type IN ('evenement','attention','pro'), evenement_id FK nullable, regle_temporelle jsonb, actif, created_at)` — modèle de déclencheur générique (US-B1).
- `interactions(id, proche_id, declencheur_id, type_suggestion, statut IN ('propose','vu','agi','ignore'), date, created_at)` (US-B2).
- RLS par propriété du proche sur les deux.

**010** — pont `evenements → declencheurs` (US-B3) : backfill + trigger `AFTER` **défensif** (synchro non bloquante pour l'écriture sur `evenements`). Le workflow N8n générique lit `declencheurs` ; `evenements` reste la source de vérité du calcul des dates. Les workflows spécialisés restent en fallback.

### Matching v2 — Tranche 1 : infra & enrichissement (migrations 011-012)

Découpage en 3 tranches (cf. Specs_Matching_v2). **Seule la Tranche 1 est faite** : infra + enrichissement du catalogue, **impact utilisateur nul** (le matching par tags reste seul actif). Tranches 2 (matching embeddings en parallèle) et 3 (onboarding v2 + bascule) à venir, cadrées séparément.

**011** — `CREATE EXTENSION vector` (pgvector) + colonnes `produits` : `description_matching text` (description-pivot orientée destinataire), `embedding vector(1536)`, `score_originalite int CHECK 1-5`, `tranche_age text`, `occasions text[]`. Additif.

**012** — index `HNSW (embedding vector_cosine_ops)`, posé après le chargement des embeddings.

**ELT** : `scripts/enrich-catalogue.mjs` (Node, `fetch`, zéro dépendance) — outil de dev qui, pour chaque produit, génère via OpenAI (`gpt-4o-mini`) la `description_matching` (angle d'attaque rotatif pour diversifier les formulations → éviter la similarité vectorielle parasite) + attributs, puis l'`embedding` (`text-embedding-3-small`). Idempotent. Secrets : `OPENAI_API_KEY`, `LLM_PROVIDER` dans `.env.local`. Le matching v2 ne consomme pas encore ces colonnes (Tranche 2).

---

## 4. Algorithme de matching (Edge Function)

**Fichier** : `supabase/functions/matching/index.ts`

### Principe
Score = similarité cosinus entre le vecteur de goûts du proche et le vecteur de tags du cadeau.

```
vecteur_proche = { sport: 2.0, lecture: 1.5, cuisine: 0.7 }
vecteur_cadeau = { sport: 1, high_tech: 1 }          ← binaire (présent/absent)

score = Σ(proche[tag] × cadeau[tag]) / (|proche| × |cadeau|)
```

### Mise à jour du vecteur après un swipe
```
swipe DROITE (positif) : vecteur_proche[tag] += 0.5  pour chaque tag du cadeau
swipe GAUCHE (négatif) : vecteur_proche[tag] -= 0.3  pour chaque tag du cadeau
                         (plancher à 0, jamais négatif)
```

### Seuil de calibration
- `calibre = true` quand `nb_swipes >= 5`
- Avant calibration : propositions basées uniquement sur les tags manuels

### Appel de la Edge Function
```
POST /functions/v1/matching
Body: { "proche_id": "uuid", "evenement_id": "uuid", "nb_propositions": 5 }
Retour: { "propositions": [{ "produit_id": "uuid", "score": 0.87 }, ...] }
```

---

## 5. Conventions de code

### TypeScript / Next.js
```typescript
// ✅ Nommage
const maVariable = 'valeur'         // camelCase pour variables
type MonType = { ... }              // PascalCase pour types
function maFonction() {}            // camelCase pour fonctions
<MonComposant />                    // PascalCase pour composants

// ✅ Imports Supabase (toujours depuis lib/)
import { supabase } from '@/lib/supabase'

// ✅ Gestion d'erreur — toujours vérifier { data, error }
const { data, error } = await supabase.from('proches').select('*')
if (error) { console.error(error); return }

// ❌ Ne jamais faire
const data = await supabase.from('proches').select('*')  // pas de gestion d'erreur
```

### SQL / Migrations
```sql
-- ✅ Toujours nommer les fichiers avec un préfixe numéroté
-- 001_init_schema.sql
-- 002_seed_tags.sql
-- 003_add_index_swipes.sql

-- ✅ Toujours inclure un commentaire d'intention en tête de fichier
-- Migration 001 : création du schéma initial
-- Auteur : Agent BDD — Date : 2026-06
```

### Fichiers et dossiers
- Un composant = un fichier, nommé `MonComposant.tsx`
- Les pages sont dans `src/app/`, les composants dans `src/components/`
- Jamais de logique métier dans les pages — tout va dans `src/lib/` ou les Edge Functions

---

## 6. Variables d'environnement

**Fichier `.env.local`** (jamais committé) :
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...    # uniquement côté serveur

# Resend (emails)
RESEND_API_KEY=re_...

# N8n
N8N_WEBHOOK_SECRET=un_secret_aleatoire
```

**Fichier `.env.example`** (committé, sans valeurs) :
```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
N8N_WEBHOOK_SECRET=
```

---

## 7. Sécurité Supabase (Row Level Security)

**Règle absolue : activer RLS sur toutes les tables.**
Un utilisateur ne peut voir et modifier que ses propres données.

```sql
-- Exemple pour la table proches
ALTER TABLE proches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture ses proches"
  ON proches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Modification ses proches"
  ON proches FOR ALL
  USING (auth.uid() = user_id);
```

Même pattern pour : `swipes`, `evenements`, `propositions`, `proche_tags`.
Les tables `produits`, `tags`, `produit_tags` sont en lecture publique (pas de RLS strict).

---

## 8. Workflows N8n

### Workflow "Rappels événements" (déclenché chaque matin à 8h)
```
Cron (8h00)
  → Supabase : SELECT événements dont la date est dans 30j, 14j ou 7j
  → Pour chaque événement trouvé :
      → Appel Edge Function matching (génère 5 propositions)
      → Resend : envoi de l'email avec les 5 propositions
      → Supabase : INSERT dans propositions (log)
```

### Calcul des dates d'événements
- **Anniversaire** : calculé dynamiquement chaque année depuis `date_naissance`
- **Noël** : 25 décembre de l'année en cours
- **Fête des mères** : 1er dimanche de juin (France)
- **Fête des pères** : 3ème dimanche de juin (France)
- **Fête des grands-parents** : 1er dimanche d'octobre (France)
- **Autre** : date fixe stockée dans `evenements.date_fixe`

---

## 9. Template e-mail (Resend)

Sujet : `🎁 Idées cadeaux pour [Prénom] — [Événement] dans [X] jours`

Corps HTML minimal :
```
Bonjour [Prénom utilisateur],

[Événement] de [Proche] approche !
Voici 5 idées sélectionnées pour lui/elle :

[Cadeau 1] — [Prix] → [Lien]
[Cadeau 2] — [Prix] → [Lien]
[Cadeau 3] — [Prix] → [Lien]
[Cadeau 4] — [Prix] → [Lien]
[Cadeau 5] — [Prix] → [Lien]

Voir d'autres idées → [Lien vers l'app]
```

---

## 10. Ordre de démarrage des agents

```
① Agent Orchestrateur   → génère cette structure, initialise le repo GitHub
② Agent BDD             → écrit les migrations SQL dans supabase/migrations/
③ Agent Data            → écrit le seed (tags + catalogue) dans supabase/seed/
④ Agent Backend         → écrit la Edge Function matching + configure N8n
⑤ Agent Frontend        → construit l'UI Next.js en consommant Supabase directement
```

**Règle de dépendance** :
- ④ ne peut pas commencer sans ② (schéma BDD finalisé)
- ③ peut tourner en parallèle avec ④ une fois ② terminé
- ⑤ peut commencer les composants statiques en parallèle avec ④

---

## 11. Ce que chaque agent NE doit PAS faire

| Agent | Interdictions |
|---|---|
| BDD | Écrire du code TypeScript / toucher au frontend |
| Data | Modifier le schéma BDD — uniquement INSERT/seed |
| Backend | Créer des composants React — uniquement Edge Functions + N8n |
| Frontend | Écrire des migrations SQL ou de la logique métier hors composants |
| Orchestrateur | Écrire du code métier — uniquement coordination et CLAUDE.md |

---

## 12. Définition de "terminé" (Definition of Done)

Une tâche est terminée quand :
- [ ] Le code est écrit et ne contient pas d'erreur TypeScript (`tsc --noEmit`)
- [ ] La migration SQL est numérotée et testée localement (`supabase db reset`)
- [ ] Les variables d'environnement nécessaires sont documentées dans `.env.example`
- [ ] Un commentaire court explique les choix non-évidents
- [ ] Le CLAUDE.md est mis à jour si un nouveau choix technique est fait
