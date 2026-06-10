import Image from "next/image";
import { ImageOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrix } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type Produit = Database["public"]["Tables"]["produits"]["Row"];

type SwipeCardProps = {
  produit: Produit;
  // Slugs des tags du produit (affichés en bas de carte).
  tags: string[];
};

// Carte produit présentée pendant une session de swipe.
export function SwipeCard({ produit, tags }: SwipeCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-square w-full bg-muted">
        {produit.url_image ? (
          <Image
            src={produit.url_image}
            alt={produit.nom}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-12 w-12" />
          </div>
        )}
      </div>

      <CardContent className="space-y-3 p-5">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {produit.categorie}
          </p>
          <h2 className="text-xl font-semibold leading-tight">{produit.nom}</h2>
          <p className="text-sm font-medium text-primary">
            {formatPrix(produit.prix_min, produit.prix_max)}
          </p>
        </div>

        {produit.description && (
          <p className="text-sm text-muted-foreground">{produit.description}</p>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
