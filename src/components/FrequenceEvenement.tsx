"use client";

import { useState } from "react";
import { libelleEvenement } from "@/lib/evenements";
import {
  FREQUENCES,
  FREQUENCE_DEFAUT,
  mettreAJourFrequence,
} from "@/lib/frequences";

// US-A1 : sélecteur de fréquence de rappel pour un événement donné.
export function FrequenceEvenement({
  evenementId,
  type,
  frequence,
}: {
  evenementId: string;
  type: string;
  frequence: string | null;
}) {
  const [valeur, setValeur] = useState(frequence ?? FREQUENCE_DEFAUT);
  const [etat, setEtat] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nouvelle = e.target.value;
    setValeur(nouvelle);
    setEtat("saving");
    const ok = await mettreAJourFrequence(evenementId, nouvelle);
    setEtat(ok ? "saved" : "error");
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="font-medium">{libelleEvenement(type)}</span>
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Rappels :</label>
        <select
          value={valeur}
          onChange={handleChange}
          disabled={etat === "saving"}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm disabled:opacity-60"
        >
          {FREQUENCES.map((f) => (
            <option key={f.code} value={f.code}>
              {f.libelle}
            </option>
          ))}
        </select>
        {etat === "saving" && (
          <span className="text-xs text-muted-foreground">…</span>
        )}
        {etat === "saved" && <span className="text-xs text-primary">✓</span>}
        {etat === "error" && <span className="text-xs text-destructive">!</span>}
      </div>
    </div>
  );
}
