-- The brewing UI is being redesigned around 3 physical ingredient slots
-- (see brewing-stand.tsx). Both existing recipes only need 2 total
-- ingredient units, so the 3rd slot would never actually get exercised by
-- anything — this adds one recipe that uses all 3, reusing the existing
-- ingredient items (no new ingredient item needed, just a new potion).
--
-- Note for later recipes (admin panel or otherwise): this UI's slot count
-- is a hard cap — a recipe needing more than 3 total ingredient units
-- could never be assembled in it. Keep recipes at <=3 total units, or
-- grow the slot count if that ever needs to change.
insert into public.items (id, name, type, rarity, image_url, sell_value) values
  ('00000000-0000-0000-0000-000000000403', 'Potion Placeholder C', 'potion', 'rare', 'https://placehold.co/400x400/7e22ce/FFFFFF/png?text=Potion+C', 0);

insert into public.potion_recipes (id, output_potion_item_id, effect_type, effect_magnitude, is_active) values
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000403', 'duration_reduction', 0.65, true);

insert into public.potion_recipe_ingredients (recipe_id, item_id, quantity_required) values
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000301', 1), -- Item Placeholder A
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000302', 1), -- Item Placeholder B
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000303', 1); -- Item Placeholder C
