# supabase/functions/matching/

Edge Function de l'algorithme de matching (`index.ts`). Calcule un score de similarité cosinus
entre le vecteur de goûts d'un proche et le vecteur de tags des produits, et renvoie les N meilleures
propositions (cf. section 4 du CLAUDE.md). La mise à jour du vecteur de goûts après un swipe se fait
côté frontend dans `src/lib/swipe.ts`, pas ici.

Responsable : **Agent Backend**.
