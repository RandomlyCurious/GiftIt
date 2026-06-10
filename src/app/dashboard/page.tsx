import Link from "next/link";
import { Gift, LogOut, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { Button, buttonVariants } from "@/components/ui/button";
import { ProcheCard } from "@/components/ProcheCard";

// Espace utilisateur : liste de ses proches. Server Component (RLS filtre déjà
// les lignes par user_id, mais on est aussi protégé par le middleware).
export default async function DashboardPage() {
  const supabase = createClient();

  // On récupère les proches avec le nombre d'événements associés (count).
  const { data: proches, error } = await supabase
    .from("proches")
    .select("*, evenements(count)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-destructive">
          Impossible de charger vos proches. Réessayez plus tard.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Gift className="h-7 w-7" />
          <span className="text-2xl font-bold">GiftMatch</span>
        </div>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="ghost" size="sm">
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </Button>
        </form>
      </header>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mes proches</h1>
        <Link href="/proches/nouveau" className={buttonVariants({ size: "sm" })}>
          <Plus className="h-4 w-4" />
          Ajouter un proche
        </Link>
      </div>

      {proches.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Gift className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="mb-4 text-muted-foreground">
            Vous n&apos;avez pas encore ajouté de proche. Commencez dès maintenant
            pour trouver le cadeau idéal.
          </p>
          <Link href="/proches/nouveau" className={buttonVariants()}>
            <Plus className="h-4 w-4" />
            Ajouter mon premier proche
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {proches.map((proche) => {
            // Le count arrive sous la forme [{ count: n }] via PostgREST.
            const nbEvenements = proche.evenements?.[0]?.count ?? 0;
            return (
              <ProcheCard
                key={proche.id}
                proche={proche}
                nbEvenements={nbEvenements}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
