# Fletouris Stremio Apps for Home Assistant

[![Add repository to Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fjfle%2Fhome-assistant-apps)

Home Assistant **apps** (formerly add-ons) that run the Stremio setup from
[AIO-Streams&Subtitles-Greek](https://github.com/jfle/aio-streams-subtitles-greek) on your Home Assistant machine,
with the same HTTPS, outside access and port forwarding as the Orange Pi installer.

| App | What it does |
|---|---|
| [Greek Subtitles for Stremio](greek_subtitles) | Real Greek subtitles first (OpenSubtitles, retimed to your release with split-aware sync), AI translation as backup. Free local model first when your PC answers, then your cloud providers. |
| [AIOStreams (Greek setup)](aiostreams) | AIOStreams with HTTPS, outside access and the Greek-subtitles templates (tablet 1080p / English + Greek). |

## Install
1. Click the button above, or go to **Settings → Apps → Install app → ⋮ → Repositories** and add
   `https://github.com/jfle/home-assistant-apps`.
2. Install **Greek Subtitles for Stremio** (and **AIOStreams** if you want it here too), then **Start**.
3. Open the app's **Log**: it shows your home-network and outside addresses, the router port forwarding to set up,
   and the generated passwords.

> **Not HACS:** HACS installs integrations and dashboard cards, not apps. Apps are installed from the app store with
> this repository URL, and Home Assistant offers their updates like any other app.

## Stremio via Nabu Casa
Have Home Assistant Cloud (Nabu Casa)? Use it instead of router port forwarding. This repository also holds a small
integration, **Stremio via Nabu Casa**, that publishes both apps on your Nabu Casa address:

| | Address |
|---|---|
| Greek Subtitles | `https://<id>.ui.nabu.casa/api/stremio/subs` (configure page: `/configure`, needs the configuration password) |
| AIOStreams | `https://<id>.ui.nabu.casa/api/stremio/aio` (Stremio endpoints; open its web page at home) |

1. **Marketplace / HACS → ⋮ → Custom repositories** → `jfle/home-assistant-apps`, type *Integration* → download
   **Stremio via Nabu Casa**, restart Home Assistant.
2. **Settings → Devices & services → Add integration → Stremio via Nabu Casa** (defaults fit these apps). Its
   *Remote address* sensor shows your exact URLs.
3. Set each app's `public_url` to its address above and restart the app; reinstall the addons in Stremio from the new links.

Only manifests, stream lists, subtitles and short redirects pass through Home Assistant — the video always comes straight
from your debrid service to the player.
## Running next to the Orange Pi
These apps use their own ports (**8453** subtitles, **8454** AIOStreams) so they don't collide with the Pi
installation (8443 / 8444). Both can run at the same time; Stremio uses whichever addon link you installed.
