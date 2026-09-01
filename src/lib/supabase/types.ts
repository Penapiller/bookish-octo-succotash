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

// Named rarity_tier in Postgres (renamed from pet_rarity once items also
// needed it — see 0005_items_and_inventory.sql). Kept as PetRarity here
// since that's what most call sites already import; ItemRarity is just an
// alias for the item-shaped call sites.
export type PetRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type ItemRarity = PetRarity;
export type ExpeditionStatus = "in_progress" | "awaiting_claim" | "completed";
export type ItemType = "ingredient" | "cosmetic" | "potion";
export type PotionEffectType = "duration_reduction" | "rarity_boost";

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
  map_x: number | null;
  map_y: number | null;
  map_width: number | null;
  map_height: number | null;
  created_at: string;
};

export type ZonePetPoolRow = {
  zone_id: string;
  species_id: string;
  drop_weight: number;
};

export type ItemRow = {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  image_url: string | null;
  sell_value: number;
  is_active: boolean;
  created_at: string;
};

export type UserInventoryRow = {
  user_id: string;
  item_id: string;
  quantity: number;
};

export type ZoneLootTableRow = {
  zone_id: string;
  item_id: string;
  drop_weight: number;
};

export type PotionRecipeRow = {
  id: string;
  output_potion_item_id: string;
  effect_type: PotionEffectType;
  effect_magnitude: number;
  is_active: boolean;
  created_at: string;
};

export type PotionRecipeIngredientRow = {
  recipe_id: string;
  item_id: string;
  quantity_required: number;
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
  result_item_id: string | null;
  pending_species_id: string | null;
  pending_item_id: string | null;
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

// A stack in the player's inventory, as shown on /inventory.
export type ItemWithQuantity = {
  quantity: number;
  item: Pick<ItemRow, "id" | "name" | "image_url" | "rarity" | "type"> | null;
};

export type ExpeditionWithZone = Pick<
  ExpeditionRow,
  "id" | "status" | "is_tutorial" | "resolves_at"
> & {
  zones: Pick<ZoneRow, "name" | "description" | "image_url"> | null;
};

// A user's own not-yet-completed (in_progress or awaiting_claim)
// expedition, for cross-referencing against the explorable-zones map:
// which zones/pets are currently busy, and what to show as each hotspot's
// badge. The sent pet stays "busy" and the zone stays locked through
// awaiting_claim too — it isn't free until the reward is claimed.
export type ActiveExpeditionSummary = Pick<
  ExpeditionRow,
  "id" | "pet_id" | "zone_id" | "resolves_at" | "status"
>;

// The revealed reward for a single awaiting_claim expedition, fetched
// only when the player explicitly opens the claim popup — deliberately
// not part of the map's initial data load, so the reward stays a
// surprise until then.
export type ExpeditionRewardReveal = {
  pending_species_id: string | null;
  pending_item_id: string | null;
  species: Pick<SpeciesRow, "name" | "image_url" | "rarity"> | null;
  items: Pick<ItemRow, "name" | "image_url" | "rarity"> | null;
};

// A zone's pool preview ("what you might get") — pets and items are drawn
// from the same weighted roll (see pick_weighted_zone_reward), so the
// preview is one merged, kind-tagged list rather than two separate ones.
export type ZonePoolEntry = {
  kind: "pet" | "item";
  id: string;
  name: string;
  image_url: string | null;
  rarity: PetRarity;
};

// A recipe as shown on /brewing: the output potion, its ingredients (each
// with the player's current owned quantity resolved server-side, so the
// UI can show "2 / 3" without a second round trip), and whether the
// player currently has enough of everything to brew it.
export type RecipeIngredientWithStock = {
  item: Pick<ItemRow, "id" | "name" | "image_url" | "rarity"> | null;
  quantityRequired: number;
  quantityOwned: number;
};

export type RecipeWithDetails = Pick<
  PotionRecipeRow,
  "id" | "effect_type" | "effect_magnitude" | "is_active"
> & {
  potion: Pick<ItemRow, "id" | "name" | "image_url" | "rarity"> | null;
  ingredients: RecipeIngredientWithStock[];
  canBrew: boolean;
};

// A potion sitting in the player's inventory, offered as an option when
// starting an expedition.
export type OwnedPotion = {
  itemId: string;
  name: string;
  image_url: string | null;
  quantity: number;
};

// A zone as shown on the expeditions map, with its pool preview resolved
// server-side.
export type ExplorableZone = Pick<
  ZoneRow,
  | "id"
  | "name"
  | "tier"
  | "description"
  | "image_url"
  | "map_x"
  | "map_y"
  | "map_width"
  | "map_height"
> & {
  pool: ZonePoolEntry[];
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
      items: TableOf<ItemRow, Partial<ItemRow> & { name: string }>;
      user_inventory: TableOf<
        UserInventoryRow,
        Partial<UserInventoryRow> & { user_id: string; item_id: string }
      >;
      zone_loot_table: TableOf<ZoneLootTableRow>;
      potion_recipes: TableOf<PotionRecipeRow, Partial<PotionRecipeRow> & { output_potion_item_id: string; effect_type: PotionEffectType }>;
      potion_recipe_ingredients: TableOf<PotionRecipeIngredientRow>;
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
      start_expedition: {
        Args: {
          p_user_id: string;
          p_pet_id: string;
          p_zone_id: string;
          p_potion_item_id?: string | null;
        };
        Returns: string;
      };
      claim_expedition_reward: {
        Args: {
          p_user_id: string;
          p_expedition_id: string;
          p_keep: boolean;
        };
        Returns: string | null;
      };
      brew_potion: {
        Args: {
          p_user_id: string;
          p_recipe_id: string;
        };
        Returns: null;
      };
    };
  };
};
