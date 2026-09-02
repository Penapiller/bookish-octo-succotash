# Game assets drop folder

Drop real art here and I'll wire it into the admin panel (upload to
Supabase Storage, set `image_url`) instead of the `placehold.co`
placeholders — no need to go through the admin UI file upload yourself
for a batch of files.

## How to use this

1. Put image files in the matching subfolder below.
2. Name each file after the thing it's art for, using the same name
   shown in the admin panel (spaces/case don't matter — I'll match
   loosely, e.g. `golden-retriever.png`, `Golden Retriever.png`, and
   `golden_retriever.png` all match a species named "Golden Retriever").
   If a file's name doesn't clearly match anything, I'll ask rather than
   guess.
3. Either:
   - **Attach the files directly in our chat** and tell me they're for
     this folder — I'll save them here myself, or
   - **Commit and push them yourself** if you have a local clone, then
     tell me they're ready.
4. Ask me to "plug in the new assets" (or similar) and I'll go through
   this folder, match files to existing rows, upload each to Storage,
   and update `image_url`. Anything already using this same art doesn't
   need re-uploading — I'll check first.

## Folders

- `species/` — pet art (used on the expeditions map, pets/inventory
  pages, claim popups)
- `items/` — item/ingredient/potion art
- `zones/` — zone hero images and map hotspot art
- `other/` — anything that doesn't fit the above (site logo, UI icons,
  etc.) — just tell me what it's for

## Formats

Same limits as the admin panel's own upload: PNG, JPEG, WebP, or GIF, up
to 5 MB each (see `0010_game_image_storage.sql`).

Files placed here aren't live in the game until I process them — this
folder is just the inbox, not what players see.
