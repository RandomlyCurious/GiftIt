import Link from "next/link";
import { ArrowLeft, CalendarHeart, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatDateFr,
  joursAvant,
  libelleEvenement,
  prochaineDateEvenement,
} from "@/lib/evenements";

// Choix du badge de délai en fonction du nombre de jours restants (§8 : 30/14/7).
function badgeDelai(jours: number): { texte: string; classe: string } {
  if (jours <= 7) return { texte: "J-7", classe: "bg-destructive/10 text-destructive" };
  if (jours <= 14) return { texte: "J-14", classe: "bg-primary/10 text-primary" };
  if (jours <= 30) return { texte: "J-30", classe: "bg-muted text-muted-foreground" };
  return { texte: `dans ${jours} jours`, classe: "bg-muted text-muted-foreground" };
}

// Agenda des événements à venir de TOUS les proches de l'utilisateur.
// Server Component : RLS limite déjà les proches/événements à l'utilisateur.
export default async function EvenementsPage() {
  const supabase = createClient();
  const aujourdhui = new Date();

  // Événements actifs, joints au proche (prénom + date de naissance pour l'anniversaire).
  const { data: evenements, error } = await supabase
    .from("evenements")
    .select("id, type, date_fixe, proche_id, proches(prenom, date_naissance)")
    .eq("actif", true);

  if (error) {
    console.error(error);
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-destructive">
          Impossible de charger vos événements. Réessayez plus tard.
        </p>
      </main>
    );
  }

  // Calcul de la prochaine date de chaque événement, puis tri par date croissante.
  // La logique de calcul vit en lib (§11), la page ne fait qu'orchestrer.
  const lignes = (evenements ?? [])
    .map((ev) => {
      const proche = ev.proches;
      const date = prochaineDateEvenement(
        ev.type,
        proche?.date_naissance ?? null,
        ev.date_fixe,
        aujourdhui,
      );
      return { ev, proche, date };
    })
    .filter((ligne): ligne is typeof ligne & { date: Date } => ligne.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au tableau de bord
      </Link>

      <div className="mb-6 flex items-center gap-2">
        <CalendarHeart className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Événements à venir</h1>
      </div>

      {lignes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <CalendarHeart className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="mb-4 text-muted-foreground">
            Aucun événement à venir. Ajoutez un événement à l&apos;un de vos
            proches pour recevoir des idées cadeaux au bon moment.
          </p>
          <Link href="/dashboard" className={buttonVariants()}>
            Voir mes proches
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {lignes.map(({ ev, proche, date }) => {
            const jours = joursAvant(date, aujourdhui);
            const badge = badgeDelai(jours);
            return (
              <li key={ev.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {libelleEvenement(ev.type)} de {proche?.prenom ?? "ce proche"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateFr(date)}
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-xs ${badge.classe}`}
                        >
                          {badge.texte}
                        </span>
                      </p>
                    </div>
                    <Link
                      href={`/proches/${ev.proche_id}/propositions?evenement=${ev.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <Gift className="h-4 w-4" />
                      Voir des idées
                    </Link>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
