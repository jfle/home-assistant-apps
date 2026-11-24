# Changelog

## 2.38.1-3
- `public_url` may include a path, for the Nabu Casa address of the **Stremio via Nabu Casa** integration
  (e.g. `https://<id>.ui.nabu.casa/api/stremio/aio`) — no router port forwarding needed.

## 2.38.1-2
- One-time import of an Orange Pi install (`migrate_from`): database, secret key and admin login come across, so
  existing manifests, users and saved configurations keep working. Replaced data is kept in /data/pre-migration-*.

## 2.38.1-1
- The first start downloads reference data (anime mappings, SeaDex) for several minutes before AIOStreams opens its
  web server; the health check now waits up to 20 minutes, so Home Assistant no longer restarts it mid-download.
- The log says so while it happens.

## 2.38.1
- First Home Assistant app release: official AIOStreams v2.38.1 image with HTTPS (local-ip.sh), outside access via
  public IP + port forwarding or your own domain, generated secret key and admin login kept across updates, and the
  Greek-subtitles templates preloaded.
