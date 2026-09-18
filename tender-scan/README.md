# Dyntek Tender/Project Scan — Memory Log

This folder backs the automated weekday-7am tender scan Routine.

- `seen.json` — durable dedup log. Keys are `"<source>::<reference-or-title-slug>"`,
  values are `{ "title": ..., "source": ..., "first_seen": "YYYY-MM-DD" }`.
  The routine reads this file before reporting anything, skips keys already present,
  and appends new keys for everything it reports (suitable or not), then commits
  and pushes the update. This is what stops the same tender/project being reported
  on consecutive days, independent of chat history/context compression.

Sources scanned daily:
1. CEDD Hong Kong tender notices — https://www.cedd.gov.hk/eng/tender-notices/contracts/tender-notices/index.html
2. URA (Singapore) News & Media — https://www.ura.gov.sg/news/media/

BCI Central LeadManager is intentionally excluded from the cloud Routine above
— it requires the user's own authenticated Chrome session (Claude in Chrome),
which a cloud-hosted routine session cannot reach.

Instead, BCI is scanned by a **local cron job on the FusionETA server 2
droplet itself** (added 2026-09-17), since that machine's Chrome is the one
that stays logged in:

- Crontab: `7 7 * * 1-5` — the droplet's system timezone is already
  Asia/Kuala_Lumpur (+08) and cron uses local time by default (no `CRON_TZ`
  set), so this is directly 7:07am Malaysia/Singapore time, weekdays. (An
  earlier version of this entry wrongly used UTC-converted values — `7 23 *
  * 0-4` — which actually fired at 23:07 local/11:07pm. Fixed 2026-09-18.)
- Wrapper: `scripts/bci-scan/run-bci-scan.sh` — sets `DISPLAY=:1` to reach the
  droplet's X session/Chrome, then runs `claude -p` non-interactively with a
  scoped `--allowedTools` list (no blanket `--dangerously-skip-permissions`).
- Chrome itself runs as a `systemd --user` service (`chrome-bci.service`,
  alongside `fluxbox.service`), not a plain child of an SSH shell — it
  survives SSH/mosh disconnects and reboots (the account has `linger`
  enabled) and auto-restarts if it crashes. Note: if Chrome is ever manually
  restarted, the Claude-in-Chrome extension pairing needs to be redone via
  VNC (port 5901) — it does not appear to reconnect automatically even with
  the same profile directory.
- Task prompt: `tender-scan/bci-scan-prompt.txt`.
- Output: appended to `tender-scan/bci-scan-log.md` (not chat — nobody is
  watching an unattended cron run live), plus the usual `seen.json` dedup
  update, committed and pushed each run.
- If BCI shows logged out, or the site loads but the content area is
  broken/blank on repeated tries (a real site issue, seen once on
  2026-09-17), the run stops, logs what it saw, and notifies — it never
  attempts to log in itself, and never fabricates scan results.
- This run is report-only: it does not create Bitrix24 Contacts/Leads and
  never calls AskUserQuestion (there's no one there to answer in a cron
  invocation). The user later opens a live chat, reads `bci-scan-log.md` (or
  asks Claude to), and tells Claude which projects to turn into Bitrix24
  leads — same manual flow as any other interactive run.
- Notifications use two channels, since `PushNotification`'s phone push
  depends on Remote Control being active on that specific session — which a
  fresh unattended `claude -p` process doesn't have, so it's unreliable here.
  Every notify-worthy event (logged out, site broken, or new suitable
  projects found) also posts to the Stiflex Bitrix24 company Feed via
  `log.blogpost.add` (see `stiflex-bitrix24` skill), which doesn't depend on
  session state and is a channel the user checks daily. Nothing
  new/suitable and no problems → no notification at all, just the routine
  dedup commit.

Fit criteria and output format for the CEDD/URA scan live in the cloud
Routine's prompt; for BCI they live in `bci-scan-prompt.txt`. Bitrix24 lead
creation (when done interactively) uses the `stiflex-bitrix24` skill's "Lead
custom fields for project/tender leads" mapping.
