"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type Tag = Database["public"]["Tables"]["tags"]["Row"];

// Options de relation (CLAUDE.md §3, contrainte CHECK).
const RELATIONS = [
  { value: "conjoint", label: "Conjoint·e" },
  { value: "enfant", label: "Enfant" },
  { value: "parent", label: "Parent" },
  { value: "grand_parent", label: "Grand-parent" },
  { value: "ami", label: "Ami·e" },
  { value: "collegue", label: "Collègue" },
  { value: "autre", label: "Autre" },
];

// Types d'événements proposés (CLAUDE.md §3).
const TYPES_EVENEMENTS = [
  { value: "anniversaire", label: "Anniversaire" },
  { value: "noel", label: "Noël" },
  { value: "fete_meres", label: "Fête des mères" },
  { value: "fete_peres", label: "Fête des pères" },
  { value: "fete_grands_parents", label: "Fête des grands-parents" },
  { value: "saint_valentin", label: "Saint-Valentin" },
];

export default function NouveauProchePage() {
  const router = useRouter();

  // Champs du proche.
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [relation, setRelation] = useState("ami");
  const [adresse, setAdresse] = useState("");

  // Sélections multiples.
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsSelectionnes, setTagsSelectionnes] = useState<string[]>([]);
  const [evenementsSelectionnes, setEvenementsSelectionnes] = useState<string[]>([]);

  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  // Chargement de la liste des tags (table de référence, lecture publique).
  useEffect(() => {
    async function chargerTags() {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .order("categorie")
        .order("libelle");
      if (error) {
        console.error(error);
        return;
      }
      setTags(data ?? []);
    }
    chargerTags();
  }, []);

  function basculer(liste: string[], valeur: string): string[] {
    return liste.includes(valeur)
      ? liste.filter((v) => v !== valeur)
      : [...liste, valeur];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);

    // user_id à récupérer côté client (RLS impose le bon propriétaire, §7).
    const {
      data: { user },
      error: erreurUser,
    } = await supabase.auth.getUser();
    if (erreurUser || !user) {
      console.error(erreurUser);
      setErreur("Session expirée. Reconnectez-vous.");
      setChargement(false);
      return;
    }

    // 1. Insertion du proche.
    const { data: proche, error: erreurProche } = await supabase
      .from("proches")
      .insert({
        user_id: user.id,
        prenom,
        nom: nom || null,
        date_naissance: dateNaissance,
        relation,
        adresse: adresse || null,
      })
      .select()
      .single();

    if (erreurProche || !proche) {
      console.error(erreurProche);
      setErreur("L'enregistrement du proche a échoué.");
      setChargement(false);
      return;
    }

    // 2. Insertion des tags descriptifs (poids 1.0 par défaut).
    if (tagsSelectionnes.length > 0) {
      const { error: erreurTags } = await supabase.from("proche_tags").insert(
        tagsSelectionnes.map((slug) => ({
          proche_id: proche.id,
          tag_slug: slug,
          poids: 1.0,
        })),
      );
      if (erreurTags) {
        console.error(erreurTags);
        setErreur("Le proche est créé mais ses centres d'intérêt n'ont pas été enregistrés.");
        setChargement(false);
        return;
      }
    }

    // 3. Insertion des événements.
    if (evenementsSelectionnes.length > 0) {
      const { error: erreurEvenements } = await supabase.from("evenements").insert(
        evenementsSelectionnes.map((type) => ({
          proche_id: proche.id,
          type,
        })),
      );
      if (erreurEvenements) {
        console.error(erreurEvenements);
        setErreur("Le proche est créé mais ses événements n'ont pas été enregistrés.");
        setChargement(false);
        return;
      }
    }

    // On enchaîne sur la calibration par swipe.
    router.push(`/swipe/${proche.id}`);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Ajouter un proche</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="prenom">Prénom *</Label>
                <Input
                  id="prenom"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  required
                />
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
              <Input
                id="adresse"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
              />
            </div>

            {/* Tags descriptifs (centres d'intérêt). */}
            <div className="space-y-2">
              <Label>Centres d&apos;intérêt</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const actif = tagsSelectionnes.includes(tag.slug);
                  return (
                    <button
                      key={tag.slug}
                      type="button"
                      onClick={() =>
                        setTagsSelectionnes((prev) => basculer(prev, tag.slug))
                      }
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

            {/* Événements à suivre. */}
            <div className="space-y-2">
              <Label>Événements à célébrer</Label>
              <div className="flex flex-wrap gap-2">
                {TYPES_EVENEMENTS.map((ev) => {
                  const actif = evenementsSelectionnes.includes(ev.value);
                  return (
                    <button
                      key={ev.value}
                      type="button"
                      onClick={() =>
                        setEvenementsSelectionnes((prev) => basculer(prev, ev.value))
                      }
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

            <Button type="submit" className="w-full" disabled={chargement}>
              {chargement ? "Enregistrement…" : "Ajouter et commencer la calibration"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
