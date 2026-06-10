import Link from "next/link";
import { CalendarHeart, Gift, LogOut, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { Button, buttonVariants } from "@/components/ui/button";
import { ProcheCard } from "@/components/ProcheCard";
import { prochaineDateEvenement } from "@/lib/evenements";

// Espace utilisateur : liste de ses proches. Server Component (RLS filtre déjà
// les lignes par user_id, mais on est aussi protégé par le middleware).
export default async function DashboardPage() {
  const supabase = createClient();

  // On récupère les proches avec leurs événements actifs (pour le décompte et le
  // tri par prochain événement).
  const { data: proches, error } = await supabase
    .from("proches")
    .select("*, evenements(id, type, date_fixe, actif)")
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

  // Tri (bonus §) : on remonte les proches dont le prochain événement actif est le
  // plus proche. Ceux sans événement passent en fin de liste. Calcul des dates en lib.
  const aujourdhui = new Date();
  const prochaineDateProche = (
    evenements: { type: string; date_fixe: string | null; actif: boolean | null }[],
    dateNaissance: string,
  ): number => {
    const dates = evenements
      .filter((ev) => ev.actif !== false)
      .map((ev) => prochaineDateEvenement(ev.type, dateNaissance, ev.date_fixe, aujourdhui))
      .filter((d): d is Date => d !== null)
      .map((d) => d.getTime());
    return dates.length > 0 ? Math.min(...dates) : Number.POSITIVE_INFINITY;
  };
  const prochesTries = [...proches].sort(
    (a, b) =>
      prochaineDateProche(a.evenements, a.date_naissance) -
      prochaineDateProche(b.evenements, b.date_naissance),
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Gift className="h-7 w-7" />
          <span className="text-2xl font-bold">GiftMatch</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/evenements"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <CalendarHeart className="h-4 w-4" />
            Événements
          </Link>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </Button>
          </form>
        </div>
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
          {prochesTries.map((proche) => (
            <ProcheCard
              key={proche.id}
              proche={proche}
              nbEvenements={proche.evenements?.length ?? 0}
            />
          ))}
        </div>
      )}
    </main>
  );
}
