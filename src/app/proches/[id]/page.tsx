import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarHeart, CheckCircle2, Gift, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { libelleEvenement, prochaineDateEvenement } from "@/lib/evenements";

const LIBELLE_RELATION: Record<string, string> = {
  conjoint: "Conjoint·e",
  enfant: "Enfant",
  parent: "Parent",
  grand_parent: "Grand-parent",
  ami: "Ami·e",
  collegue: "Collègue",
  autre: "Autre",
};

// Fiche détaillée d'un proche. Server Component (RLS limite déjà à ses proches).
export default async function FicheProchePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  // Proche + ses tags + ses événements en une requête imbriquée.
  const { data: proche, error } = await supabase
    .from("proches")
    .select(
      "*, proche_tags(tag_slug, tags(libelle)), evenements(id, type, actif, date_fixe)",
    )
    .eq("id", params.id)
    .single();

  if (error) {
    console.error(error);
  }
  if (!proche) {
    notFound();
  }

  const nbSwipes = proche.nb_swipes ?? 0;
  const progression = Math.min(100, (nbSwipes / 5) * 100);

  // Prochain événement actif (le plus proche dans le temps) : sert de cible au
  // bouton "Voir des idées cadeaux". Calcul des dates délégué à la lib (§11).
  const aujourdhui = new Date();
  const prochainEvenement = proche.evenements
    .filter((ev) => ev.actif !== false)
    .map((ev) => ({
      ev,
      date: prochaineDateEvenement(
        ev.type,
        proche.date_naissance,
        ev.date_fixe,
        aujourdhui,
      ),
    }))
    .filter((x): x is { ev: (typeof proche.evenements)[number]; date: Date } => x.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {proche.prenom} {proche.nom ?? ""}
          </h1>
          <p className="text-muted-foreground">
            {LIBELLE_RELATION[proche.relation] ?? proche.relation}
          </p>
        </div>
        {proche.calibre && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Calibré
          </span>
        )}
      </div>

      {/* Calibration */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Calibration des goûts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progression}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {nbSwipes} / 5 swipes
            {proche.calibre ? " — profil calibré, vous pouvez continuer à affiner." : ""}
          </p>
          <Link
            href={`/swipe/${proche.id}`}
            className={buttonVariants({ size: "sm" })}
          >
            <Sparkles className="h-4 w-4" />
            {nbSwipes > 0 ? "Relancer une session de swipe" : "Lancer la calibration"}
          </Link>
        </CardContent>
      </Card>

      {/* Idées cadeaux : cible le prochain événement actif s'il en existe un. */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Idées cadeaux</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {prochainEvenement ? (
            <>
              <p className="text-sm text-muted-foreground">
                Prochain événement :{" "}
                <span className="font-medium text-foreground">
                  {libelleEvenement(prochainEvenement.ev.type)}
                </span>
                .
              </p>
              <Link
                href={`/proches/${proche.id}/propositions?evenement=${prochainEvenement.ev.id}`}
                className={buttonVariants({ size: "sm" })}
              >
                <Gift className="h-4 w-4" />
                Voir des idées cadeaux
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Aucun événement actif. Ajoutez-en un pour générer des idées
                cadeaux au bon moment.
              </p>
              <span
                aria-disabled="true"
                className={buttonVariants({ size: "sm", variant: "outline" }) + " pointer-events-none opacity-50"}
              >
                <Gift className="h-4 w-4" />
                Voir des idées cadeaux
              </span>
            </>
          )}
        </CardContent>
      </Card>

      {/* Centres d'intérêt */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Centres d&apos;intérêt</CardTitle>
        </CardHeader>
        <CardContent>
          {proche.proche_tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun centre d&apos;intérêt renseigné.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {proche.proche_tags.map((pt) => (
                <span
                  key={pt.tag_slug}
                  className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground"
                >
                  {pt.tags?.libelle ?? pt.tag_slug}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Événements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Événements</CardTitle>
        </CardHeader>
        <CardContent>
          {proche.evenements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun événement enregistré.</p>
          ) : (
            <ul className="space-y-2">
              {proche.evenements.map((ev) => (
                <li key={ev.id} className="flex items-center gap-2 text-sm">
                  <CalendarHeart className="h-4 w-4 text-primary" />
                  {libelleEvenement(ev.type)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
