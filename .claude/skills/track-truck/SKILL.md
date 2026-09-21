---
name: track-truck
description: Fetch the live GPS position of the Malaysia->Singapore truck from the TDT GPS share link and post a status update into the Bitrix24 "Logistics Tracking Unit" workgroup chat. Use whenever asked to check the truck's location, post a GPS update, or troubleshoot the automated hourly tracking.
---

# Truck GPS Tracker

Posts a one-off location update for the Malaysia -> Singapore truck into the
Bitrix24 **Logistics Tracking Unit** workgroup chat (`chat8035`, Bitrix24
workgroup ID 47, members include Yanyi Yap / user ID 5).

This same logic runs automatically every hour from 7am Malaysia/Singapore
time (UTC+8) until the truck stops for the day (see "Pausing for the day"
below), Monday–Saturday (no monitoring Sunday), via a scheduled Routine —
see "Automated schedule" below. Invoke this skill manually for an on-demand
check or to debug a failure.

## Message format

Every message starts with an emoji that tells you at a glance whether it's
routine or needs attention:

- 🚚 = plain hourly **notification** — nothing wrong, just where the truck is.
- 🔔 ALERT = something worth noticing — same-location stall, still at the
  factory past 8am, or a GPS fetch failure.
- ✅ = a milestone/status message (round trip done for the day) — good news,
  not an alert.

The hourly notification is deliberately short — no map link, just the text:

```
🚚 JTB 9918 — location update
📍 Jalan Dataran 3,Mukim Tebrau,Johor Baharu,Johor
🚦 Engine OFF · 0 km/h
🕐 2026-09-17 15:02:12 (device local time)
⏸ Parked for 00:59:42
```

(the "Parked for" line only appears when the engine is off and a parking
duration is available).

## Alerts

Besides the plain hourly location update, the script raises three alerts
into the same chat, and can pause itself for the day:

1. **Same location for over 1 hour** — if the truck hasn't moved more than
   ~150m since the last reading that changed its position, and an hour has
   passed, it posts `🔔 ALERT: <Alias> -> 1hrs Same location` (once per
   stop — it won't repeat until the truck moves and then stalls again).
2. **Still at the factory by 8am** — if it's 8am or later MYT and the truck
   is still within ~400m of the SSB (StiFlex Sdn Bhd) factory, it posts a
   `🔔 ALERT: Truck still in SSB` message with the factory address (once
   per day).
3. **Return-to-Malaysia, pause for the day** — once the truck's reverse-
   geocoded location has mentioned "Singapore" at some point that day, and
   it's later back in Malaysia (the very next reading whose location no
   longer says "Singapore" — it doesn't wait for the truck to park or the
   engine to go off), the script treats the round trip as done and pauses
   (see below).

## Pausing for the day

There's no fixed end-of-day cutoff — the schedule just keeps firing hourly
until the truck itself has clearly stopped, at which point the script posts
a `✅` "pausing until tomorrow 7am" notice and goes quiet (no more Bitrix
posts, not even a plain hourly one) for the rest of that calendar day.
Monitoring resumes automatically the next day at 7am. Two conditions can
trigger this, whichever comes first:

- **Round trip done** — the truck's location has mentioned "Singapore" at
  some point that day, and the next reading no longer does (i.e. it's back
  in Malaysia). Pauses immediately on that reading, even if still moving —
  it doesn't wait for the truck to park.
- **Stopped for 3+ hours anywhere** — the truck hasn't moved more than
  ~150m and the engine's been off for 3+ hours straight, *regardless of
  whether it went to Singapore that day* (e.g. a day it doesn't run, or it
  parks somewhere for the rest of the day without a Singapore leg). This
  does **not** apply while still at the SSB factory itself — a long dwell
  there before departure (loading, paperwork) is normal and shouldn't stop
  monitoring before the truck has even left.

This is what keeps the chat from getting an hourly "still parked here"
repeat all the way to midnight once the truck is clearly done for the day —
the window is 7am onward, ending whenever the truck actually stops, not at
a fixed clock time.

### Overriding a wrong auto-pause (e.g. a breakdown)

Both pause conditions are heuristics based only on GPS data, so they can't
tell "done for the day, parked happily" apart from "stuck somewhere for a
real reason" (breakdown, accident, roadblock) — both look identical from
the outside: stationary, not in Singapore. If the truck is stopped for a
reason that isn't "done for the day" and tracking should keep going, set
`forceMonitoring: true` in `scripts/gps-tracker/state.json` (alongside
resetting `monitoringDone` to `false` if it already tripped) and commit it.
While `forceMonitoring` is true for that date, both pause conditions are
disabled — the script keeps posting hourly (and the same-location alert
still fires normally) until either the truck moves on and the situation
resolves itself, or someone flips `forceMonitoring` back to `false`/removes
the override. It resets automatically at midnight along with the rest of
the day's state.

State (last position, alert flags, whether the day is paused) is
kept in `scripts/gps-tracker/state.json`, next to this script. The script
commits and pushes that file back to the repo itself after each run — so
state persists across the fresh session each hourly firing gets. It resets
automatically whenever the stored date is not today (MYT). It always
commits/pushes to the `claude/background-task-ywnfle` branch specifically
(hardcoded as `STATE_BRANCH` in the script), not whatever branch the local
checkout happens to be on — fresh sessions on this self-hosted pool have
sometimes landed on an unrelated auto-named branch instead, which used to
make state pushes fail silently.

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

A Routine named **"Truck GPS Tracking - Logistics Tracking Unit"** (self-
hosted on the FusionETA Server 2 pool) fires hourly, 7:00am–12:00am
(midnight) Malaysia/Singapore time (UTC+8), every day of the week, running
this same script in a fresh session each time. The cron's upper bound
(hourly checks up to midnight) is just a safety ceiling in case a day's
stop-detection never fires (see "Pausing for the day" above) — in normal
operation the script itself stops posting well before midnight, once the
truck is done for the day. The cron runs all 7 days rather than trying to
exclude Sunday via day-of-week — Sunday-skipping is done inside the script
instead, because the local 7am–midnight window straddles two different UTC
calendar days, which makes a UTC day-of-week filter unable to cleanly
represent "skip Sunday, local time" without dropping Monday's 7am or
Saturday's evening slots. To change the schedule or investigate a missed
run, use `list_triggers` / `update_trigger` on that Routine.
