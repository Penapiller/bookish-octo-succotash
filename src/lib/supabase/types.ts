export type UserRow = {
  id: string;
  google_sub: string | null;
  email: string;
  display_name: string;
  display_name_changed_at: string;
  avatar_url: string | null;
  bio: string | null;
  coin_balance: number;
  gem_balance: number;
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
export type PotionEffectType =
  | "duration_reduction"
  | "rarity_boost"
  | "item_find_boost"
  | "double_reward_chance";
export type BrewStatus = "in_progress" | "awaiting_claim" | "completed";
export type TradeStatus = "pending" | "completed" | "declined" | "cancelled";
export type TradeSide = "initiator" | "recipient";
export type ListingType = "pet" | "item";
export type ListingStatus = "active" | "sold" | "cancelled" | "expired";
export type ListingCurrency = "coins" | "gems";
// Allowed listing durations — validated server-side too (see
// 0019_marketplace_upgrades.sql), this is just for the sell form's
// dropdown.
export type ListingDurationDays = 1 | 3 | 7 | 14 | 30;

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
  folder_id: string | null;
  custom_name: string | null;
  is_for_trade: boolean;
  created_at: string;
};

export type PetFolderRow = {
  id: string;
  owner_id: string;
  name: string;
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
  is_for_trade: boolean;
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

// Written only by the log_admin_action() trigger (see
// 0009_admin_panel.sql), never inserted/updated from the app directly.
export type AdminAuditLogRow = {
  id: string;
  admin_user_id: string | null;
  action_type: "insert" | "update" | "delete";
  target_table: string;
  target_id: string;
  change_summary: unknown;
  created_at: string;
};

export type PotionBrewRow = {
  id: string;
  user_id: string;
  recipe_id: string;
  status: BrewStatus;
  started_at: string;
  resolves_at: string;
  created_at: string;
};

export type TradeRow = {
  id: string;
  initiator_id: string;
  recipient_id: string;
  status: TradeStatus;
  note: string | null;
  initiator_coins: number;
  initiator_gems: number;
  recipient_coins: number;
  recipient_gems: number;
  created_at: string;
  responded_at: string | null;
  resolved_at: string | null;
};

export type TradePetRow = {
  trade_id: string;
  side: TradeSide;
  pet_id: string;
};

export type TradeItemRow = {
  trade_id: string;
  side: TradeSide;
  item_id: string;
  quantity: number;
};

export type MarketplaceListingRow = {
  id: string;
  seller_id: string;
  buyer_id: string | null;
  listing_type: ListingType;
  price_coins: number | null;
  price_gems: number | null;
  status: ListingStatus;
  pet_id: string | null;
  pet_species_name: string | null;
  pet_species_image_url: string | null;
  pet_rarity: PetRarity | null;
  pet_custom_name: string | null;
  item_id: string | null;
  item_quantity: number | null;
  created_at: string;
  expires_at: string;
  sold_at: string | null;
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
  "id" | "rarity" | "color_variant" | "folder_id" | "custom_name" | "is_for_trade" | "created_at"
> & {
  species: Pick<SpeciesRow, "name" | "image_url"> | null;
};

// A stack in the player's inventory, as shown on /items.
export type ItemWithQuantity = {
  quantity: number;
  is_for_trade: boolean;
  item: Pick<ItemRow, "id" | "name" | "image_url" | "rarity" | "type"> | null;
};

// A pet another player has marked for_trade, as shown on /trades/browse
// and in the "their pets" tab of the trade picker modal — never exposes
// anything beyond what the for-trade RLS policy (0016) already makes
// visible to any signed-in player (folder_id is deliberately left out;
// it's not for-trade-relevant and it's the new owner's to set anyway
// once a trade completes).
export type ForTradePet = Pick<PetRow, "id" | "rarity" | "custom_name"> & {
  ownerId: string;
  ownerName: string;
  speciesName: string;
  imageUrl: string | null;
};

export type ForTradeItem = {
  itemId: string;
  ownerId: string;
  ownerName: string;
  name: string;
  imageUrl: string | null;
  rarity: ItemRarity;
  type: ItemType;
  quantity: number;
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

// What claim_expedition_reward returns: the granted pet id (if a pet was
// kept), plus an optional bonus from a double_reward_chance potion.
export type ClaimExpeditionResult = {
  granted_pet_id: string | null;
  bonus_kind?: "pet" | "item";
  bonus_name?: string;
  bonus_image_url?: string | null;
};

// What expand_den returns after a successful purchase.
export type ExpandDenResult = {
  new_den_size: number;
  coins_spent: number;
};

// What admin_grant_self_currency returns — the admin's new balances.
export type AdminCurrencyGrantResult = {
  coin_balance: number;
  gem_balance: number;
};

// What change_display_name returns — see 0014_unique_display_names.sql.
export type ChangeDisplayNameResult = {
  display_name: string;
  gem_balance: number;
  next_change_available_at: string;
};

// What respond_to_trade returns — see 0015_trading.sql.
export type RespondToTradeResult = {
  status: "declined" | "completed";
};

// What buy_listing returns — see 0018_marketplace.sql (0019 added the
// currency choice). "unavailable" means the seller could no longer
// deliver, or the listing expired — buy_listing resolves the listing's
// status itself in that case (cancelled/expired) and returns this
// rather than raising, since an exception would roll back that update
// along with everything else in the call.
export type BuyListingResult =
  | { status: "sold"; currency: ListingCurrency; price: number }
  | { status: "unavailable"; reason: string };

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

// A crafting ingredient sitting in the player's inventory, offered as an
// option when filling a brewing slot.
export type OwnedIngredient = {
  itemId: string;
  name: string;
  image_url: string | null;
  rarity: ItemRarity;
  quantity: number;
};

// One pet or item line on one side of a trade, resolved with display
// details for the trade detail page.
export type TradePetLine = {
  side: TradeSide;
  petId: string;
  speciesName: string;
  imageUrl: string | null;
  rarity: PetRarity;
  customName: string | null;
};

export type TradeItemLine = {
  side: TradeSide;
  itemId: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
};

// A trade with both participants' display names resolved, as shown on
// /trades (the inbox list) and /trades/[id] (the detail page).
export type TradeWithParticipants = Pick<
  TradeRow,
  | "id"
  | "status"
  | "note"
  | "initiator_coins"
  | "initiator_gems"
  | "recipient_coins"
  | "recipient_gems"
  | "created_at"
  | "resolved_at"
> & {
  initiatorId: string;
  recipientId: string;
  initiatorName: string;
  recipientName: string;
  pets: TradePetLine[];
  items: TradeItemLine[];
};

// A marketplace listing with the seller/buyer names resolved (same
// user_profiles-lookup pattern as TradeWithParticipants — `users` only
// lets a player see their own row) and, for item listings, the item
// catalog details joined in. One shape covers both listing types —
// listingType says which of the pet*/item* fields are populated — so
// /marketplace/browse and /marketplace/mine can render mixed lists
// without two parallel types.
export type MarketplaceListing = Pick<
  MarketplaceListingRow,
  | "id"
  | "listing_type"
  | "status"
  | "price_coins"
  | "price_gems"
  | "pet_id"
  | "pet_species_name"
  | "pet_species_image_url"
  | "pet_rarity"
  | "pet_custom_name"
  | "item_quantity"
  | "created_at"
  | "expires_at"
  | "sold_at"
> & {
  sellerId: string;
  sellerName: string;
  buyerId: string | null;
  buyerName: string | null;
  itemId: string | null;
  itemName: string | null;
  itemImageUrl: string | null;
  itemRarity: ItemRarity | null;
  itemType: ItemType | null;
};

// The player's one active (in_progress or awaiting_claim) brew, if any —
// there's only one brewing stand, so at most one of these exists per
// player at a time.
export type ActiveBrewSummary = Pick<PotionBrewRow, "id" | "status" | "resolves_at"> & {
  potionName: string;
  potionImageUrl: string | null;
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

export type ForumCategoryRow = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type ForumThreadRow = {
  id: string;
  category_id: string;
  author_id: string;
  title: string;
  is_pinned: boolean;
  is_locked: boolean;
  reply_count: number;
  view_count: number;
  created_at: string;
  last_post_at: string;
};

export type ForumPostRow = {
  id: string;
  thread_id: string;
  author_id: string;
  body_raw: string;
  body_html: string;
  created_at: string;
  edited_at: string | null;
  edit_count: number;
  last_edited_by: string | null;
};

// A top-level forum category with its subcategories nested — how /forums
// and the admin category list both want the two-level hierarchy shaped,
// rather than a flat list callers re-group themselves.
export type ForumCategoryWithChildren = ForumCategoryRow & {
  children: ForumCategoryRow[];
};

// A thread as shown on a category page's thread list — author name
// resolved (via user_profiles, same pattern as TradeWithParticipants),
// nothing else joined in since posts are fetched separately per-thread.
export type ForumThreadListItem = Pick<
  ForumThreadRow,
  "id" | "title" | "is_pinned" | "is_locked" | "reply_count" | "view_count" | "created_at" | "last_post_at"
> & {
  authorId: string;
  authorName: string;
};

// A post as shown on a thread page — author name/avatar and the last
// editor's name (which may be a different person — an admin editing
// someone else's post) resolved.
export type ForumPostWithAuthor = Pick<
  ForumPostRow,
  "id" | "body_raw" | "body_html" | "created_at" | "edited_at" | "edit_count"
> & {
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  lastEditorName: string | null;
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
      pet_folders: TableOf<
        PetFolderRow,
        Partial<PetFolderRow> & { owner_id: string; name: string }
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
      potion_brews: TableOf<
        PotionBrewRow,
        Partial<PotionBrewRow> & { user_id: string; recipe_id: string; resolves_at: string }
      >;
      expeditions: TableOf<
        ExpeditionRow,
        Partial<ExpeditionRow> & {
          user_id: string;
          pet_id: string;
          zone_id: string;
          resolves_at: string;
        }
      >;
      admin_audit_log: TableOf<AdminAuditLogRow>;
      trades: TableOf<TradeRow>;
      trade_pets: TableOf<TradePetRow>;
      trade_items: TableOf<TradeItemRow>;
      marketplace_listings: TableOf<MarketplaceListingRow>;
      forum_categories: TableOf<ForumCategoryRow, Partial<ForumCategoryRow> & { name: string }>;
      forum_threads: TableOf<
        ForumThreadRow,
        Partial<ForumThreadRow> & { category_id: string; author_id: string; title: string }
      >;
      forum_posts: TableOf<
        ForumPostRow,
        Partial<ForumPostRow> & {
          thread_id: string;
          author_id: string;
          body_raw: string;
          body_html: string;
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
        Returns: ClaimExpeditionResult;
      };
      start_brew: {
        Args: {
          p_user_id: string;
          p_recipe_id: string;
        };
        Returns: string;
      };
      resolve_due_brews: {
        Args: { p_user_id: string };
        Returns: null;
      };
      claim_brew: {
        Args: {
          p_user_id: string;
          p_brew_id: string;
        };
        Returns: null;
      };
      expand_den: {
        Args: { p_user_id: string };
        Returns: ExpandDenResult;
      };
      admin_grant_self_currency: {
        Args: {
          p_admin_user_id: string;
          p_coin_delta: number;
          p_gem_delta: number;
        };
        Returns: AdminCurrencyGrantResult;
      };
      move_pet_to_folder: {
        Args: {
          p_user_id: string;
          p_pet_id: string;
          p_folder_id: string | null;
        };
        Returns: null;
      };
      rename_pet: {
        Args: {
          p_user_id: string;
          p_pet_id: string;
          p_name: string;
        };
        Returns: null;
      };
      change_display_name: {
        Args: {
          p_user_id: string;
          p_new_name: string;
        };
        Returns: ChangeDisplayNameResult;
      };
      create_trade: {
        Args: {
          p_initiator_id: string;
          p_recipient_id: string;
          p_pet_ids: string[];
          p_item_ids: string[];
          p_item_quantities: number[];
          p_coins: number;
          p_gems: number;
          p_note: string | null;
          p_requested_pet_ids?: string[];
          p_requested_item_ids?: string[];
          p_requested_item_quantities?: number[];
          p_requested_coins?: number;
          p_requested_gems?: number;
        };
        Returns: string;
      };
      respond_to_trade: {
        Args: {
          p_user_id: string;
          p_trade_id: string;
          p_accept: boolean;
          p_pet_ids?: string[];
          p_item_ids?: string[];
          p_item_quantities?: number[];
          p_coins?: number;
          p_gems?: number;
        };
        Returns: RespondToTradeResult;
      };
      cancel_trade: {
        Args: {
          p_user_id: string;
          p_trade_id: string;
        };
        Returns: null;
      };
      set_pet_for_trade: {
        Args: {
          p_user_id: string;
          p_pet_id: string;
          p_is_for_trade: boolean;
        };
        Returns: null;
      };
      set_item_for_trade: {
        Args: {
          p_user_id: string;
          p_item_id: string;
          p_is_for_trade: boolean;
        };
        Returns: null;
      };
      set_folder_pets_for_trade: {
        Args: {
          p_user_id: string;
          p_folder_id: string | null;
          p_is_for_trade: boolean;
        };
        Returns: null;
      };
      create_pet_listing: {
        Args: {
          p_seller_id: string;
          p_pet_id: string;
          p_price_coins: number | null;
          p_price_gems: number | null;
          p_duration_days: ListingDurationDays;
        };
        Returns: string;
      };
      create_item_listing: {
        Args: {
          p_seller_id: string;
          p_item_id: string;
          p_quantity: number;
          p_price_coins: number | null;
          p_price_gems: number | null;
          p_duration_days: ListingDurationDays;
        };
        Returns: string;
      };
      cancel_listing: {
        Args: {
          p_user_id: string;
          p_listing_id: string;
        };
        Returns: null;
      };
      resolve_expired_listings: {
        Args: Record<string, never>;
        Returns: null;
      };
      increment_thread_view_count: {
        Args: { p_thread_id: string };
        Returns: null;
      };
      buy_listing: {
        Args: {
          p_buyer_id: string;
          p_listing_id: string;
          p_currency: ListingCurrency;
        };
        Returns: BuyListingResult;
      };
    };
  };
};
