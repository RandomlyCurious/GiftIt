import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { buttonVariants } from "@/components/ui/button";
import { HistoriquePropositionItem } from "@/components/HistoriquePropositionItem";

// US-A2 : historique des propositions reçues pour un proche (lecture seule sur
// `propositions`). Les actions "offert" (A3) et satisfaction (A4) se font par
// ligne via le composant client HistoriquePropositionItem.
export default async function HistoriqueProchePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: proche, error: erreurProche } = await supabase
    .from("proches")
    .select("id, prenom")
    .eq("id", params.id)
    .maybeSingle();

  if (erreurProche) {
    console.error(erreurProche);
  }
  if (!proche) {
    notFound();
  }

  const { data: propositions, error } = await supabase
    .from("propositions")
    .select(
      "id, score, choisie, offert, retour_satisfaction, created_at, produits(nom, prix_min, prix_max)",
    )
    .eq("proche_id", proche.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/proches/${proche.id}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la fiche
      </Link>

      <h1 className="mb-6 text-2xl font-bold">
        Historique des propositions — {proche.prenom}
      </h1>

      {!propositions || propositions.length === 0 ? (
        <p className="text-muted-foreground">
          Aucune proposition n&apos;a encore été générée pour {proche.prenom}.
        </p>
      ) : (
        <div className="space-y-3">
          {propositions.map((p) => {
            // PostgREST renvoie la relation to-one comme objet, mais on sécurise.
            const produit = Array.isArray(p.produits)
              ? p.produits[0]
              : p.produits;
            return (
              <HistoriquePropositionItem
                key={p.id}
                id={p.id}
                produitNom={produit?.nom ?? "Produit"}
                prixMin={produit?.prix_min ?? null}
                prixMax={produit?.prix_max ?? null}
                score={p.score}
                choisie={p.choisie}
                offertInitial={p.offert}
                satisfactionInitiale={p.retour_satisfaction}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
