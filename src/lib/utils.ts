import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Fusionne des classes Tailwind en gérant les conflits (pattern shadcn/ui).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formate une fourchette de prix en euros pour l'affichage.
export function formatPrix(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Prix N/C";
  if (min != null && max != null && min !== max) return `${min}–${max} €`;
  return `${(max ?? min) as number} €`;
}
