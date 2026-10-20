# Oxitune plugins

Plugins for [Oxitune](https://github.com/7moons/Oxitune), the open source
desktop client for YouTube Music, and the official signed registry Oxitune
installs them from. Maintained by [7moons](https://github.com/7moons).

This repository, `7moons/oxitune-plugins`, is the official registry. Its index is
published to GitHub Pages:

- index: `https://7moons.github.io/oxitune-plugins/index.json`
- public key (also in `minisign.pub`, key id `2254F07B14D10D3E`):
  `RWQ+DdEUe/BUIiUnj3ovEvBOs/mbG7mVy+1yR0/0VqkAAKX/36+pTw34`

Oxitune refuses anything that isn't signed with that key. Users can add other
registries in **Settings → Plugins → Registries** with their own address
and key.

| Plugin | What it does | Permissions |
|---|---|---|
| `app.oxitune.example-theme` | The smallest useful plugin: an accent color over YouTube Music | `ui` |
| `app.oxitune.adblock` | Removes ad scheduling from YouTube Music's responses; mutes, hides and skips what slips through | `player:read`, `page`, `ui` |
| `app.oxitune.downloader` | A player-bar button that saves the current song with yt-dlp (which the user installs) | `player:read`, `page`, `ui`, `media:save` |
| `app.oxitune.sponsorblock` | Skips intros, outros and other non-music parts using the SponsorBlock database | `player:read`, `player:control`, `network` (`sponsor.ajay.app`) |

The plugin API itself (manifest, permissions, the `oxitune` object) is
documented in Oxitune's [`docs/PLUGIN_API.md`](https://github.com/7moons/Oxitune/blob/main/docs/PLUGIN_API.md).

## Layout

```
plugins/<id>/manifest.json     what the plugin is and may do
plugins/<id>/main.js           its code (the manifest's "entry")
plugins/<id>/*.css             optional styles (the manifest's "styles")
plugins/<id>/*.test.ts         tests, never packed
scripts/build-index.ts         builds dist/: archives + index.json
.github/workflows/release.yml  on a tag: build, sign, publish to Pages
```

The folder name must be the plugin's `id`.

## Manifest

```json
{
  "id": "com.example.my-plugin",
  "name": "My plugin",
  "version": "1.2.0",
  "apiVersion": 1,
  "description": "One sentence users see before installing.",
  "author": "Your name",
  "homepage": "https://example.com/my-plugin",
  "matches": ["https://music.youtube.com/*"],
  "runAt": "document-idle",
  "permissions": ["player:read", "ui"],
  "hosts": [],
  "entry": "main.js",
  "styles": ["style.css"],
  "settings": [
    { "key": "enabled_feature", "type": "boolean", "label": { "en": "Do the thing", "pl": "Rób to" }, "default": true }
  ]
}
```

- `id`: reverse-DNS, lower case, also the folder name. Never change it.
- `version`: semver. Oxitune installs updates automatically when the new
  version asks for **no** new permissions; otherwise the user is asked.
- `apiVersion`: `1`.
- `permissions`: any of `player:read`, `player:control`, `page`, `storage`,
  `network`, `ui`, `media:save`. `network` needs `hosts` (plain host names, https only).
- `runAt`: `document-start` (before YouTube Music's own scripts, e.g. to
  wrap `fetch`) or `document-idle` (default).
- `settings`: rendered in Oxitune's Settings; types `boolean`, `number`
  (`min`/`max`), `string`, `select` (`options`). Labels are a string or
  `{ "en": ..., "pl": ... }`.

## Adding a plugin

1. Create `plugins/<id>/` with a manifest and the entry script. Plain
   JavaScript, no build step, no network access outside `hosts`, no native
   code. The entry script gets a `oxitune` object; see the example theme.
2. Export pure functions for tests with
   `if (typeof module !== 'undefined') module.exports = { ... }` and put
   `bun:test` tests next to it (`*.test.ts`, not packed).
3. `bun test && bun scripts/build-index.ts` locally.
4. Open a pull request. Review it like code that runs inside every user's
   YouTube Music session, because it does.
5. To publish, bump `version` in the manifest and push a tag (`v2026.09.24`).

## Signing key

The registry has its own minisign key, separate from Oxitune's updater key.
The public half is `minisign.pub` and is built into Oxitune
(`src-tauri/src/plugins/registry.rs`, `OFFICIAL_KEY`); changing it means
shipping an Oxitune update first.

Once, when creating the repository:

- Store the full contents of the secret key file as the repository secret
  `MINISIGN_SECRET_KEY` and its password as `MINISIGN_PASSWORD`, then keep
  the file offline (or delete it). Never commit it.
- Enable GitHub Pages with "GitHub Actions" as the source.

A lost or leaked secret key: generate a new pair
(`minisign -G -p minisign.pub -s registry.key`), release Oxitune with the new
`OFFICIAL_KEY`, then re-sign the registry with it.

## What the registry publishes

`index.json` (`format: 1`) lists for every plugin: `id`, `name`, `version`,
`apiVersion`, `description`, `author`, `permissions`, `url` of its
`.tar.gz`, and the archive's `sha256`. `index.json.minisig` signs the whole
index, so the checksums, and through them every archive, are covered by
the registry key. Oxitune additionally checks that each archive's manifest
matches its index entry (id, version, permissions) before installing it.

## Legal

These plugins are independent work, not affiliated with, endorsed by or
sponsored by Google LLC, YouTube or SponsorBlock. "YouTube" and "YouTube
Music" are trademarks of Google LLC. This repository contains no music,
videos, lyrics or other copyrighted media, and no plugin decrypts or bypasses
any technical protection measure. `app.oxitune.downloader` only hands a song
id to [yt-dlp](https://github.com/yt-dlp/yt-dlp), which the user installs and
runs on their own machine. Users are responsible for following YouTube's
Terms of Service and the laws of their country. If you believe something here
infringes your rights, open an issue so it can be reviewed and fixed quickly.

## License

[MIT](LICENSE). Copyright © 2026 7moons and contributors. Oxitune itself is
licensed under GPL-3.0-only.
