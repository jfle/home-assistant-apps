"""Stremio via Nabu Casa.

Publishes the Greek Subtitles, AIOStreams and AIOMetadata apps under Home Assistant's own web server, so Stremio reaches them
through your Nabu Casa remote address (https://<id>.ui.nabu.casa/api/stremio/subs and /api/stremio/aio) — no router
port forwarding, no extra certificates.

Only what Stremio needs passes through Home Assistant: manifests, stream lists, subtitles and short redirects.
The video itself always comes straight from the debrid service / source to the player.
"""
from __future__ import annotations

import asyncio
import logging

import aiohttp
from aiohttp import hdrs, web

from homeassistant.components.http import HomeAssistantView
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_create_clientsession

from .const import CONF_AIO, CONF_META, CONF_SUBS, DEFAULT_AIO, DEFAULT_META, DEFAULT_SUBS, DOMAIN, PATHS

_LOGGER = logging.getLogger(__name__)
PLATFORMS = [Platform.SENSOR]

HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "trailers",
    "transfer-encoding", "upgrade", "host", "content-length",
}
# never hand Home Assistant's own login cookies / tokens to the apps
PRIVATE = {"authorization", "cookie"}
# ask the apps for plain bodies: Home Assistant streams them on as-is (and may compress them itself)
NO_FORWARD = {"accept-encoding"}
MAX_BODY = 4 * 1024 * 1024
TIMEOUT = aiohttp.ClientTimeout(total=300, sock_connect=10)


class StremioProxyView(HomeAssistantView):
    """Forward /api/stremio/<app>/... to the app container (plain HTTP on the internal network)."""

    requires_auth = False  # Stremio cannot sign in; the apps keep their own protection (config password, uuid+password)
    cors_allowed = False   # the apps send their own CORS headers

    def __init__(self, hass: HomeAssistant, key: str) -> None:
        self.key = key
        self.url = f"/api/stremio/{PATHS[key]}" + "/{path:.*}"
        self.extra_urls = [f"/api/stremio/{PATHS[key]}"]
        self.name = f"api:{DOMAIN}:{key}"
        self.hass = hass
        self.session = async_create_clientsession(hass, auto_cleanup=True, auto_decompress=False)

    def _target(self) -> str | None:
        data = self.hass.data.get(DOMAIN)
        return data.get(self.key) if data else None

    async def _handle(self, request: web.Request, path: str = "") -> web.StreamResponse:
        target = self._target()
        if not target:
            return web.Response(status=503, text="Stremio via Nabu Casa is not set up")
        prefix = f"/api/stremio/{PATHS[self.key]}"
        url = f"{target}/{path}"
        if request.query_string:
            url += f"?{request.query_string}"

        headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP | PRIVATE | NO_FORWARD}
        headers["X-Forwarded-Host"] = request.host
        headers["X-Forwarded-Proto"] = request.headers.get("X-Forwarded-Proto", "https")
        headers["X-Forwarded-Prefix"] = prefix
        if request.remote:
            headers["X-Forwarded-For"] = request.remote
            headers["X-Real-IP"] = request.remote

        body = None
        if request.method not in ("GET", "HEAD", "OPTIONS") and request.can_read_body:
            body = await request.content.read(MAX_BODY + 1)
            if len(body) > MAX_BODY:
                return web.Response(status=413, text="Request too large")

        try:
            async with self.session.request(
                request.method, url, headers=headers, data=body, allow_redirects=False, timeout=TIMEOUT
            ) as up:
                out = {k: v for k, v in up.headers.items() if k.lower() not in HOP | {"set-cookie"}}
                loc = up.headers.get(hdrs.LOCATION)
                if loc and loc.startswith("/") and not loc.startswith("//"):
                    out[hdrs.LOCATION] = prefix + loc  # keep the app's own redirects inside the prefix
                resp = web.StreamResponse(status=up.status, headers=out)
                if up.content_length is not None:
                    resp.content_length = up.content_length
                await resp.prepare(request)
                if request.method != "HEAD":
                    async for chunk in up.content.iter_chunked(64 * 1024):
                        await resp.write(chunk)
                await resp.write_eof()
                return resp
        except (aiohttp.ClientError, asyncio.TimeoutError) as err:
            _LOGGER.debug("%s unreachable at %s: %s", self.key, target, err)
            return web.Response(status=502, text=f"The {self.key} app is not reachable")

    async def get(self, request: web.Request, path: str = "") -> web.StreamResponse:
        return await self._handle(request, path)

    async def post(self, request: web.Request, path: str = "") -> web.StreamResponse:
        return await self._handle(request, path)

    async def put(self, request: web.Request, path: str = "") -> web.StreamResponse:
        return await self._handle(request, path)

    async def delete(self, request: web.Request, path: str = "") -> web.StreamResponse:
        return await self._handle(request, path)

    async def options(self, request: web.Request, path: str = "") -> web.StreamResponse:
        return await self._handle(request, path)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    conf = {**entry.data, **entry.options}
    first = DOMAIN not in hass.data
    hass.data[DOMAIN] = {
        "subs": str(conf.get(CONF_SUBS, DEFAULT_SUBS)).rstrip("/"),
        "aio": str(conf.get(CONF_AIO, DEFAULT_AIO)).rstrip("/"),
        "meta": str(conf.get(CONF_META, DEFAULT_META)).rstrip("/"),
    }
    if first:  # views cannot be removed again, so register them once per Home Assistant run
        for key in PATHS:
            hass.http.register_view(StremioProxyView(hass, key))
    entry.async_on_unload(entry.add_update_listener(_reload))
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def _reload(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if ok:
        hass.data[DOMAIN] = {}  # views stay registered but answer 503 until set up again
    return ok
