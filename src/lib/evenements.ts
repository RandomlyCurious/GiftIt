// Logique métier des événements (CLAUDE.md §8 + §11 : doit vivre en lib, pas dans la page).
// Calcule la prochaine occurrence de chaque type d'événement et le nombre de jours
// qui en sépare. Fonctions pures (aucun accès réseau / DB), donc testables.
//
// Convention de dates : on raisonne en dates "locales" (jour/mois/année) sans
// composante horaire. Toutes les Date renvoyées sont à minuit local.

export type TypeEvenement =
  | "anniversaire"
  | "noel"
  | "fete_meres"
  | "fete_peres"
  | "fete_grands_parents"
  | "saint_valentin"
  | "autre";

// Libellés lisibles pour l'affichage (la base stocke un slug).
const LIBELLES: Record<string, string> = {
  anniversaire: "Anniversaire",
  noel: "Noël",
  fete_meres: "Fête des mères",
  fete_peres: "Fête des pères",
  fete_grands_parents: "Fête des grands-parents",
  saint_valentin: "Saint-Valentin",
  autre: "Événement",
};

// Renvoie le libellé lisible d'un type d'événement.
export function libelleEvenement(type: string): string {
  return LIBELLES[type] ?? "Événement";
}

// Ramène une date à minuit local (supprime toute composante horaire), pour
// comparer des dates "jour à jour" sans surprise de fuseau.
function aMinuit(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Parse une date au format "YYYY-MM-DD" (tel que stocké par Postgres/Supabase)
// en Date locale à minuit, en évitant le parsing UTC implicite de `new Date(str)`.
function parseDateLocale(iso: string): Date {
  const [annee, mois, jour] = iso.split("-").map(Number);
  return new Date(annee, mois - 1, jour);
}

/**
 * Calcule la date du Nème dimanche d'un mois donné (1 = janvier ... 12 = décembre).
 * Ex : 1er dimanche de juin, 3e dimanche de juin, 1er dimanche d'octobre.
 */
function nemeDimanche(annee: number, mois: number, rang: number): Date {
  // getDay() : 0 = dimanche. On cherche le premier dimanche du mois...
  const premier = new Date(annee, mois - 1, 1);
  const decalageVersDimanche = (7 - premier.getDay()) % 7;
  const jourPremierDimanche = 1 + decalageVersDimanche;
  // ...puis on ajoute (rang - 1) semaines.
  return new Date(annee, mois - 1, jourPremierDimanche + (rang - 1) * 7);
}

/**
 * Renvoie la prochaine occurrence (>= aujourd'hui) d'une date annuelle définie
 * par une fonction `pourAnnee(annee) => Date`. Si l'occurrence de l'année courante
 * est déjà passée, on bascule sur l'année suivante.
 */
function prochaineOccurrenceAnnuelle(
  aujourdhui: Date,
  pourAnnee: (annee: number) => Date,
): Date {
  const anneeCourante = aujourdhui.getFullYear();
  const candidate = aMinuit(pourAnnee(anneeCourante));
  if (candidate >= aMinuit(aujourdhui)) return candidate;
  return aMinuit(pourAnnee(anneeCourante + 1));
}

/**
 * Calcule la PROCHAINE date d'un événement (§8).
 *
 * @param type type d'événement
 * @param dateNaissance date de naissance du proche au format "YYYY-MM-DD" (pour l'anniversaire)
 * @param dateFixe date fixe au format "YYYY-MM-DD" (pour le type "autre")
 * @param aujourdhui date de référence (injectée pour testabilité)
 * @returns la Date de la prochaine occurrence, ou null si non calculable
 */
export function prochaineDateEvenement(
  type: string,
  dateNaissance: string | null,
  dateFixe: string | null,
  aujourdhui: Date,
): Date | null {
  switch (type) {
    case "anniversaire": {
      if (!dateNaissance) return null;
      const naissance = parseDateLocale(dateNaissance);
      // Même jour/mois que la naissance, année courante ou suivante.
      return prochaineOccurrenceAnnuelle(
        aujourdhui,
        (annee) => new Date(annee, naissance.getMonth(), naissance.getDate()),
      );
    }

    case "noel":
      return prochaineOccurrenceAnnuelle(aujourdhui, (annee) => new Date(annee, 11, 25));

    case "saint_valentin":
      return prochaineOccurrenceAnnuelle(aujourdhui, (annee) => new Date(annee, 1, 14));

    case "fete_meres":
      // France : 1er dimanche de juin (approximation MVP, ignore le report quand
      // ce dimanche coïncide avec la Pentecôte).
      return prochaineOccurrenceAnnuelle(aujourdhui, (annee) => nemeDimanche(annee, 6, 1));

    case "fete_peres":
      // France : 3e dimanche de juin.
      return prochaineOccurrenceAnnuelle(aujourdhui, (annee) => nemeDimanche(annee, 6, 3));

    case "fete_grands_parents":
      // France : 1er dimanche d'octobre.
      return prochaineOccurrenceAnnuelle(aujourdhui, (annee) => nemeDimanche(annee, 10, 1));

    case "autre": {
      if (!dateFixe) return null;
      // Choix MVP : on prend la date fixe brute si elle est dans le futur, sinon
      // on considère l'événement comme annuel et on prend l'an prochain.
      const fixe = aMinuit(parseDateLocale(dateFixe));
      if (fixe >= aMinuit(aujourdhui)) return fixe;
      return prochaineOccurrenceAnnuelle(
        aujourdhui,
        (annee) => new Date(annee, fixe.getMonth(), fixe.getDate()),
      );
    }

    default:
      return null;
  }
}

/**
 * Nombre de jours entiers entre aujourd'hui et une date (>= 0 pour le futur).
 * On compare à minuit pour éviter les effets de bord liés à l'heure.
 */
export function joursAvant(date: Date, aujourdhui: Date): number {
  const MS_PAR_JOUR = 1000 * 60 * 60 * 24;
  const diff = aMinuit(date).getTime() - aMinuit(aujourdhui).getTime();
  return Math.round(diff / MS_PAR_JOUR);
}

// Formate une date pour l'affichage en français (ex : "25 décembre 2026").
export function formatDateFr(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
