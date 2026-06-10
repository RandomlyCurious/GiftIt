import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Échange le code (OAuth Google ou confirmation email) contre une session,
// puis renvoie vers le dashboard.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error(error);
      return NextResponse.redirect(`${origin}/auth/login`);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
