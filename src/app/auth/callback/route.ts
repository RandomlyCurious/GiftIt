import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Échange le code (OAuth Google ou confirmation email) contre une session.
//
// IMPORTANT : on pose les cookies de session DIRECTEMENT sur la réponse de
// redirection. En production (Vercel serverless), les cookies écrits via
// next/headers `cookies()` ne sont pas attachés à un NextResponse.redirect(),
// ce qui ferait perdre la session (l'utilisateur reviendrait sur /login).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  // Réponse de succès : les cookies de session y seront écrits par setAll.
  const response = NextResponse.redirect(`${origin}/dashboard`);

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

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error(error);
    return NextResponse.redirect(`${origin}/auth/login?error=auth`);
  }

  return response;
}
