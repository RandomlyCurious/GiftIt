# supabase/functions/matching/

Edge Function de l'algorithme de matching (`index.ts`). Calcule un score de similarité cosinus
entre le vecteur de goûts d'un proche et le vecteur de tags des cadeaux, et renvoie les N meilleures
propositions (cf. section 4 du CLAUDE.md). Met aussi à jour le vecteur de goûts après chaque swipe.

Responsable : **Agent Backend**.
