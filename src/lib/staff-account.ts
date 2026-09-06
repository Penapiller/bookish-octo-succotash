// Seeded directly into auth.users/public.users by 0028_moderation_round_
// two.sql — see that migration for why a real account exists for this
// rather than a special-cased "system message" flag. Never a real
// session: nobody can sign in as it, so auth.uid() never equals this.
export const STAFF_USER_ID = "00000000-0000-0000-0000-000000000001";
