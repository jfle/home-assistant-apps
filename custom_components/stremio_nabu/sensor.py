"""A sensor showing the Stremio addresses on your Nabu Casa remote URL."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, PATHS


def remote_base(hass: HomeAssistant) -> str | None:
    try:
        from homeassistant.components import cloud  # noqa: PLC0415

        return cloud.async_remote_ui_url(hass).rstrip("/")
    except Exception:  # noqa: BLE001 - cloud missing, not logged in or remote UI off
        return None


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, add: AddEntitiesCallback) -> None:
    add([StremioAddressSensor(entry)], update_before_add=True)


class StremioAddressSensor(SensorEntity):
    _attr_has_entity_name = True
    _attr_name = "Remote address"
    _attr_icon = "mdi:cloud-lock"
    _attr_should_poll = True

    def __init__(self, entry: ConfigEntry) -> None:
        self._attr_unique_id = f"{entry.entry_id}_remote"

    async def async_update(self) -> None:
        base = remote_base(self.hass)
        self._attr_native_value = base or "Nabu Casa remote access is off"
        self._attr_extra_state_attributes = {
            "subtitles_url": f"{base}/api/stremio/{PATHS['subs']}" if base else None,
            "subtitles_configure": f"{base}/api/stremio/{PATHS['subs']}/configure" if base else None,
            "aiostreams_url": f"{base}/api/stremio/{PATHS['aio']}" if base else None,
            "aiometadata_url": f"{base}/api/stremio/{PATHS['meta']}" if base else None,
        }
