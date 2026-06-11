import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Déconnexion : termine la session puis renvoie vers la landing.
//
// Comme le callback OAuth, on écrit les cookies (ici leur SUPPRESSION par
// signOut) directement sur la réponse de redirection. Via next/headers
// cookies(), l'effacement ne serait pas attaché au NextResponse.redirect en
// production (Vercel serverless) et la session ne serait pas réellement coupée.
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url), {
    status: 303,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error(error);
  }

  return response;
}
