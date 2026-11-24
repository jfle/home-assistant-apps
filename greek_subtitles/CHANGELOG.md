# Changelog

## 3.0.1
- One-time import of an Orange Pi install (`migrate_from`): secret key, provider sign-ins, settings and configuration
  password come across, so existing Stremio install links keep working. Replaced data is kept in /data/pre-migration-*.

## 3.0.0
- First Home Assistant app release, packaging [AIO-Streams&Subtitles-Greek 3.0.0](https://github.com/jfle/aio-streams-subtitles-greek/releases/tag/v3.0.0):
  real subtitles first and retimed (split-aware sync), local model checked once per session, AI backup.
- HTTPS with the local-ip.sh wildcard certificate (refreshed automatically), outside access via public IP + port
  forwarding or your own domain, generated configuration password kept across updates.
