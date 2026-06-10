-- Seed : tags normalisés (table de référence `tags`)
-- Auteur : Agent Data — Date : 2026-06
--
-- But : alimenter la table `tags` avec la liste fermée des tags utilisés par
--       l'algo de matching (vecteur de goûts des proches <-> tags des cadeaux).
--       Ces slugs font foi : les seeds `cadeau_tags` et `proche_tags`, ainsi que
--       la Edge Function matching, s'appuient dessus. Toute évolution de tag se
--       fait ici en premier.
--
-- Colonnes insérées (cf. CLAUDE.md §3) : slug, libelle, categorie.
--   - id        : généré par DEFAULT gen_random_uuid() (ne pas fournir)
--   - slug      : snake_case, minuscule, sans accent, UNIQUE
--   - libelle   : forme lisible (majuscule + accents)
--   - categorie : l'une des 8 catégories du catalogue (CdC §4.2), en snake_case
--
-- Nombre de tags : 48
-- Catégories couvertes (8/8 du CdC §4.2) :
--   high_tech, loisirs, mode, gastronomie, sport, bien_etre, culture, autre
--
-- Idempotent : ON CONFLICT (slug) DO NOTHING permet de réexécuter le seed.

INSERT INTO tags (slug, libelle, categorie) VALUES
  -- High-tech
  ('high_tech',        'High-tech',           'high_tech'),
  ('jeux_video',       'Jeux vidéo',          'high_tech'),
  ('gadgets',          'Gadgets',             'high_tech'),
  ('audio',            'Audio & casques',     'high_tech'),
  ('photo',            'Photographie',        'high_tech'),
  ('domotique',        'Maison connectée',    'high_tech'),
  ('informatique',     'Informatique',        'high_tech'),

  -- Loisirs
  ('loisirs',          'Loisirs',             'loisirs'),
  ('jeux_societe',     'Jeux de société',     'loisirs'),
  ('bricolage',        'Bricolage',           'loisirs'),
  ('jardinage',        'Jardinage',           'loisirs'),
  ('voyage',           'Voyage',              'loisirs'),
  ('outdoor',          'Plein air',           'loisirs'),
  ('collection',       'Collection',          'loisirs'),

  -- Mode
  ('mode',             'Mode',                'mode'),
  ('mode_homme',       'Mode homme',          'mode'),
  ('mode_femme',       'Mode femme',          'mode'),
  ('bijoux',           'Bijoux',              'mode'),
  ('montres',          'Montres',             'mode'),
  ('maroquinerie',     'Maroquinerie',        'mode'),
  ('accessoires',      'Accessoires',         'mode'),

  -- Gastronomie
  ('gastronomie',      'Gastronomie',         'gastronomie'),
  ('cuisine',          'Cuisine',             'gastronomie'),
  ('vin',              'Vin',                 'gastronomie'),
  ('biere',            'Bière',               'gastronomie'),
  ('cafe_the',         'Café & thé',          'gastronomie'),
  ('chocolat',         'Chocolat',            'gastronomie'),
  ('epicerie_fine',    'Épicerie fine',       'gastronomie'),

  -- Sport
  ('sport',            'Sport',               'sport'),
  ('fitness',          'Fitness',             'sport'),
  ('running',          'Running',             'sport'),
  ('cyclisme',         'Cyclisme',            'sport'),
  ('randonnee',        'Randonnée',           'sport'),
  ('sports_collectifs','Sports collectifs',   'sport'),
  ('sports_nautiques', 'Sports nautiques',    'sport'),

  -- Bien-être
  ('bien_etre',        'Bien-être',           'bien_etre'),
  ('yoga',             'Yoga',                'bien_etre'),
  ('spa',              'Spa & détente',       'bien_etre'),
  ('cosmetique',       'Cosmétique',          'bien_etre'),
  ('parfum',           'Parfum',              'bien_etre'),
  ('meditation',       'Méditation',          'bien_etre'),

  -- Culture
  ('culture',          'Culture',             'culture'),
  ('lecture',          'Lecture',             'culture'),
  ('musique',          'Musique',             'culture'),
  ('cinema',           'Cinéma',              'culture'),
  ('art',              'Art',                 'culture'),

  -- Autre
  ('autre',            'Autre',               'autre'),
  ('ecologie',         'Écologie',            'autre')
ON CONFLICT (slug) DO NOTHING;
