# Changelog

## 3.0.3
- The log (and /data/install-links.txt) shows ready-made Stremio install links at every start — home network and anywhere
  (e.g. Nabu Casa) — so the addon can be installed without typing the configuration password.

## 3.0.2
- Packages AIO-Streams&Subtitles-Greek 3.0.1 (configure page works behind a path prefix).
- `public_url` may include a path, for the Nabu Casa address of the **Stremio via Nabu Casa** integration
  (e.g. `https://<id>.ui.nabu.casa/api/stremio/subs`) — no router port forwarding needed.

## 3.0.1
- One-time import of an Orange Pi install (`migrate_from`): secret key, provider sign-ins, settings and configuration
  password come across, so existing Stremio install links keep working. Replaced data is kept in /data/pre-migration-*.

## 3.0.0
- First Home Assistant app release, packaging [AIO-Streams&Subtitles-Greek 3.0.0](https://github.com/jfle/aio-streams-subtitles-greek/releases/tag/v3.0.0):
  real subtitles first and retimed (split-aware sync), local model checked once per session, AI backup.
- HTTPS with the local-ip.sh wildcard certificate (refreshed automatically), outside access via public IP + port
  forwarding or your own domain, generated configuration password kept across updates.
