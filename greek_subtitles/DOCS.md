# Greek Subtitles for Stremio

## First start
1. **Start** the app and open the **Log** tab. You'll see:
   ```
   home network: https://192-168-1-128.local-ip.sh:8453/configure
   outside:      https://194-154-34-26.local-ip.sh:8453/configure
   router:       forward TCP 8453 → 192.168.1.128 port 8453
   configuration password: ••••••••••••••••
   ```
2. Open the **home network** address, enter the configuration password, choose your AI provider
   (sign in or paste a key), **Test translation**, then **Generate install link → Install in Stremio**.
   Choose **Anywhere** to get the link that also works away from home.

## How the addresses work (HTTPS without a domain)
Stremio only accepts HTTPS addons with a publicly trusted certificate. Like the Orange Pi installer, the app uses
the free wildcard certificate of [local-ip.sh](https://local-ip.sh): `192-168-1-128.local-ip.sh` resolves to
`192.168.1.128`, and the certificate for `*.local-ip.sh` is valid for it. The certificate is downloaded on start and
refreshed automatically.

## Outside access and port forwarding
With **Outside access** on (default), the outside address is `https://<public-ip-with-dashes>.local-ip.sh:<public port>`.
On your router add a port forwarding ("virtual server") rule:

| External port | Internal IP | Internal port | Protocol |
|---|---|---|---|
| **8453** (Public port) | your Home Assistant IP | **8453** (Network tab) | TCP |

- The configure page then asks for the **configuration password** (generated on first start, shown in the log, kept
  across updates; set your own under *Configuration password*). Wrong passwords are slowed down and locked out
  after 10 tries for 15 minutes.
- Your public IP changed? Restart the app (or set it under *Public IP*).
- Own domain or tunnel (Cloudflare, Tailscale Funnel…)? Put it in *Own outside address*; no port forwarding needed
  then.
- The log checks the outside address 15 s after start. Many routers can't loop back to their own public IP, so if
  it says it couldn't confirm, test from a phone on mobile data.

## Ports (Network tab)
| Container port | Default host port | Use |
|---|---|---|
| 8453/tcp | 8453 | HTTPS for Stremio — needed |
| 7000/tcp | off | plain HTTP, home network only (debugging) |

If you change the host port, the addresses in the log follow it; forward the new port on the router.

## Local model (free, first)
Set *Local model* to your LM Studio server, e.g. `http://192.168.1.35:1234/v1` (Llama-Krikri-8B-Instruct). The app
checks its port once per session; when the PC is off it goes straight to your cloud providers.

## With AIOStreams
Install the **AIOStreams (Greek setup)** app from this repository and put its address in *AIOStreams address*
(e.g. `https://192-168-1-128.local-ip.sh:8454`). In AIOStreams, add this addon's install link as a custom addon so
Stremio needs only one addon.

## Moving from the Orange Pi
Both can run at the same time (this app uses 8453, the Pi 8443). To move completely: install the new link in
Stremio, change the router rule to Home Assistant, then uninstall the Pi version. AI sign-ins are made again on the
new configure page.

## Data
Settings, sign-ins, translation cache and logs are kept in the app's data folder and included in Home Assistant
backups.
