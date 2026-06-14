"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { supprimerProche } from "@/lib/proches";

// Actions sur la fiche d'un proche : modifier + supprimer (avec modale §3.2.2).
export function ProcheActions({ procheId, prenom }: { procheId: string; prenom: string }) {
  const router = useRouter();
  const [modale, setModale] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function confirmer() {
    setSuppression(true);
    setErreur(null);
    const err = await supprimerProche(procheId);
    if (err) {
      console.error(err);
      setErreur("La suppression a échoué.");
      setSuppression(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/proches/${procheId}/modifier`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <Pencil className="h-4 w-4" />
        Modifier
      </Link>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setModale(true)}
        className="text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4" />
        Supprimer
      </Button>

      {modale && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">Supprimer {prenom} ?</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Cette action est irréversible. Les événements, swipes et propositions
              associés seront aussi supprimés.
            </p>
            {erreur && <p className="mb-3 text-sm text-destructive">{erreur}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModale(false)}
                disabled={suppression}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={confirmer}
                disabled={suppression}
              >
                {suppression ? "Suppression…" : "Supprimer définitivement"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
