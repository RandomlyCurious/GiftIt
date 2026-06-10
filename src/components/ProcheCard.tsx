import Link from "next/link";
import { CheckCircle2, Gift } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Database } from "@/types/database.types";

type Proche = Database["public"]["Tables"]["proches"]["Row"];

// Libellés lisibles pour le type de relation (la base stocke un slug).
const LIBELLE_RELATION: Record<string, string> = {
  conjoint: "Conjoint·e",
  enfant: "Enfant",
  parent: "Parent",
  grand_parent: "Grand-parent",
  ami: "Ami·e",
  collegue: "Collègue",
  autre: "Autre",
};

type ProcheCardProps = {
  proche: Proche;
  nbEvenements?: number;
};

// Carte résumé d'un proche, cliquable vers sa fiche.
export function ProcheCard({ proche, nbEvenements = 0 }: ProcheCardProps) {
  return (
    <Link href={`/proches/${proche.id}`} className="block">
      <Card className="h-full transition-colors hover:bg-muted">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span>
              {proche.prenom} {proche.nom ?? ""}
            </span>
            {proche.calibre && (
              <span className="flex items-center gap-1 text-xs font-normal text-primary">
                <CheckCircle2 className="h-4 w-4" />
                Calibré
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{LIBELLE_RELATION[proche.relation] ?? proche.relation}</p>
          <p className="flex items-center gap-1">
            <Gift className="h-4 w-4" />
            {nbEvenements} événement{nbEvenements > 1 ? "s" : ""}
          </p>
          {!proche.calibre && (
            <p className="text-xs">
              Calibration : {proche.nb_swipes ?? 0} / 5 swipes
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
