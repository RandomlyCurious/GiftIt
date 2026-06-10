"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

// Inscription par email / mot de passe, puis création du profil associé.
export default function RegisterPage() {
  const router = useRouter();
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  async function handleInscription(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setMessage(null);
    setChargement(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password: motDePasse,
    });

    if (error) {
      console.error(error);
      setErreur("L'inscription a échoué. Cet email est peut-être déjà utilisé.");
      setChargement(false);
      return;
    }

    // Création de la ligne profil (id = id de l'utilisateur fraîchement créé).
    if (data.user) {
      const { error: erreurProfil } = await supabase
        .from("profils")
        .insert({ id: data.user.id, prenom, nom: nom || null });
      if (erreurProfil) {
        console.error(erreurProfil);
        // Le compte existe mais le profil n'a pas pu être créé : on alerte sans bloquer.
        setErreur(
          "Compte créé, mais le profil n'a pas pu être enregistré. Contactez le support.",
        );
        setChargement(false);
        return;
      }
    }

    // Si la confirmation par email est activée, aucune session n'est ouverte ici.
    if (!data.session) {
      setMessage(
        "Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse avant de vous connecter.",
      );
      setChargement(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Créer un compte</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInscription} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="prenom">Prénom</Label>
              <Input
                id="prenom"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nom">Nom (optionnel)</Label>
              <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motDePasse">Mot de passe</Label>
              <Input
                id="motDePasse"
                type="password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                minLength={6}
                required
              />
            </div>

            {erreur && <p className="text-sm text-destructive">{erreur}</p>}
            {message && <p className="text-sm text-primary">{message}</p>}

            <Button type="submit" className="w-full" disabled={chargement}>
              {chargement ? "Création…" : "Créer mon compte"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Déjà un compte ?{" "}
            <Link href="/auth/login" className="text-primary underline">
              Se connecter
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
