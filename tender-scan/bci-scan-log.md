# BCI Central Scan Log

## 2026-09-17 (blocked — site rendering failure)

**Status: scan could not be completed. No new projects evaluated.**

The browser session was logged in (LeadManager dashboard header/nav rendered normally, showing user "Joseph Lim", no redirect to sso.bcicentral.com), so this was NOT the usual logged-out case. Instead, the main content area failed to render on every page tried:

- `/main/dashboard` — header/sidebar loaded, content area completely blank (no search bar, no widgets).
- `/main/project-pipeline` — page title rendered, content area blank.
- `/main/insight` — page title rendered, content area blank.

Tried: normal navigation, re-navigating to the URL, waiting up to 5s, clicking the "New Search" sidebar link/icon directly (and via element ref), resizing the window, and a hard cache-busting reload (Ctrl+Shift+R). None produced any visible content — the search bar / Project Location filter used in prior runs never appeared, so Steps 2–4 (filter, extract, evaluate) could not be attempted.

Console and network request inspection tools were unavailable in this unattended run (permission for Claude-in-Chrome diagnostics on this domain requires interactive approval, which isn't possible in a non-interactive cron session), so the root cause (JS error, API failure, or a genuine session/account issue) could not be diagnosed further from here.

Note: the accessibility tree does contain (currently hidden/inactive) "Session Expired" and "Session Timeout — logged in on another device" dialog templates mounted in the page, which may or may not be relevant — could not confirm whether these were ever actually triggered.

Indonesia/Singapore/Malaysia location filter was never reached, so subscription scope could not be checked this run.

**Action needed:** Please check the BCI Central LeadManager session/site directly in a browser (a live/interactive session, not this automation) to see whether this is a transient outage, a stuck session (possibly logged in elsewhere per the "another device" message seen in the DOM), or something else. seen.json was not modified this run — no projects were evaluated or skipped.

Earlier today a separate scan run (see git commit `9037855`, ~09:29 SGT) did complete successfully and logged 15 BCI projects into `seen.json` (all dated 2026-09-17) — that run is unaffected by tonight's issue. A later run attempt tonight (`bci-cron-run.log`, started 2026-09-17T15:07:02Z UTC / 23:07 SGT) appears to have hit this same rendering problem, since it left only a header line with no follow-up report — consistent with today's failure.
