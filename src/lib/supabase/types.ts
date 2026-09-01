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
  created_at: string;
};

export type PublicUserProfile = Pick<
  UserRow,
  "id" | "display_name" | "avatar_url" | "bio" | "created_at"
>;

export type Database = {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Partial<UserRow> & { id: string; email: string };
        Update: Partial<Omit<UserRow, "id">>;
        Relationships: [];
      };
    };
    Views: {
      user_profiles: {
        Row: PublicUserProfile;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
};
