import Link from "next/link";
import { Gift } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase-server";

// Landing publique. Affiche un accès au dashboard si l'utilisateur est connecté.
export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex items-center gap-2 text-primary">
        <Gift className="h-10 w-10" />
        <span className="text-3xl font-bold">GiftMatch</span>
      </div>

      <h1 className="max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
        Le cadeau parfait, sans prise de tête
      </h1>
      <p className="mt-4 max-w-xl text-balance text-lg text-muted-foreground">
        Swipez pour cerner les goûts de vos proches. Avant chaque anniversaire ou
        fête, recevez 5 idées de cadeaux taillées pour eux.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {user ? (
          <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
            Accéder à mon espace
          </Link>
        ) : (
          <>
            <Link href="/auth/register" className={buttonVariants({ size: "lg" })}>
              Créer un compte
            </Link>
            <Link
              href="/auth/login"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              Se connecter
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
