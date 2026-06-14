export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      config_audace: {
        Row: {
          created_at: string | null
          id: string
          nb_equilibre: number
          nb_valeur_sure: number
          nb_wildcard: number
          position_max: number
          position_min: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          nb_equilibre: number
          nb_valeur_sure: number
          nb_wildcard: number
          position_max: number
          position_min: number
        }
        Update: {
          created_at?: string | null
          id?: string
          nb_equilibre?: number
          nb_valeur_sure?: number
          nb_wildcard?: number
          position_max?: number
          position_min?: number
        }
        Relationships: []
      }
      declencheurs: {
        Row: {
          actif: boolean | null
          created_at: string | null
          evenement_id: string | null
          id: string
          proche_id: string
          regle_temporelle: Json | null
          type: string
        }
        Insert: {
          actif?: boolean | null
          created_at?: string | null
          evenement_id?: string | null
          id?: string
          proche_id: string
          regle_temporelle?: Json | null
          type: string
        }
        Update: {
          actif?: boolean | null
          created_at?: string | null
          evenement_id?: string | null
          id?: string
          proche_id?: string
          regle_temporelle?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "declencheurs_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "declencheurs_proche_id_fkey"
            columns: ["proche_id"]
            isOneToOne: false
            referencedRelation: "proches"
            referencedColumns: ["id"]
          },
        ]
      }
      evenements: {
        Row: {
          actif: boolean | null
          created_at: string | null
          date_fixe: string | null
          frequence: string | null
          id: string
          proche_id: string
          type: string
        }
        Insert: {
          actif?: boolean | null
          created_at?: string | null
          date_fixe?: string | null
          frequence?: string | null
          id?: string
          proche_id: string
          type: string
        }
        Update: {
          actif?: boolean | null
          created_at?: string | null
          date_fixe?: string | null
          frequence?: string | null
          id?: string
          proche_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "evenements_proche_id_fkey"
            columns: ["proche_id"]
            isOneToOne: false
            referencedRelation: "proches"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          created_at: string | null
          date: string | null
          declencheur_id: string | null
          id: string
          proche_id: string
          statut: string
          type_suggestion: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          declencheur_id?: string | null
          id?: string
          proche_id: string
          statut?: string
          type_suggestion?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string | null
          declencheur_id?: string | null
          id?: string
          proche_id?: string
          statut?: string
          type_suggestion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_declencheur_id_fkey"
            columns: ["declencheur_id"]
            isOneToOne: false
            referencedRelation: "declencheurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_proche_id_fkey"
            columns: ["proche_id"]
            isOneToOne: false
            referencedRelation: "proches"
            referencedColumns: ["id"]
          },
        ]
      }
      proche_tags: {
        Row: {
          poids: number | null
          proche_id: string
          tag_slug: string
        }
        Insert: {
          poids?: number | null
          proche_id: string
          tag_slug: string
        }
        Update: {
          poids?: number | null
          proche_id?: string
          tag_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "proche_tags_proche_id_fkey"
            columns: ["proche_id"]
            isOneToOne: false
            referencedRelation: "proches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proche_tags_tag_slug_fkey"
            columns: ["tag_slug"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["slug"]
          },
        ]
      }
      proches: {
        Row: {
          adresse: string | null
          audace: number | null
          budget_max: number | null
          budget_min: number | null
          budget_type: string | null
          calibre: boolean | null
          created_at: string | null
          date_naissance: string
          description_libre: string | null
          embedding: string | null
          id: string
          nb_swipes: number | null
          nom: string | null
          photo_url: string | null
          prenom: string
          profil_valide: boolean | null
          relation: string
          user_id: string
          vecteur_gouts: Json | null
        }
        Insert: {
          adresse?: string | null
          audace?: number | null
          budget_max?: number | null
          budget_min?: number | null
          budget_type?: string | null
          calibre?: boolean | null
          created_at?: string | null
          date_naissance: string
          description_libre?: string | null
          embedding?: string | null
          id?: string
          nb_swipes?: number | null
          nom?: string | null
          photo_url?: string | null
          prenom: string
          profil_valide?: boolean | null
          relation: string
          user_id: string
          vecteur_gouts?: Json | null
        }
        Update: {
          adresse?: string | null
          audace?: number | null
          budget_max?: number | null
          budget_min?: number | null
          budget_type?: string | null
          calibre?: boolean | null
          created_at?: string | null
          date_naissance?: string
          description_libre?: string | null
          embedding?: string | null
          id?: string
          nb_swipes?: number | null
          nom?: string | null
          photo_url?: string | null
          prenom?: string
          profil_valide?: boolean | null
          relation?: string
          user_id?: string
          vecteur_gouts?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "proches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      produit_tags: {
        Row: {
          produit_id: string
          tag_slug: string
        }
        Insert: {
          produit_id: string
          tag_slug: string
        }
        Update: {
          produit_id?: string
          tag_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "produit_tags_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produit_tags_tag_slug_fkey"
            columns: ["tag_slug"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["slug"]
          },
        ]
      }
      produits: {
        Row: {
          actif: boolean | null
          affilie: boolean | null
          categorie: string
          created_at: string | null
          description: string | null
          description_matching: string | null
          embedding: string | null
          id: string
          nb_tags: number | null
          nom: string
          occasions: string[] | null
          prix_max: number | null
          prix_min: number | null
          score_originalite: number | null
          source: string | null
          tranche_age: string | null
          url_image: string | null
          url_produit: string
        }
        Insert: {
          actif?: boolean | null
          affilie?: boolean | null
          categorie: string
          created_at?: string | null
          description?: string | null
          description_matching?: string | null
          embedding?: string | null
          id?: string
          nb_tags?: number | null
          nom: string
          occasions?: string[] | null
          prix_max?: number | null
          prix_min?: number | null
          score_originalite?: number | null
          source?: string | null
          tranche_age?: string | null
          url_image?: string | null
          url_produit: string
        }
        Update: {
          actif?: boolean | null
          affilie?: boolean | null
          categorie?: string
          created_at?: string | null
          description?: string | null
          description_matching?: string | null
          embedding?: string | null
          id?: string
          nb_tags?: number | null
          nom?: string
          occasions?: string[] | null
          prix_max?: number | null
          prix_min?: number | null
          score_originalite?: number | null
          source?: string | null
          tranche_age?: string | null
          url_image?: string | null
          url_produit?: string
        }
        Relationships: []
      }
      profils: {
        Row: {
          created_at: string | null
          id: string
          nom: string | null
          prenom: string
        }
        Insert: {
          created_at?: string | null
          id: string
          nom?: string | null
          prenom: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nom?: string | null
          prenom?: string
        }
        Relationships: []
      }
      propositions: {
        Row: {
          choisie: boolean | null
          created_at: string | null
          envoyee_le: string | null
          evenement_id: string
          id: string
          offert: boolean | null
          offert_le: string | null
          proche_id: string
          produit_id: string
          retour_satisfaction: number | null
          score: number
        }
        Insert: {
          choisie?: boolean | null
          created_at?: string | null
          envoyee_le?: string | null
          evenement_id: string
          id?: string
          offert?: boolean | null
          offert_le?: string | null
          proche_id: string
          produit_id: string
          retour_satisfaction?: number | null
          score: number
        }
        Update: {
          choisie?: boolean | null
          created_at?: string | null
          envoyee_le?: string | null
          evenement_id?: string
          id?: string
          offert?: boolean | null
          offert_le?: string | null
          proche_id?: string
          produit_id?: string
          retour_satisfaction?: number | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "propositions_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propositions_proche_id_fkey"
            columns: ["proche_id"]
            isOneToOne: false
            referencedRelation: "proches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propositions_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      swipes: {
        Row: {
          created_at: string | null
          direction: string
          id: string
          proche_id: string
          produit_id: string
        }
        Insert: {
          created_at?: string | null
          direction: string
          id?: string
          proche_id: string
          produit_id: string
        }
        Update: {
          created_at?: string | null
          direction?: string
          id?: string
          proche_id?: string
          produit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swipes_proche_id_fkey"
            columns: ["proche_id"]
            isOneToOne: false
            referencedRelation: "proches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swipes_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          categorie: string
          id: string
          libelle: string
          slug: string
        }
        Insert: {
          categorie: string
          id?: string
          libelle: string
          slug: string
        }
        Update: {
          categorie?: string
          id?: string
          libelle?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      email_utilisateur: { Args: { uid: string }; Returns: string }
      match_produits: {
        Args: {
          match_count?: number
          p_budget_max?: number
          p_budget_min?: number
          p_proche_id: string
          query_embedding: string
        }
        Returns: {
          categorie: string
          description_matching: string
          distance: number
          id: string
          nom: string
          prix_max: number
          prix_min: number
          score_originalite: number
          url_produit: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
