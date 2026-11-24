"""Config flow for Stremio via Nabu Casa."""
from __future__ import annotations

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback

from .const import CONF_AIO, CONF_META, CONF_SUBS, DEFAULT_AIO, DEFAULT_META, DEFAULT_SUBS, DOMAIN


def _schema(cur: dict) -> vol.Schema:
    return vol.Schema({
        vol.Required(CONF_SUBS, default=cur.get(CONF_SUBS, DEFAULT_SUBS)): str,
        vol.Required(CONF_AIO, default=cur.get(CONF_AIO, DEFAULT_AIO)): str,
        vol.Required(CONF_META, default=cur.get(CONF_META, DEFAULT_META)): str,
    })


class StremioNabuConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None) -> ConfigFlowResult:
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title="Stremio via Nabu Casa", data=user_input)
        return self.async_show_form(step_id="user", data_schema=_schema({}))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return StremioNabuOptionsFlow()


class StremioNabuOptionsFlow(OptionsFlow):
    async def async_step_init(self, user_input=None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        return self.async_show_form(step_id="init", data_schema=_schema({**self.config_entry.data, **self.config_entry.options}))
