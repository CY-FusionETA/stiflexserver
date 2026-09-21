# Dyntek Tender/Project Scan — Memory Log

This folder backs the automated daily tender scan (cloud Routine for
CEDD/URA, local cron for BCI Central).

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

- Crontab: `7 5 * * *` — the droplet's system timezone is already
  Asia/Kuala_Lumpur (+08) and cron uses local time by default (no `CRON_TZ`
  set), so this is directly 5:07am Malaysia/Singapore time, every day
  including weekends (changed from weekdays-only 7:07am on 2026-09-21 at the
  user's request). (An earlier version of this entry wrongly used
  UTC-converted values — `7 23 * * 0-4` — which actually fired at
  23:07 local/11:07pm. Fixed 2026-09-18.)
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
- This run **does** create Bitrix24 Contacts/Leads directly for every new
  suitable project — no user confirmation step (changed 2026-09-21; the user
  explicitly pre-authorized fully automatic lead creation for this
  recurring run, unlike the manual/interactive flow which still asks). It
  never calls AskUserQuestion (there's no one there to answer in a cron
  invocation). Leads use `SOURCE_ID: "UC_9I4QP1"` (the "BCI Central" custom
  source added 2026-09-21), not the old default `"WEB"`.
- Notifications: the user keeps a long-running interactive Claude Code
  session named "BCI Central" alive 24/7 on this droplet (Remote Control,
  always-on), so every notify-worthy event (logged out, site broken, or new
  leads created) is sent via `SendMessage` to that session — it lands
  directly in the user's ongoing chat. `PushNotification` is also called as
  a free extra (may additionally reach a phone if Remote Control happens to
  be active). If "BCI Central" isn't found running (shouldn't normally
  happen), that's logged as an anomaly rather than silently dropped. Nothing
  new/suitable and no problems → no notification at all, just the routine
  dedup commit.
- Chrome is deliberately kept running 24/7 rather than closed between runs.
  It uses ~350-600MB RSS continuously on a memory-constrained (3.8GB, often
  swapping) droplet, which was a real tradeoff the user considered and
  explicitly chose over closing Chrome, because closing it breaks the
  Claude-in-Chrome extension's pairing (confirmed twice) and would need a
  manual VNC re-auth before most/all daily runs — there's no known way to
  free that memory without also breaking unattended automation.

Fit criteria and output format for the CEDD/URA scan live in the cloud
Routine's prompt; for BCI they live in `bci-scan-prompt.txt`, which also has
the full Bitrix24 webhook field mapping inlined (the `stiflex-bitrix24`
skill isn't reliably loadable from this local cron context, so don't rely
on it being available — the prompt is self-contained).
