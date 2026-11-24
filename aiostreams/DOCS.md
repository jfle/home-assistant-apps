# AIOStreams (Greek setup)

## First start
1. **Start** the app and open the **Log**: it shows the home-network and outside addresses, the router rule and the
   admin login (generated on first start, kept across updates).
2. Open the address, sign in, pick the template **"Tablet (11") — best picture with Greek subtitles that fit"** (or
   *English Movies and TV with Greek Subtitles*), add your debrid service (AllDebrid…) and install.
3. Add the **Greek Subtitles** install link as a custom addon inside AIOStreams so Stremio needs just this one.

## Outside access and port forwarding
| External port | Internal IP | Internal port | Protocol |
|---|---|---|---|
| **8454** (Public port) | your Home Assistant IP | **8454** (Network tab) | TCP |

The outside address is `https://<public-ip-with-dashes>.local-ip.sh:8454` (free local-ip.sh certificate), or your
own domain under *Own outside address*. *Require login to use the addon* makes AIOStreams ask for the login before
anyone can create a configuration (recommended with a public domain).

## Moving your configuration from the Orange Pi
In the Pi's AIOStreams open your configuration → **Export**, then **Import** it here. The Pi keeps working (it uses
8444; this app uses 8454) until you remove it.

## Version
The app version follows the AIOStreams release it packages (v2.38.1). Updates arrive as app updates in Home Assistant.
