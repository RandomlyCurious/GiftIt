"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  mettreAJourProche,
  reconcilierTags,
  reconcilierEvenements,
} from "@/lib/proches";
import type { Database } from "@/types/database.types";

type Tag = Database["public"]["Tables"]["tags"]["Row"];
type EvenementExistant = { id: string; type: string; actif: boolean | null };

const RELATIONS = [
  { value: "conjoint", label: "Conjoint·e" },
  { value: "enfant", label: "Enfant" },
  { value: "parent", label: "Parent" },
  { value: "grand_parent", label: "Grand-parent" },
  { value: "ami", label: "Ami·e" },
  { value: "collegue", label: "Collègue" },
  { value: "autre", label: "Autre" },
];

const TYPES_EVENEMENTS = [
  { value: "anniversaire", label: "Anniversaire" },
  { value: "noel", label: "Noël" },
  { value: "fete_meres", label: "Fête des mères" },
  { value: "fete_peres", label: "Fête des pères" },
  { value: "fete_grands_parents", label: "Fête des grands-parents" },
  { value: "saint_valentin", label: "Saint-Valentin" },
];

export default function ModifierProchePage() {
  const params = useParams<{ id: string }>();
  const procheId = params.id;
  const router = useRouter();

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [relation, setRelation] = useState("ami");
  const [adresse, setAdresse] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionInitiale, setDescriptionInitiale] = useState("");
  const [budgetType, setBudgetType] = useState("50");
  const [audace, setAudace] = useState(50);

  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsSelectionnes, setTagsSelectionnes] = useState<string[]>([]);
  const [evenementsExistants, setEvenementsExistants] = useState<EvenementExistant[]>([]);
  const [evenementsSelectionnes, setEvenementsSelectionnes] = useState<string[]>([]);

  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Chargement du proche + des tags de référence.
  useEffect(() => {
    async function charger() {
      const [{ data: proche, error: errProche }, { data: tousTags }] = await Promise.all([
        supabase
          .from("proches")
          .select(
            "*, proche_tags(tag_slug), evenements(id, type, actif)",
          )
          .eq("id", procheId)
          .single(),
        supabase.from("tags").select("*").order("categorie").order("libelle"),
      ]);

      if (errProche || !proche) {
        console.error(errProche);
        setErreur("Impossible de charger ce proche.");
        setChargement(false);
        return;
      }

      setPrenom(proche.prenom);
      setNom(proche.nom ?? "");
      setDateNaissance(proche.date_naissance);
      setRelation(proche.relation);
      setAdresse(proche.adresse ?? "");
      setDescription(proche.description_libre ?? "");
      setDescriptionInitiale(proche.description_libre ?? "");
      setBudgetType(proche.budget_type ?? "50");
      setAudace(proche.audace ?? 50);
      setTagsSelectionnes((proche.proche_tags ?? []).map((t) => t.tag_slug));
      const evs = (proche.evenements ?? []) as EvenementExistant[];
      setEvenementsExistants(evs);
      setEvenementsSelectionnes(evs.filter((e) => e.actif !== false).map((e) => e.type));
      setTags(tousTags ?? []);
      setChargement(false);
    }
    charger();
  }, [procheId]);

  function basculer(liste: string[], valeur: string): string[] {
    return liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnregistrement(true);

    const errMaj = await mettreAJourProche(procheId, {
      prenom,
      nom: nom || null,
      date_naissance: dateNaissance,
      relation,
      adresse: adresse || null,
      description_libre: description || null,
      budget_type: budgetType,
      audace,
    });
    if (errMaj) {
      console.error(errMaj);
      setErreur("La mise à jour a échoué.");
      setEnregistrement(false);
      return;
    }

    const errTags = await reconcilierTags(procheId, tagsSelectionnes);
    if (errTags) {
      console.error(errTags);
      setErreur("Le proche est à jour, mais ses centres d'intérêt n'ont pas pu être enregistrés.");
      setEnregistrement(false);
      return;
    }

    const errEv = await reconcilierEvenements(procheId, evenementsSelectionnes, evenementsExistants);
    if (errEv) {
      console.error(errEv);
      setErreur("Le proche est à jour, mais ses événements n'ont pas pu être enregistrés.");
      setEnregistrement(false);
      return;
    }

    // Si le portrait libre a changé, on régénère le profil sémantique (embedding).
    if (description.trim() && description !== descriptionInitiale) {
      const { error: errProfil } = await supabase.functions.invoke("extract-profil", {
        body: { proche_id: procheId },
      });
      if (errProfil) console.error(errProfil);
    }

    router.push(`/proches/${procheId}`);
    router.refresh();
  }

  if (chargement) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-muted-foreground">Chargement…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href={`/proches/${procheId}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la fiche
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Modifier le proche</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="prenom">Prénom *</Label>
                <Input id="prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nom">Nom</Label>
                <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dateNaissance">Date de naissance *</Label>
                <Input
                  id="dateNaissance"
                  type="date"
                  value={dateNaissance}
                  onChange={(e) => setDateNaissance(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="relation">Relation *</Label>
                <select
                  id="relation"
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {RELATIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adresse">Adresse</Label>
              <Input id="adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Portrait libre</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Modifier ce texte régénère le profil sémantique (idées plus justes).
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="budget">Budget</Label>
                <select
                  id="budget"
                  value={budgetType}
                  onChange={(e) => setBudgetType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="20">≈ 20 €</option>
                  <option value="50">≈ 50 €</option>
                  <option value="150">≈ 150 €</option>
                  <option value="nolimit">Sans limite</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="audace">Audace : {audace}/100</Label>
                <input
                  id="audace"
                  type="range"
                  min={0}
                  max={100}
                  value={audace}
                  onChange={(e) => setAudace(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Centres d&apos;intérêt</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const actif = tagsSelectionnes.includes(tag.slug);
                  return (
                    <button
                      key={tag.slug}
                      type="button"
                      onClick={() => setTagsSelectionnes((prev) => basculer(prev, tag.slug))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        actif
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-muted",
                      )}
                    >
                      {tag.libelle}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Événements à célébrer</Label>
              <div className="flex flex-wrap gap-2">
                {TYPES_EVENEMENTS.map((ev) => {
                  const actif = evenementsSelectionnes.includes(ev.value);
                  return (
                    <button
                      key={ev.value}
                      type="button"
                      onClick={() => setEvenementsSelectionnes((prev) => basculer(prev, ev.value))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        actif
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-muted",
                      )}
                    >
                      {ev.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {erreur && <p className="text-sm text-destructive">{erreur}</p>}

            <Button type="submit" className="w-full" disabled={enregistrement}>
              {enregistrement ? "Enregistrement…" : "Enregistrer les modifications"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
