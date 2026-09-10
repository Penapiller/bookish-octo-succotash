-- Gardening was originally spec'd as 3 growth stages (0035_gardening.sql);
-- widened to 4 here. Just a 4th image column — the grow-timer/water/wilt
-- RPCs don't know or care how many visual stages there are, only the
-- app's stage calc (src/lib/garden.ts) does, so nothing else in SQL
-- changes.
alter table public.garden_plants
  add column image_stage4_url text;

comment on table public.garden_plants is
  'What a seed can grow into. Four stage images shown as the plant ages (see resolve_due_garden/the app''s stage calc); produce_item_id + a coins payout are granted on harvest.';

-- Seed data: give the 3 existing plants (0035_gardening.sql) a 4th-stage
-- image, same green as their stage-3 art so it still reads as the same
-- plant, just fully mature.
update public.garden_plants set image_stage4_url = 'https://placehold.co/400x400/15803d/FFFFFF/png?text=Carrot+Mature'
  where id = '00000000-0000-0000-0000-000000000701'; -- Carrot Plant
update public.garden_plants set image_stage4_url = 'https://placehold.co/400x400/15803d/FFFFFF/png?text=Sunflower+Mature'
  where id = '00000000-0000-0000-0000-000000000702'; -- Sunflower Plant
update public.garden_plants set image_stage4_url = 'https://placehold.co/400x400/15803d/FFFFFF/png?text=Pumpkin+Mature'
  where id = '00000000-0000-0000-0000-000000000703'; -- Pumpkin Plant
