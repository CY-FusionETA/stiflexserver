---
name: track-truck
description: Fetch the live GPS position of the Malaysia->Singapore truck from the TDT GPS share link and post a status update into the Bitrix24 "Logistics Tracking Unit" workgroup chat. Use whenever asked to check the truck's location, post a GPS update, or troubleshoot the automated hourly tracking.
---

# Truck GPS Tracker

Posts a one-off location update for the Malaysia -> Singapore truck into the
Bitrix24 **Logistics Tracking Unit** workgroup chat (`chat8035`, Bitrix24
workgroup ID 47, members include Yanyi Yap / user ID 5).

This same logic runs automatically every hour from 7am to 12am (midnight)
Malaysia/Singapore time (UTC+8) via a scheduled Routine — see "Automated
schedule" below. Invoke this skill manually for an on-demand check or to
debug a failure.

## How it works

The GPS provider (`live.tdtgps.com`, "AoooG" tracking platform) does not
expose a plain REST endpoint for share links — the web UI talks to the
server over a raw WebSocket. The script in this skill replicates that
protocol:

1. Open `wss://live.tdtgps.com:9662/`.
2. On open, send `{"type":"share_location","data":"<share token>"}`.
3. Wait for a reply of `{"type":"share_location","data":"<double-JSON-encoded array>"}`.
   Parse it twice (`JSON.parse(JSON.parse(msg.data))`) to get an array whose
   first element is the device row (`Latitude`, `Longitude`, `Alias`,
   `location`, `speed`, `acc` (ignition ON/OFF), `gpsDateTime`,
   `parkingDuration`, ...).
4. Format a short message and post it via Bitrix24 `im.message.add` with
   `DIALOG_ID: "chat8035"`.

## Running it

```bash
node scripts/gps-tracker/track-truck.mjs
```

Requires Node 22+ (uses the built-in global `WebSocket` and `fetch`). No
external npm dependencies.

Configuration is via env vars, each with a working default already baked
into the script — override only if something changes:

| Env var | Default / purpose |
|---|---|
| `GPS_SHARE_TOKEN` | The TDT GPS share.html token. **This is the piece most likely to need updating** — share links can expire or be regenerated. Get a fresh one from whoever manages the tracker device, and grab the `token=` query param from the new `https://live.tdtgps.com/share.html?token=...` link. |
| `GPS_WS_URL` | `wss://live.tdtgps.com:9662/` |
| `BITRIX_WEBHOOK` | `https://dyntek.bitrix24.com/rest/445/4nzkjjyoek5sz58t` (Claude Stiflex webhook, user 445) |
| `BITRIX_CHAT_DIALOG_ID` | `chat8035` (Logistics Tracking Unit workgroup chat) |

If the GPS fetch fails (expired token, network issue, timeout), the script
posts a warning message to the same chat instead of failing silently, so the
team knows tracking is broken.

## Bitrix24 webhook scope note

Posting into an actual workgroup Messenger chat (as opposed to the
workgroup's Feed/Discussion wall) requires the `im` and `socialnetwork`
scopes on the webhook (user 445). Both were added 2026-09-15. If chat posts
start failing with `insufficient_scope`, check
`https://dyntek.bitrix24.com/rest/445/4nzkjjyoek5sz58t/scope` and ask an
admin (Joseph) to re-grant `im` + `socialnetwork`.

## Automated schedule

A Routine named **"Truck GPS Tracking - Logistics Tracking Unit"** fires
hourly, 7:00–24:00 Malaysia/Singapore time (UTC+8) daily (quiet 1am–6am),
running this same script in a fresh session each time. To change the
schedule or investigate a missed run, use `list_triggers` /
`update_trigger` on that Routine.
