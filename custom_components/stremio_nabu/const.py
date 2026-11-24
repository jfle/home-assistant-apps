"""Constants for Stremio via Nabu Casa."""
DOMAIN = "stremio_nabu"
CONF_SUBS = "subtitles_url"
CONF_AIO = "aiostreams_url"
CONF_META = "aiometadata_url"
# The apps' plain-HTTP ports on Home Assistant's internal network (hostname = app slug with dashes).
DEFAULT_SUBS = "http://c9d8c4cb-greek-subtitles:7000"
DEFAULT_AIO = "http://c9d8c4cb-aiostreams:3000"
DEFAULT_META = "http://c9d8c4cb-aiometadata:3232"
PATHS = {"subs": "subs", "aio": "aio", "meta": "meta"}
