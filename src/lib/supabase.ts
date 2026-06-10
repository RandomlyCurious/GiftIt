import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

// Client Supabase côté navigateur (composants "use client"). Singleton.
// Convention projet (CLAUDE.md §5) : importer `supabase` depuis @/lib/supabase.
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
