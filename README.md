<h1 align="center">Oxitune plugins</h1>

<p align="center">
  <b>The official, signed plugin registry for <a href="https://github.com/7moons/Oxitune">Oxitune</a>.</b><br>
  Plain JavaScript plugins with declared permissions, packed, hashed and signed on every release.
</p>

<p align="center">
  <a href="https://github.com/7moons/oxitune-plugins/actions/workflows/ci.yml"><img src="https://github.com/7moons/oxitune-plugins/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/7moons/oxitune-plugins/actions/workflows/release.yml"><img src="https://github.com/7moons/oxitune-plugins/actions/workflows/release.yml/badge.svg" alt="Release"></a>
  <a href="https://7moons.github.io/oxitune-plugins/index.json"><img src="https://img.shields.io/badge/registry-index.json-informational.svg" alt="registry index"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
</p>

<p align="center">
  <a href="#plugins">Plugins</a> ·
  <a href="#using-the-registry">Using it</a> ·
  <a href="#writing-a-plugin">Writing one</a> ·
  <a href="#manifest">Manifest</a> ·
  <a href="#how-it-is-signed">Signing</a> ·
  <a href="#legal">Legal</a>
</p>

## Plugins

| Plugin | What it does | Permissions |
| --- | --- | --- |
| `app.oxitune.example-theme` | The smallest useful plugin: tints the progress bar and buttons with an accent you pick | `ui` |
| `app.oxitune.sponsorblock` | Skips intros, outros and other non-music parts of music videos, using the community SponsorBlock database | `player:read`, `player:control`, `network` (`sponsor.ajay.app`) |
| `app.oxitune.adblock` | Removes ad scheduling from YouTube Music's responses and mutes, hides and skips what slips through, never touching playback timing | `player:read`, `page`, `ui` |
| `app.oxitune.downloader` | A player-bar button that saves the current song to your music folder with [yt-dlp](https://github.com/yt-dlp/yt-dlp), which you choose to install | `player:read`, `page`, `ui`, `media:save` |

Install them in Oxitune under **Settings → Plugins**. You see each plugin's permissions before it
installs, and again before any update that asks for more.

## Using the registry

Oxitune has this registry built in. Its index is published on GitHub Pages:

| | |
| --- | --- |
| Index | `https://7moons.github.io/oxitune-plugins/index.json` |
| Public key | `RWQ+DdEUe/BUIiUnj3ovEvBOs/mbG7mVy+1yR0/0VqkAAKX/36+pTw34` (key id `2254F07B14D10D3E`, also in `minisign.pub`) |

Oxitune refuses an index that is not signed with that key and an archive that does not match its
signed checksum. Other registries can be added in **Settings → Plugins → Registries**, each with
its own address and key.

## Writing a plugin

1. Create `plugins/<id>/` with a `manifest.json` and the entry script. Plain JavaScript: no build
   step, no native code, no network outside the hosts the manifest lists. The script gets an
   `oxitune` object; the [example theme](plugins/app.oxitune.example-theme) shows the shape.
2. Export pure functions for tests with
   `if (typeof module !== 'undefined') module.exports = { ... }` and put `bun:test` tests next to
   the plugin (`*.test.ts`, never packed).
3. Run `bun test && bun scripts/build-index.ts` locally.
4. Open a pull request. It is reviewed like code that runs inside every user's YouTube Music
   session, because it does.
5. To publish, bump `version` in the manifest and push a tag such as `v2026.10.20`.

The full API (lifecycle, permissions, the `oxitune` object, settings and storage) is in Oxitune's
[`docs/PLUGIN_API.md`](https://github.com/7moons/Oxitune/blob/main/docs/PLUGIN_API.md). To try a
plugin without publishing it, turn on developer mode in Oxitune and load its folder.

```
plugins/<id>/manifest.json     what the plugin is and may do
plugins/<id>/main.js           its code (the manifest's "entry")
plugins/<id>/*.css             optional styles (the manifest's "styles")
plugins/<id>/*.test.ts         tests, never packed
scripts/build-index.ts         builds dist/: archives and index.json
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

| Field | Rule |
| --- | --- |
| `id` | Reverse-DNS, lower case, the same as the folder name. Never change it. |
| `version` | Semver. An update that asks for no new permissions installs by itself; otherwise the user is asked. |
| `apiVersion` | `1` |
| `permissions` | Any of `player:read`, `player:control`, `page`, `storage`, `network`, `ui`, `media:save` |
| `hosts` | Plain host names, https only; required with `network` |
| `runAt` | `document-start` (before YouTube Music's own scripts, e.g. to wrap `fetch`) or `document-idle` (default) |
| `settings` | Shown in Oxitune's Settings: `boolean`, `number` (`min`, `max`), `string`, `select` (`options`); labels are a string or `{ "en": ..., "pl": ... }` |

## How it is signed

`index.json` (`format: 1`) lists every plugin's `id`, `name`, `version`, `apiVersion`,
`description`, `author`, `permissions`, the `url` of its `.tar.gz` and the archive's `sha256`.
`index.json.minisig` signs the whole index, so the checksums, and through them every archive, are
covered by the registry key. Oxitune also checks that each archive's manifest matches its index
entry (id, version, permissions) before installing it.

The registry key is its own minisign pair, separate from Oxitune's updater key. The public half is
`minisign.pub` and is built into Oxitune (`src-tauri/src/plugins/registry.rs`, `OFFICIAL_KEY`), so
changing it means shipping an Oxitune update first.

<details>
<summary>Setting up and rotating the key</summary>

Once, when creating the repository:

- Store the full contents of the secret key file as the repository secret `MINISIGN_SECRET_KEY`
  and its password as `MINISIGN_PASSWORD`, then keep the file offline or delete it. Never commit
  it.
- Enable GitHub Pages with "GitHub Actions" as the source.

A lost or leaked secret key: generate a new pair (`minisign -G -p minisign.pub -s registry.key`),
release Oxitune with the new `OFFICIAL_KEY`, then re-sign the registry with it.

</details>

## Legal

These plugins are independent work, not affiliated with, endorsed by or sponsored by Google LLC,
YouTube or SponsorBlock. "YouTube" and "YouTube Music" are trademarks of Google LLC. This
repository contains no music, videos, lyrics or other copyrighted media, and no plugin decrypts or
bypasses a technical protection measure. `app.oxitune.downloader` only hands a song id to yt-dlp,
which the user installs and runs on their own machine. Users are responsible for following
YouTube's Terms of Service and the laws of their country. If you believe something here infringes
your rights, open an issue so it can be reviewed and fixed quickly.

## License

[MIT](LICENSE). Copyright © 2026 7moons and contributors. Oxitune itself is licensed under
GPL-3.0-only.
