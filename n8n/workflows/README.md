# n8n/workflows/

Workflows N8n (format JSON importable) qui déclenchent le matching et l'envoi des
e-mails de propositions avant chaque événement. Cf. **CLAUDE.md §8** (logique des rappels),
**§9** (template e-mail), **§4** (contrat de la Edge Function `matching`).

Responsable : **Agent Backend**.

---

## Les 3 workflows

| Fichier | Rôle | Sélection |
|---|---|---|
| `envoi-propositions.json` | **Générique — le cœur.** Tous types d'événements. | `evenements` actifs, tous types, dates calculées par type |
| `rappel-anniversaire.json` | Spécialisation : anniversaires uniquement. | `type = anniversaire` |
| `rappel-noel.json` | Spécialisation : Noël uniquement. | `type = noel` |

> **Relation entre les workflows.** `envoi-propositions.json` couvre **tous** les types.
> `rappel-anniversaire.json` et `rappel-noel.json` en sont des **spécialisations** (un seul type),
> utiles si on veut piloter/throttler un type indépendamment.
>
> ⚠️ **N'activez pas le générique ET une spécialisation pour le même type** : vous enverriez
> des e-mails en double. Choisissez **soit** le générique seul, **soit** l'ensemble des
> spécialisations par type.

### Pipeline commun (identique dans les 3)

```
Cron 8h00
  → Supabase GET /rest/v1/evenements (actifs [+ filtre type])      [HTTP Request]
  → Éclater le tableau en 1 item par événement                     [Split Out]
  → Calcul de la prochaine date + filtre J-30 / J-14 / J-7         [Code node]
  → POST /functions/v1/matching  → 5 propositions { produit_id, score }  [HTTP Request]
  → Supabase GET /rest/v1/produits?id=in.(...)  → nom, prix, url    [HTTP Request]
  → Composer sujet + HTML (template §9) + lignes de log            [Code node]
  → IF au moins 1 proposition
       → POST https://api.resend.com/emails                        [HTTP Request]
       → POST /rest/v1/propositions (log, envoyee_le = now())      [HTTP Request]
```

---

## Calcul des dates d'événements (§8)

Fait dans le **Code node** « Filtre J-30 / J-14 / J-7 » de chaque workflow. On calcule la
**prochaine occurrence** de l'événement, puis on ne garde que les items à exactement 30, 14
ou 7 jours.

| Type | Règle implémentée |
|---|---|
| `anniversaire` | Jour/mois de `proches.date_naissance`, prochaine occurrence (année courante ou suivante). |
| `noel` | 25 décembre, prochaine occurrence. |
| `saint_valentin` | 14 février, prochaine occurrence. |
| `fete_meres` | **1er dimanche de juin** (suit CLAUDE.md §8). |
| `fete_peres` | 3ᵉ dimanche de juin. |
| `fete_grands_parents` | 1er dimanche d'octobre. |
| `autre` | `evenements.date_fixe` (jour/mois, prochaine occurrence). |

Les fêtes mobiles utilisent un helper `niemeDimanche(annee, mois, n)` qui renvoie le Nᵉ
dimanche du mois. Seul le **workflow générique** gère tous les types ; les spécialisations
ne calculent que la date de leur type (`date_naissance` pour anniversaire, 25/12 pour Noël).

> Note : la spec §8 dit « 1er dimanche de juin » pour la fête des mères. La règle légale FR
> est plutôt « dernier dimanche de mai (reporté en juin si Pentecôte) » — on suit **strictement
> le CLAUDE.md** ; à ajuster ici si la règle légale est préférée.

---

## Credentials / variables d'environnement à configurer dans N8n

Les secrets ne sont **jamais en dur** : ils sont référencés via des variables d'environnement
N8n (`={{ $env.NOM }}`). À définir sur l'instance N8n (fichier `.env` de N8n, ou
`Settings → Variables` selon l'offre) :

| Variable N8n | Valeur | Usage |
|---|---|---|
| `SUPABASE_URL` | `https://lhhysivbcxrgdcbgtuve.supabase.co` | Base URL REST + Edge Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key Supabase | `apikey` + `Authorization: Bearer` (bypass RLS pour la lecture serveur et le log) |
| `RESEND_API_KEY` | `re_...` | `Authorization: Bearer` vers `api.resend.com` |
| `RESEND_FROM` | ex. `GiftMatch <hello@votre-domaine.fr>` | Champ `from` de l'e-mail (domaine vérifié chez Resend) |
| `RESEND_FALLBACK_TO` | ex. `pierremassonmot@gmail.com` | Destinataire de repli (voir point d'attention email ci-dessous) |
| `APP_URL` | ex. `https://giftmatch.app` | Lien « Voir d'autres idées → » |

> Alternative : remplacer les en-têtes `Authorization`/`apikey` par des **credentials N8n**
> (Header Auth) au lieu de `$env`, si vous préférez le coffre de credentials N8n. La structure
> des nodes reste identique ; il suffit de basculer `Authentication` sur le credential.

---

## ⚠️ Point d'attention : adresse e-mail du destinataire

Le destinataire d'un e-mail est **l'utilisateur** (le propriétaire du proche), pas le proche.
Son e-mail vit dans `auth.users.email`, **pas** dans la table `profils` (qui n'a que
`prenom`/`nom`). L'embed PostgREST `proches(...profils(prenom,nom))` **ne ramène donc pas
l'e-mail**, et le Code node retombe actuellement sur `RESEND_FALLBACK_TO`.

Trois façons de fournir le vrai e-mail (à trancher avec l'agent BDD) :

1. **Ajouter une colonne `email` à `profils`** (dénormalisée, alimentée à l'inscription) — la
   plus simple côté N8n : ajouter `email` au `select` de `profils(...)` et l'embed la ramène.
2. **Vue/RPC SQL** exposant `user_id → email` (jointure `auth.users`), appelée en plus.
3. **Endpoint Admin Auth** `GET /auth/v1/admin/users/{user_id}` (service role) en node HTTP
   supplémentaire avant la composition.

Tant que ce n'est pas branché, configurez `RESEND_FALLBACK_TO` pour tester de bout en bout.

---

## Importer dans N8n

1. N8n → **Workflows → Import from File** → sélectionner le `.json`.
2. Définir les variables d'environnement ci-dessus (ou créer les credentials Header Auth).
3. Vérifier le node **Cron** (8h00, fuseau du serveur N8n — régler le timezone de l'instance).
4. **Tester à blanc** : exécuter manuellement (« Execute Workflow ») ; ajuster temporairement
   les seuils `[30, 14, 7]` du Code node pour matcher une date proche d'un événement de test.
5. Quand tout est vert, passer `active` à `true` (un seul des deux schémas : générique **ou**
   spécialisations).

> Le format des nodes (`typeVersion`, noms de paramètres comme `scheduleTrigger`, `splitOut`,
> `httpRequest` v4.2, `if` v2.2, `code` v2) cible une **N8n récente**. À l'import sur une version
> différente, N8n peut signaler un node à re-mapper : ouvrir le node, re-sélectionner le type
> équivalent, les paramètres restent lisibles. Rien de bloquant, juste un éventuel ajustement
> cosmétique à l'import.
