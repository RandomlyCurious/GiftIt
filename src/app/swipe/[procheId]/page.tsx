"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, ThumbsDown, ThumbsUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { enregistrerSwipe, type Direction } from "@/lib/swipe";
import { SwipeCard } from "@/components/SwipeCard";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Database } from "@/types/database.types";

type Produit = Database["public"]["Tables"]["produits"]["Row"];

// Produit enrichi de la liste des slugs de ses tags.
type ProduitAvecTags = Produit & { tags: string[] };

export default function SwipePage() {
  const params = useParams<{ procheId: string }>();
  const procheId = params.procheId;

  const [pile, setPile] = useState<ProduitAvecTags[]>([]);
  const [indexCourant, setIndexCourant] = useState(0);
  const [nbSwipes, setNbSwipes] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Chargement initial : nb_swipes actuel + produits non encore swipés.
  useEffect(() => {
    async function charger() {
      setChargement(true);

      // Compteur de swipes du proche (pour l'indicateur de calibration).
      const { data: proche, error: erreurProche } = await supabase
        .from("proches")
        .select("nb_swipes")
        .eq("id", procheId)
        .single();
      if (erreurProche) {
        console.error(erreurProche);
        setErreur("Impossible de charger ce proche.");
        setChargement(false);
        return;
      }
      setNbSwipes(proche?.nb_swipes ?? 0);

      // Cartes PERTINENTES pour ce proche (embedding + repli) via l'Edge Function.
      // Elle exclut déjà les produits swipés et ordonne par pertinence.
      const { data: cartes, error: errCartes } = await supabase.functions.invoke<{
        produit_ids: string[];
      }>("generate-swipe-cards", {
        body: { proche_id: procheId },
      });
      if (errCartes) {
        console.error(errCartes);
        setErreur("Impossible de charger les idées à swiper.");
        setChargement(false);
        return;
      }
      const idsOrdonnes = cartes?.produit_ids ?? [];
      if (idsOrdonnes.length === 0) {
        setPile([]);
        setIndexCourant(0);
        setChargement(false);
        return;
      }

      // Détails + tags, en préservant l'ordre de pertinence renvoyé.
      const { data: produits, error: erreurProduits } = await supabase
        .from("produits")
        .select("*, produit_tags(tag_slug)")
        .in("id", idsOrdonnes);
      if (erreurProduits) {
        console.error(erreurProduits);
        setErreur("Impossible de charger les produits.");
        setChargement(false);
        return;
      }
      const parId = new Map((produits ?? []).map((p) => [p.id, p]));
      const pileEnrichie: ProduitAvecTags[] = idsOrdonnes
        .map((id) => parId.get(id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p) => {
          const { produit_tags, ...produit } = p;
          return { ...produit, tags: (produit_tags ?? []).map((t) => t.tag_slug) };
        });

      setPile(pileEnrichie);
      setIndexCourant(0);
      setChargement(false);
    }

    charger();
  }, [procheId]);

  const handleSwipe = useCallback(
    async (direction: Direction) => {
      const produit = pile[indexCourant];
      if (!produit || enCours) return;

      setEnCours(true);
      setErreur(null);

      const { error } = await enregistrerSwipe(
        procheId,
        produit.id,
        direction,
        produit.tags,
      );
      if (error) {
        setErreur(error);
        setEnCours(false);
        return;
      }

      setNbSwipes((n) => n + 1);
      setIndexCourant((i) => i + 1);
      setEnCours(false);
    },
    [pile, indexCourant, enCours, procheId],
  );

  const calibre = nbSwipes >= 5;
  const produitCourant = pile[indexCourant];
  const pileTerminee = !chargement && !produitCourant;

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link
        href={`/proches/${procheId}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la fiche
      </Link>

      {/* Indicateur de progression / calibration. */}
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {chargement
            ? "Chargement…"
            : pileTerminee
              ? `${nbSwipes} swipe${nbSwipes > 1 ? "s" : ""}`
              : `Carte ${indexCourant + 1} / ${pile.length}`}
        </span>
        {calibre && (
          <span className="flex items-center gap-1 text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Calibré !
          </span>
        )}
      </div>

      {chargement ? (
        <p className="py-20 text-center text-muted-foreground">Chargement des idées…</p>
      ) : pileTerminee ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary" />
          <p className="mb-1 font-medium">
            {pile.length === 0
              ? "Vous avez déjà tout swipé pour ce proche."
              : "Pile terminée, bravo !"}
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            {calibre
              ? "Le profil est calibré : les prochaines propositions seront affinées."
              : "Continuez plus tard pour atteindre la calibration (5 swipes)."}
          </p>
          <Link href={`/proches/${procheId}`} className={buttonVariants()}>
            Retour à la fiche
          </Link>
        </div>
      ) : (
        <>
          <SwipeCard produit={produitCourant} tags={produitCourant.tags} />

          {erreur && (
            <p className="mt-3 text-center text-sm text-destructive">{erreur}</p>
          )}

          <div className="mt-5 flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              size="lg"
              onClick={() => handleSwipe("gauche")}
              disabled={enCours}
            >
              <ThumbsDown className="h-5 w-5" />
              Pas pour lui/elle
            </Button>
            <Button
              className="flex-1"
              size="lg"
              onClick={() => handleSwipe("droite")}
              disabled={enCours}
            >
              <ThumbsUp className="h-5 w-5" />
              Ça lui plairait
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
