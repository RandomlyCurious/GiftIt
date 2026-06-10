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

// Connexion par email / mot de passe (+ Google en option).
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  async function handleConnexion(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: motDePasse,
    });

    if (error) {
      console.error(error);
      setErreur("Email ou mot de passe incorrect.");
      setChargement(false);
      return;
    }

    // Session posée : le dashboard est désormais accessible.
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogle() {
    setErreur(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      console.error(error);
      setErreur("La connexion Google a échoué.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Se connecter</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnexion} className="space-y-4">
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
                required
              />
            </div>

            {erreur && <p className="text-sm text-destructive">{erreur}</p>}

            <Button type="submit" className="w-full" disabled={chargement}>
              {chargement ? "Connexion…" : "Se connecter"}
            </Button>
          </form>

          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full"
            onClick={handleGoogle}
          >
            Continuer avec Google
          </Button>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link href="/auth/register" className="text-primary underline">
              Créer un compte
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
