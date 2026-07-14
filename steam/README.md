# Steam upload files

These `*.example.vdf` files are **templates**. Copy each to the same name without
`.example` and replace every `<PLACEHOLDER>`:

- `app_build.example.vdf` → `app_build.vdf`
- `depot_windows.example.vdf` → `depot_windows.vdf`

`app_build.vdf`, `depot_windows.vdf`, and anything containing credentials are
git-ignored — **never commit them**.

Full step-by-step instructions (for absolute beginners) are in
[`../docs/HOW_TO_PUBLISH_ON_STEAM.md`](../docs/HOW_TO_PUBLISH_ON_STEAM.md).

Quick reference:

1. `npm run build:steam` — assembles `release/steam/windows/`.
2. `npm run verify:steam` — checks the folder is safe to upload.
3. From the Steamworks SDK: `steamcmd +login <user> +run_app_build <abs-path>\app_build.vdf +quit`.
