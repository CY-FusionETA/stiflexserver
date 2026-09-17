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

- Crontab: `7 23 * * 0-4` (UTC) = ~7:07am Singapore/Malaysia time, weekdays.
- Wrapper: `scripts/bci-scan/run-bci-scan.sh` — sets `DISPLAY=:1` to reach the
  droplet's X session/Chrome, then runs `claude -p` non-interactively with a
  scoped `--allowedTools` list (no blanket `--dangerously-skip-permissions`).
- Task prompt: `tender-scan/bci-scan-prompt.txt`.
- Output: appended to `tender-scan/bci-scan-log.md` (not chat — nobody is
  watching an unattended cron run live), plus the usual `seen.json` dedup
  update, committed and pushed each run.
- If BCI shows logged out, the run stops and logs a note asking the user to
  log back in manually — it never attempts to type the password itself.
- This run is report-only: it does not create Bitrix24 Contacts/Leads. Review
  `bci-scan-log.md` and ask an interactive Claude session to create leads for
  anything worth pursuing.

Fit criteria and output format for the CEDD/URA scan live in the cloud
Routine's prompt; for BCI they live in `bci-scan-prompt.txt`. Bitrix24 lead
creation (when done interactively) uses the `stiflex-bitrix24` skill's "Lead
custom fields for project/tender leads" mapping.
