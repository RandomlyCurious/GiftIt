# GiftMatch — Spécifications Fonctionnelles v1.0

> Document de référence produit · Juin 2026  
> **Statut** : Draft v1.0 · **Cible** : Grand public (B2C) · **Plateformes** : Web responsive + Mobile · **Phase** : Idée à formaliser — 0 dev

---

## 1. Contexte & Vision Produit

### 1.1 Problème adressé

Trouver un cadeau adapté à un proche reste une tâche chronophage et souvent anxiogène. Les solutions actuelles (listes de souhaits, moteurs de recherche généralistes) ne proposent pas de personnalisation intelligente ni de rappels proactifs liés aux événements de la vie.

### 1.2 Vision

GiftMatch est une application B2C permettant à tout utilisateur de gérer ses proches, de découvrir leurs goûts via un mécanisme de swipe ludique, puis de recevoir — au bon moment — une sélection de cadeaux parfaitement adaptée à chaque événement et à chaque budget.

### 1.3 Proposition de valeur

- Gain de temps : plus besoin de chercher, les propositions arrivent automatiquement
- Pertinence : algorithme de matching par tags entre profil et catalogue produits
- Proactivité : notifications et e-mails déclenchés avant chaque événement
- Monétisation non-intrusive : liens affiliés et partenariats discrets

---

## 2. Périmètre — MVP v1

Le MVP couvre trois modules principaux :

- **Module Proches** — gestion du carnet de proches
- **Module Découverte** — swipe de cadeaux pour calibrer les goûts
- **Module Événements** — rappels et propositions automatiques

> ⚠️ Les fonctionnalités avancées (budget, achat automatisé, logistique) sont hors périmètre MVP et documentées en section 7 — Roadmap.

---

## 3. Spécifications Fonctionnelles

### 3.1 Compte Utilisateur

#### 3.1.1 Inscription / Connexion

- Inscription via e-mail + mot de passe ou OAuth (Google / Apple)
- Vérification de l'adresse e-mail obligatoire
- Récupération de mot de passe par e-mail
- Profil utilisateur : prénom, nom, avatar (optionnel), langue, fuseau horaire

### 3.2 Gestion des Proches

#### 3.2.1 Ajout d'un proche

| Champ | Type | Contraintes |
|---|---|---|
| Prénom | Texte | Obligatoire, max 50 car. |
| Nom | Texte | Optionnel, max 50 car. |
| Date de naissance | Date | Obligatoire (calcul anniversaire) |
| Lien de relation | Enum | Conjoint·e, Enfant, Parent, Ami·e, Collègue, Autre |
| Adresse postale | Texte | Optionnel — utilisé phase logistique (v2) |
| Tags descriptifs | Multi-select + libre | Ex : sport, lecture, high-tech, cuisine, musique |
| Photo | Image | Optionnel, avatar par défaut |
| Événements associés | Multi-select | Anniversaire, Noël, Fête des mères/pères/grands-parents, Saint-Valentin, Autre |

#### 3.2.2 Modification / Suppression

- Modification de tous les champs à tout moment
- Suppression avec confirmation (modale) — supprime aussi les événements et l'historique de swipe associés
- Affichage de la liste des proches triée par prochain événement

### 3.3 Module Découverte — Calibration des Goûts

#### 3.3.1 Principe

À la création d'un proche ou à la demande de l'utilisateur, une session de swipe est proposée. L'utilisateur évalue 10 à 15 cadeaux par glissement (droite = ça lui plairait / gauche = ça ne lui convient pas) afin d'alimenter le vecteur de goûts du proche.

#### 3.3.2 Carte cadeau (contenu affiché)

- Photo du produit
- Nom du produit + catégorie
- Prix indicatif
- Tags associés au produit (visibles ou masqués — à décider en UX)

#### 3.3.3 Algorithme de matching — Système de Tags

Chaque produit du catalogue est annoté d'un ensemble de tags (ex : sport, outdoor, tech, lecture, creatif, gourmet…). Chaque proche possède un vecteur de goûts construit à partir de :

- Tags définis manuellement à la création de la fiche (poids initial : 1.0)
- Tags des cadeaux swipés à droite (poids +0.5 par swipe positif)
- Tags des cadeaux swipés à gauche (poids -0.3 par swipe négatif)

Le score de matching entre un produit et un proche est calculé par la **similarité cosinus** entre le vecteur de tags normalisé du proche et le vecteur binaire de tags du produit.

> 📌 L'algorithme exact (similarité cosinus, distance euclidienne, ou modèle ML supervisé) sera affiné lors du sprint de conception technique. Ce document pose la logique métier de base.

#### 3.3.4 Re-calibration

- L'utilisateur peut relancer une session de swipe à tout moment depuis la fiche d'un proche
- Minimum 5 swipes pour activer les propositions automatiques
- Indicateur de progression visible (ex : barre ou score de confiance)

### 3.4 Gestion des Événements & Notifications

#### 3.4.1 Calendrier des événements

| Événement | Calcul de date |
|---|---|
| Anniversaire | Calculé chaque année depuis `date_naissance` |
| Noël | 25 décembre |
| Fête des mères | 1er dimanche de juin (France — localisable) |
| Fête des pères | 3ème dimanche de juin (France — localisable) |
| Fête des grands-parents | 1er dimanche d'octobre (France — localisable) |
| Autre | Date fixe définie par l'utilisateur |

#### 3.4.2 Rappels & envoi des propositions

| Délai avant événement | Canal | Contenu |
|---|---|---|
| J-30 | E-mail | Rappel : événement dans 1 mois — panel de 5 idées cadeaux |
| J-14 | E-mail + Push | Rappel : plus que 2 semaines — mise à jour des propositions |
| J-7 | Push | Dernière chance — 5 propositions finales avec liens directs |

#### 3.4.3 Panel de propositions

- 5 cadeaux sélectionnés par l'algorithme de matching
- Chaque proposition affiche : photo, nom, prix, lien vers site marchand
- Lien de redirection via lien affilié (quand disponible)
- Possibilité de régénérer le panel (bouton « Voir d'autres idées »)
- Possibilité de marquer une idée comme « choisie » pour éviter les doublons futurs

---

## 4. Catalogue Produits

### 4.1 Sources de données

- **Phase 1 (MVP)** : catalogue éditorial curé manuellement (~200 à 500 produits), tagués et catégorisés
- **Phase 2** : intégration d'API partenaires (Amazon PA API, Cdiscount, Fnac…) pour catalogue dynamique

### 4.2 Structure d'un produit

| Champ | Type | Description |
|---|---|---|
| id | UUID | Identifiant unique |
| nom | Texte | Nom du produit |
| description | Texte long | Description courte (max 200 car.) |
| tags | Array\<string\> | Liste de tags normalisés |
| categorie | Enum | High-tech, Loisirs, Mode, Gastronomie, Sport, Bien-être, Culture, Autre |
| prix_min / prix_max | Float | Fourchette de prix en € |
| url_produit | URL | Lien vers le site marchand |
| url_image | URL | Image principale |
| affilie | Boolean | Lien affilié disponible |
| actif | Boolean | Visible dans le catalogue swipe |

### 4.3 Règles de gestion du catalogue

- Un produit doit avoir au minimum 3 tags pour être intégré au swipe
- Les produits sans lien affilié sont proposés mais sans tracking
- Un produit déjà swipé par l'utilisateur pour un proche n'est pas reproposé dans la même session

---

## 5. Architecture Technique

> ⚠️ La stack ci-dessous est celle du CdC initial. La stack réelle retenue est définie dans CLAUDE.md — c'est CLAUDE.md qui prime.

### 5.2 Sécurité & conformité

- Authentification via Supabase Auth
- Chiffrement des données sensibles (adresses postales) au repos
- Conformité RGPD : droit à l'effacement, export des données, consentement explicite pour les communications
- Politique de confidentialité et CGU à rédiger avant lancement

---

## 6. Modèle de Monétisation

### 6.1 Phase MVP — Gratuit

- Liens affiliés : commission sur les ventes générées via les redirections (Amazon Associates, Awin, etc.)
- Partenariats marques : mise en avant de produits partenaires dans le panel de propositions (labellisé « Suggéré »)

### 6.2 Phase 2 — Freemium

| Fonctionnalité | Gratuit | Premium |
|---|---|---|
| Nombre de proches | Jusqu'à 5 | Illimité |
| Événements automatiques | Anniversaire + Noël | Tous les événements |
| Budget par proche | Non | Oui |
| Historique cadeaux offerts | 6 mois | Illimité |
| Achat intégré (v2) | Non | Oui |

---

## 7. Roadmap Produit

| Phase | Horizon | Fonctionnalités clés |
|---|---|---|
| MVP v1 | M1 – M6 | Compte utilisateur, gestion proches, swipe, algo matching v1, notifications e-mail, catalogue éditorial, liens affiliés |
| v1.5 | M7 – M9 | Push notifications, panel freemium, partenariats marques, refine algo matching |
| v2.0 | M10 – M14 | Budget annuel par proche/global, historique cadeaux, achat intégré, abonnement Premium |
| v2.5 | M15+ | Logistique automatisée, groupement d'achats entre proches, IA générative pour idées sur-mesure |

---

## 8. User Stories Prioritaires (MVP)

### Epic 1 — Gestion des proches

| # | User Story | Priorité | Complexité |
|---|---|---|---|
| US-01 | En tant qu'utilisateur, je veux ajouter un proche avec sa date de naissance et son lien de relation afin de planifier les événements. | Must | M |
| US-02 | En tant qu'utilisateur, je veux associer des tags à un proche pour que l'algo puisse lui proposer des cadeaux adaptés. | Must | S |
| US-03 | En tant qu'utilisateur, je veux modifier ou supprimer un proche à tout moment. | Must | S |

### Epic 2 — Découverte & Calibration

| # | User Story | Priorité | Complexité |
|---|---|---|---|
| US-04 | En tant qu'utilisateur, je veux swiper des cadeaux (gauche/droite) pour calibrer les goûts de mon proche. | Must | L |
| US-05 | En tant qu'utilisateur, je veux voir l'avancement de la calibration d'un proche. | Should | S |
| US-06 | En tant qu'utilisateur, je veux relancer une session de swipe pour affiner les goûts. | Should | M |

### Epic 3 — Événements & Propositions

| # | User Story | Priorité | Complexité |
|---|---|---|---|
| US-07 | En tant qu'utilisateur, je veux recevoir un e-mail 30 jours avant un événement avec 5 idées de cadeaux personnalisées. | Must | L |
| US-08 | En tant qu'utilisateur, je veux accéder directement au site marchand depuis l'application. | Must | S |
| US-09 | En tant qu'utilisateur, je veux régénérer le panel de propositions si aucune idée ne me convient. | Should | M |
| US-10 | En tant qu'utilisateur, je veux marquer un cadeau comme choisi pour ne plus le voir. | Should | S |

> Légende : Must = indispensable MVP | Should = important | Could = nice to have | S/M/L/XL = T-shirt sizing

---

## 9. Points Ouverts & Décisions à Prendre

| # | Question ouverte | Impact | Statut |
|---|---|---|---|
| PO-01 | Algorithme de matching final : similarité cosinus vs ML supervisé ? | Algo / Perf | A décider |
| PO-02 | Source du catalogue MVP : curation manuelle ou API tierce d'emblée ? | Planning / Budget | A arbitrer |
| PO-03 | Tags des cadeaux : liste fermée ou ouverte ? Qui les gère ? | Data / UX | A définir |
| PO-04 | Nom commercial de l'application : 'GiftMatch' ou autre ? | Marketing | A valider |
| PO-05 | Gestion multi-utilisateurs : plusieurs personnes peuvent-elles partager un proche ? | Périmètre MVP | Hors MVP — à confirmer |
| PO-06 | Régionalisation : fêtes localisées hors France dès le MVP ? | Internationalisation | Hors MVP recommandé |

---

## 10. Glossaire

| Terme | Définition |
|---|---|
| Proche | Personne enregistrée dans l'application pour laquelle on cherche un cadeau |
| Tag | Mot-clé descriptif attaché à un proche ou à un produit (ex : sport, lecture) |
| Vecteur de goûts | Représentation mathématique des préférences d'un proche sous forme de poids par tag |
| Swipe | Geste de balayage (gauche = non, droite = oui) pour noter un cadeau |
| Panel | Sélection de 5 cadeaux proposés pour un événement donné |
| Matching | Calcul de compatibilité entre le profil d'un proche et un produit |
| Lien affilié | URL trackée vers un site marchand permettant de générer une commission sur vente |
| MVP | Minimum Viable Product — version minimale fonctionnelle pour tester le marché |
