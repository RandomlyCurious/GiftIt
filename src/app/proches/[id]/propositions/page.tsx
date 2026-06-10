"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PropositionCard } from "@/components/PropositionCard";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Database } from "@/types/database.types";

type Produit = Database["public"]["Tables"]["produits"]["Row"];

// Une proposition = un produit + son score de matching.
type Proposition = { produit: Produit; score: number };

// Forme du retour de l'Edge Function `matching` (CLAUDE.md §4).
type RetourMatching = {
  propositions?: { produit_id: string; score: number }[];
  // Selon le cas, l'Edge Function peut signaler un proche non calibré.
  calibre?: boolean;
  message?: string;
};

export default function PropositionsPage() {
  const params = useParams<{ id: string }>();
  const procheId = params.id;
  const searchParams = useSearchParams();
  const evenementId = searchParams.get("evenement");

  const [propositions, setPropositions] = useState<Proposition[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [avertissement, setAvertissement] = useState<string | null>(null);
  // Ids des produits déjà marqués comme choisis (feedback visuel).
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  // Id du produit dont l'enregistrement "choisi" est en cours.
  const [enregistrement, setEnregistrement] = useState<string | null>(null);

  // Appelle l'Edge Function de matching puis charge les produits correspondants.
  const charger = useCallback(async () => {
    if (!evenementId) {
      setErreur("Aucun événement sélectionné.");
      setChargement(false);
      return;
    }

    setChargement(true);
    setErreur(null);
    setAvertissement(null);

    // 1. Génération des propositions par l'Edge Function (JWT joint automatiquement).
    const { data, error } = await supabase.functions.invoke<RetourMatching>("matching", {
      body: { proche_id: procheId, evenement_id: evenementId, nb_propositions: 5 },
    });
    if (error) {
      console.error(error);
      setErreur("Impossible de générer des propositions pour le moment.");
      setChargement(false);
      return;
    }

    if (data?.calibre === false) {
      setAvertissement(
        "Ce proche n'est pas encore calibré (moins de 5 swipes). Les propositions ci-dessous restent approximatives.",
      );
    }

    const brutes = data?.propositions ?? [];
    if (brutes.length === 0) {
      setPropositions([]);
      setChargement(false);
      return;
    }

    // 2. Récupération des détails des produits proposés en un seul select.
    const ids = brutes.map((p) => p.produit_id);
    const { data: produits, error: erreurProduits } = await supabase
      .from("produits")
      .select("*")
      .in("id", ids);
    if (erreurProduits) {
      console.error(erreurProduits);
      setErreur("Impossible de charger les produits proposés.");
      setChargement(false);
      return;
    }

    // 3. On associe chaque produit à son score, puis on trie par score décroissant.
    const scoreParId = new Map(brutes.map((p) => [p.produit_id, p.score]));
    const liste: Proposition[] = (produits ?? [])
      .map((produit) => ({ produit, score: scoreParId.get(produit.id) ?? 0 }))
      .sort((a, b) => b.score - a.score);

    setPropositions(liste);
    setChargement(false);
  }, [procheId, evenementId]);

  useEffect(() => {
    charger();
  }, [charger]);

  // Marque un produit comme choisi : insert dans `propositions` (§3).
  const handleChoisir = useCallback(
    async (produit: Produit, score: number) => {
      if (!evenementId || enregistrement) return;
      setEnregistrement(produit.id);
      setErreur(null);

      const { error } = await supabase.from("propositions").insert({
        proche_id: procheId,
        evenement_id: evenementId,
        produit_id: produit.id,
        score,
        choisie: true,
      });
      if (error) {
        console.error(error);
        setErreur("Impossible d'enregistrer ce choix.");
        setEnregistrement(null);
        return;
      }

      setChoisis((prec) => new Set(prec).add(produit.id));
      setEnregistrement(null);
    },
    [procheId, evenementId, enregistrement],
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href={`/proches/${procheId}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la fiche
      </Link>

      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Idées cadeaux</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={charger}
          disabled={chargement || !evenementId}
        >
          <RefreshCw className="h-4 w-4" />
          Régénérer
        </Button>
      </div>

      {avertissement && (
        <p className="mb-4 rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          {avertissement}
        </p>
      )}

      {erreur && (
        <p className="mb-4 text-sm text-destructive">{erreur}</p>
      )}

      {chargement ? (
        <p className="py-20 text-center text-muted-foreground">
          Génération des propositions…
        </p>
      ) : propositions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="mb-4 text-muted-foreground">
            Aucune proposition pour le moment. Swipez davantage de produits pour
            ce proche afin d&apos;affiner ses goûts.
          </p>
          <Link href={`/swipe/${procheId}`} className={buttonVariants()}>
            Lancer une session de swipe
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {propositions.map(({ produit, score }) => (
            <PropositionCard
              key={produit.id}
              produit={produit}
              score={score}
              choisie={choisis.has(produit.id)}
              onChoisir={handleChoisir}
              enregistrement={enregistrement === produit.id}
            />
          ))}
        </div>
      )}
    </main>
  );
}
