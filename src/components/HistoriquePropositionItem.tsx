"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn, formatPrix } from "@/lib/utils";
import { marquerOffert, enregistrerSatisfaction } from "@/lib/propositions";

// Un emoji par niveau de satisfaction (US-A4 : 1 tap).
const EMOJIS: Record<1 | 2 | 3, { emoji: string; libelle: string }> = {
  1: { emoji: "😞", libelle: "Déçu" },
  2: { emoji: "🙂", libelle: "Bien" },
  3: { emoji: "🤩", libelle: "Adoré" },
};

export type HistoriqueItemProps = {
  id: string;
  produitNom: string;
  prixMin: number | null;
  prixMax: number | null;
  score: number;
  choisie: boolean | null;
  offertInitial: boolean | null;
  satisfactionInitiale: number | null;
};

// US-A2/A3/A4 : une ligne d'historique de proposition, avec actions "offert" et
// retour de satisfaction. Optimiste (maj locale immédiate, persistance en fond).
export function HistoriquePropositionItem(props: HistoriqueItemProps) {
  const [offert, setOffert] = useState(Boolean(props.offertInitial));
  const [satisfaction, setSatisfaction] = useState<number | null>(
    props.satisfactionInitiale,
  );

  async function toggleOffert() {
    const suivant = !offert;
    setOffert(suivant);
    await marquerOffert(props.id, suivant);
  }

  async function noter(niveau: 1 | 2 | 3) {
    setSatisfaction(niveau);
    await enregistrerSatisfaction(props.id, niveau);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">{props.produitNom}</p>
        <p className="text-sm text-muted-foreground">
          {formatPrix(props.prixMin, props.prixMax)} · compatibilité{" "}
          {Math.round(props.score * 100)}%
          {props.choisie ? " · choisie" : ""}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggleOffert}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-3 py-1 text-sm transition-colors",
            offert
              ? "border-primary bg-primary text-primary-foreground"
              : "hover:bg-muted",
          )}
        >
          {offert && <Check className="h-3.5 w-3.5" />}
          {offert ? "Offert" : "Marquer offert"}
        </button>

        <div className="flex items-center gap-1">
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              title={EMOJIS[n].libelle}
              aria-label={EMOJIS[n].libelle}
              onClick={() => noter(n)}
              className={cn(
                "text-xl transition-opacity",
                satisfaction === n ? "opacity-100" : "opacity-40 hover:opacity-70",
              )}
            >
              {EMOJIS[n].emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
