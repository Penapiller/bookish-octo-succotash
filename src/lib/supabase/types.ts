export type UserRow = {
  id: string;
  google_sub: string | null;
  email: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  currency_balance: number;
  den_size: number;
  is_admin: boolean;
  starter_granted: boolean;
  created_at: string;
};

export type PublicUserProfile = Pick<
  UserRow,
  "id" | "display_name" | "avatar_url" | "bio" | "created_at"
>;

export type PetRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type ExpeditionStatus = "in_progress" | "completed";

export type SpeciesRow = {
  id: string;
  name: string;
  rarity: PetRarity;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type PetRow = {
  id: string;
  owner_id: string;
  species_id: string;
  color_variant: string | null;
  rarity: PetRarity;
  created_at: string;
};

export type ZoneRow = {
  id: string;
  name: string;
  tier: number;
  description: string | null;
  image_url: string | null;
  unlock_requirement: string | null;
  is_tutorial: boolean;
  is_active: boolean;
  created_at: string;
};

export type ZonePetPoolRow = {
  zone_id: string;
  species_id: string;
  drop_weight: number;
};

export type ExpeditionRow = {
  id: string;
  user_id: string;
  pet_id: string;
  zone_id: string;
  status: ExpeditionStatus;
  is_tutorial: boolean;
  started_at: string;
  resolves_at: string;
  result_pet_id: string | null;
  created_at: string;
};

// Row types returned by hand-written joined `.select(...)` queries (e.g.
// pets embedded with their species). These aren't derived from the
// Database["public"]["Tables"] Relationships metadata below — that's kept
// minimal since this project hand-writes its types rather than running
// `supabase gen types`. Query call sites cast to these explicitly.
export type PetWithSpecies = Pick<
  PetRow,
  "id" | "rarity" | "color_variant" | "created_at"
> & {
  species: Pick<SpeciesRow, "name" | "image_url"> | null;
};

export type ExpeditionWithZone = Pick<
  ExpeditionRow,
  "id" | "status" | "is_tutorial" | "resolves_at"
> & {
  zones: Pick<ZoneRow, "name" | "description" | "image_url"> | null;
};

type TableOf<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      users: TableOf<
        UserRow,
        Partial<UserRow> & { id: string; email: string },
        Partial<Omit<UserRow, "id">>
      >;
      species: TableOf<SpeciesRow, Partial<SpeciesRow> & { name: string }>;
      pets: TableOf<
        PetRow,
        Partial<PetRow> & { owner_id: string; species_id: string; rarity: PetRarity }
      >;
      zones: TableOf<ZoneRow, Partial<ZoneRow> & { name: string }>;
      zone_pet_pool: TableOf<ZonePetPoolRow>;
      expeditions: TableOf<
        ExpeditionRow,
        Partial<ExpeditionRow> & {
          user_id: string;
          pet_id: string;
          zone_id: string;
          resolves_at: string;
        }
      >;
    };
    Views: {
      user_profiles: {
        Row: PublicUserProfile;
        Relationships: [];
      };
    };
    Functions: {
      grant_starter_pet_and_tutorial: {
        Args: { p_user_id: string };
        Returns: null;
      };
      resolve_due_expeditions: {
        Args: { p_user_id: string };
        Returns: null;
      };
    };
  };
};
