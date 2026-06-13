import Image from "next/image";
import { Check, ExternalLink, ImageOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatPrix } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type Produit = Database["public"]["Tables"]["produits"]["Row"];

type PropositionCardProps = {
  produit: Produit;
  // Score de matching renvoyé par l'Edge Function (0 à 1).
  score: number;
  // true si ce produit a déjà été marqué comme choisi.
  choisie?: boolean;
  // Appelé quand l'utilisateur clique sur "Marquer comme choisi".
  onChoisir?: (produit: Produit, score: number) => void;
  // Désactive le bouton "choisir" pendant un enregistrement en cours.
  enregistrement?: boolean;
  // Justification incarnée du moteur v2 ("parce qu'elle adore…"), si dispo.
  justification?: string | null;
};

// Carte d'un cadeau proposé pour un proche + un événement.
export function PropositionCard({
  produit,
  score,
  choisie = false,
  onChoisir,
  enregistrement = false,
  justification = null,
}: PropositionCardProps) {
  // Le score est une similarité 0–1, on l'affiche en pourcentage.
  const compatibilite = Math.round(Math.max(0, Math.min(1, score)) * 100);

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="relative aspect-square w-full bg-muted">
        {produit.url_image ? (
          <Image
            src={produit.url_image}
            alt={produit.nom}
            fill
            sizes="(max-width: 768px) 100vw, 300px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-12 w-12" />
          </div>
        )}
        <span className="absolute right-2 top-2 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
          Compatibilité {compatibilite}%
        </span>
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {produit.categorie}
          </p>
          <h3 className="text-lg font-semibold leading-tight">{produit.nom}</h3>
          <p className="text-sm font-medium text-primary">
            {formatPrix(produit.prix_min, produit.prix_max)}
          </p>
        </div>

        {justification ? (
          <p className="border-l-2 border-primary/60 pl-3 text-sm italic text-muted-foreground">
            {justification}
          </p>
        ) : (
          produit.description && (
            <p className="line-clamp-3 text-sm text-muted-foreground">
              {produit.description}
            </p>
          )
        )}

        {/* Actions poussées en bas de carte. */}
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <a
            href={produit.url_produit}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ExternalLink className="h-4 w-4" />
            Voir le produit
          </a>

          {choisie ? (
            <span className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary/10 px-3 text-sm font-medium text-primary">
              <Check className="h-4 w-4" />
              Choisi
            </span>
          ) : (
            <Button
              size="sm"
              onClick={() => onChoisir?.(produit, score)}
              disabled={enregistrement || !onChoisir}
            >
              Marquer comme choisi
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
