# src/app/swipe/[procheId]/

Route dynamique : session de swipe pour le proche identifié par `procheId` (uuid).
Affiche les `SwipeCard`, enregistre chaque swipe (gauche/droite) et déclenche la mise à jour
du vecteur de goûts. Mécanisme central de calibration (calibré après 5 swipes).

Responsable : **Agent Frontend**.
