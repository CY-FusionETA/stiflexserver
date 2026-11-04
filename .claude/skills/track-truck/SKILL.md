---
name: track-truck
description: Fetch the live GPS position of the Malaysia->Singapore truck from the TDT GPS share link and post a status update into the Bitrix24 "Logistics Tracking Unit" workgroup chat. Use whenever asked to check the truck's location, post a GPS update, or troubleshoot the automated tracking.
---

# Truck GPS Tracker

Posts a one-off location update for the Malaysia -> Singapore truck into the
Bitrix24 **Logistics Tracking Unit** workgroup chat (`chat8035`, Bitrix24
workgroup ID 47, members include Yanyi Yap / user ID 5).

This same logic runs automatically every 30 minutes from 7:30am sharp
Malaysia/Singapore time (UTC+8) until the truck stops for the day (see
"Pausing for the day" below), Monday–Saturday (no monitoring Sunday), via a
scheduled Routine — see "Automated schedule" below. Invoke this skill
manually for an on-demand check or to debug a failure.

## Message format

Every message starts with an emoji that tells you at a glance whether it's
routine or needs attention:

- 🚚 = plain **notification** — nothing wrong, just where the truck is.
- 🔔 ALERT = something worth noticing — same-location stall, still at the
  factory past 8am, or a GPS fetch failure.
- ✅ = a milestone/status message (round trip done for the day) — good news,
  not an alert.

Each notification is deliberately short — no map link, just the text:

```
🚚 JTB 9918 — location update
📍 Jalan Dataran 3,Mukim Tebrau,Johor Baharu,Johor
🚦 Engine OFF · 0 km/h
🕐 2026-09-17 15:02:12 (device local time)
⏸ Parked for 00:59:42
```

(the "Parked for" line only appears when the engine is off and a parking
duration is available; if the truck is stationary but the engine is still
ON — e.g. idling, stuck, waiting somewhere — the line instead reads
"⏸ Same location for Xh Ym", using our own tracked duration rather than the
vendor's engine-off-only parkingDuration, so a stall is visible in the
plain update too, not just in an alert).

## Alerts

Besides the plain location update, the script raises three alerts
into the same chat, and can pause itself for the day:

1. **Same location, escalating hourly** — if the truck hasn't moved more
   than ~150m since the last reading that changed its position, it posts
   `🔔 ALERT: <Alias> -> Nhrs Same location` once per full hour it stays
   there (1hr, 2hr, 3hr, 4hr, ...) — it keeps escalating for as long as the
   truck stays put, rather than firing once and going quiet, so a stall
   that keeps dragging on keeps getting flagged.
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

There's no fixed end-of-day cutoff — the schedule just keeps firing every
30 minutes until the truck itself has clearly stopped, at which point the
script posts a `✅` "pausing until tomorrow 7am" notice and goes quiet (no
more Bitrix posts, not even a plain one) for the rest of that calendar day.
Monitoring resumes automatically the next day at 7:30am. Two conditions can
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
  monitoring before the truck has even left. It also doesn't start counting
  until the truck has moved at least once that day: the very first reading
  each day only sets a baseline position, silently, with no clock running —
  so the truck sitting at its overnight spot for a few hours right as
  monitoring opens at 7am is never mistaken for "stopped for 3 hours,
  done for today." Only once the truck actually departs (a real >~150m
  move) does the same-location tracking start watching for its *next*
  stop.

This is what keeps the chat from getting a repeated "still parked here"
update every 30 minutes all the way to midnight once the truck is clearly
done for the day — the window is 7:30am onward, ending whenever the truck
actually stops, not at a fixed clock time.

### Overriding a wrong auto-pause (e.g. a breakdown)

Both pause conditions are heuristics based only on GPS data, so they can't
tell "done for the day, parked happily" apart from "stuck somewhere for a
real reason" (breakdown, accident, roadblock) — both look identical from
the outside: stationary, not in Singapore. If the truck is stopped for a
reason that isn't "done for the day" and tracking should keep going, set
`forceMonitoring: true` in `scripts/gps-tracker/state.json` (alongside
resetting `monitoringDone` to `false` if it already tripped) and commit it.
While `forceMonitoring` is true for that date, both pause conditions are
disabled — the script keeps posting every 30 minutes (and the same-location alert
still fires normally) until either the truck moves on and the situation
resolves itself, or someone flips `forceMonitoring` back to `false`/removes
the override. It resets automatically at midnight along with the rest of
the day's state.

State (last position, alert flags, whether the day is paused) is
kept in `scripts/gps-tracker/state.json`, next to this script. The script
commits and pushes that file back to the repo itself after each run — so
state persists across the fresh session each firing gets. It resets
automatically whenever the stored date is not today (MYT). It always
commits/pushes to the `claude/background-task-ywnfle` branch specifically
(hardcoded as `STATE_BRANCH` in the script), not whatever branch the local
checkout happens to be on — fresh sessions on this self-hosted pool have
sometimes landed on an unrelated auto-named branch instead, which used to
make state pushes fail silently.

Since two scheduled tasks now share this one state.json (see "Automated
schedule" below - one fires on the hour, one on the half-hour), every run
also pulls the latest committed state.json straight from `origin` before
reading it (`syncStateFromOrigin()`), overwriting whatever's in the local
checkout first. This is what keeps the two tasks coordinated instead of
duplicating each other — e.g. whichever one notices the truck is back in
Malaysia first sets `monitoringDone` and posts the "returned, pausing"
message; without always reading the latest state first, the other task
could miss that and post its own duplicate "returned" message 30 minutes
apart. It's also what fixes the "stale local checkout" problem we've hit
firsthand developing this script across runner moves - a run that starts
on an out-of-date clone no longer matters, since the state file itself
gets refreshed regardless.

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

Two scheduled tasks on the FusionETA Server 2 self-hosted pool together
give a 30-minute cadence, 7am–midnight Malaysia/Singapore time (UTC+8),
every day of the week, each running this same script in a fresh session:

- **"Truck GPS Tracking - Logistics Tracking Unit"** — cron
  `30 0-16,23 * * *` (UTC), fires on the half-hour (7:30am, 8:30am, ...,
  11:30pm, then 00:30 which the script always skips - see below).
- **"Truck GPS Tracking - Logistics Tracking Unit (on-the-hour)"** — cron
  `0 0-16,23 * * *` (UTC), fires on the hour (7:00am, 8:00am, ..., 11:00pm,
  then 00:00 which the script always skips).

There are two tasks, not one, because this platform caps a single
scheduled task's cron at once per hour ("Cloud tasks run at most once per
hour") - `0,30 0-16,23 * * *` on one task gets rejected outright. Splitting
the :00 and :30 slots across two separate tasks is the only way around
that cap, and they interleave into an effective 30-minute check.

Both tasks point at the exact same repo, branch, and `scripts/gps-tracker/
track-truck.mjs` script, and critically **share the same `state.json`**
(see "Pausing for the day" above) via `syncStateFromOrigin()` - this is
what stops them from double-posting. For example, around the time the
truck crosses back into Malaysia, whichever task happens to fire first
notices it, sets `monitoringDone`, and posts the one "returned, pausing"
message; the other task's next firing (at most 30 minutes later) pulls
that same state first and sees `monitoringDone` already set, so it stays
silent instead of posting a second "returned" message of its own.

The 7:00am slot (from the on-the-hour task) is always skipped by the
script, so monitoring effectively starts at 7:30am sharp rather than 7:00
— a standard cron can't express ":30 only at 7am, :00 and :30 everywhere
else" in one expression, so skipping it in code was simpler than trying to
special-case the cron. The script likewise always skips the literal
midnight (00:00 and 00:30) slots entirely, with no Bitrix post and no
state read/write at all — they exist only so each task's hour range
technically reaches "up to midnight," but by then the calendar date has
already rolled over, and treating them as a normal run would reset state
and post a fresh update even on a day that had already correctly paused
hours earlier (this happened in practice: a plain location update went
out at 00:13 on a day that had paused at 15:13 the evening before). The
rest of each task's upper bound (checks up to 11:30pm/11pm) is still just
a safety ceiling in case a day's stop-detection never fires (see "Pausing
for the day" above) — in normal operation the script itself stops posting
well before that, once the truck is done for the day (back in Malaysia
from Singapore, or stationary 3+ hours). Both crons run all 7 days rather
than trying to exclude Sunday via day-of-week — Sunday-skipping is done
inside the script instead, because the local 7am–midnight window straddles
two different UTC calendar days, which makes a UTC day-of-week filter
unable to cleanly represent "skip Sunday, local time" without dropping
Monday's 7am or Saturday's evening slots.

Both tasks were created via the claude.ai web UI, not by an agent, so they
can only be edited there (`https://claude.ai/code/routines/<id>`) — an
agent gets `this routine was created via "http_api"` if it tries
`update_trigger` on either one, and gets `routines targeting a self-hosted
environment cannot be created via this tool` if it tries to create a new
one on this pool via `create_trigger`. `list_triggers` still works for
checking status or finding either trigger's ID, and investigating a missed
run.
