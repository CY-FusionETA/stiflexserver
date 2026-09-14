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

BCI Central LeadManager is intentionally excluded from this unattended daily
scan — it requires the user's own authenticated Chrome session (Claude in
Chrome), which isn't available to a background-triggered run. It stays
available as a manually-run source per the original tender-evaluation skill.

Fit criteria and output format for the scan live in the Routine's prompt
(see the Bitrix24/Dyntek tender-evaluation instructions). This scan step only
reports candidates in chat — it does not create Bitrix24 Contacts/Leads.
