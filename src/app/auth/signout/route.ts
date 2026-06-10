import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Déconnexion : termine la session puis renvoie vers la landing.
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error(error);
  }

  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
