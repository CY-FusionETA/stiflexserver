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

## 2026-09-21 (blocked — session logged out)

**Status: scan skipped. No projects evaluated.**

Navigating to `https://app-leadmanager.bcicentral.com/main/dashboard` redirected to the SSO login page (`https://sso.bcicentral.com/login?app=lm`) with a "Login To Your Account" form (username/password fields pre-filled by browser autofill, but not submitted). This is the logged-out case — per instructions, no credentials were entered and the Login button was not clicked.

**Action needed:** please log back in manually at https://sso.bcicentral.com/login?app=LM&var=au&username=dyntek_reg1, then the next scheduled run should pick back up normally.

**Notification anomaly:** the "BCI Central" long-running session was not found as a live peer (`ListAgents` returned no reachable agents), so `SendMessage` could not be used. A `PushNotification` was attempted as a fallback but was not sent (this terminal session was reported active, so it was treated as redundant) — this run's notification may not have reached the user through either channel.

## 2026-09-21, later same day (blocked — site rendering failure, second incident)

**Status: scan could not be completed. No new projects evaluated, no leads/tasks created.**

User had since logged back in manually (confirmed: tab was on `/main/search`, logged in as "JL", not redirected to SSO). Project Location filter was checked and confirmed already correctly set to Indonesia + Malaysia + Singapore under "In Your Subscription" (158,717 matching projects). However, after that filter check, the results grid degraded to showing only 1 row despite pagination indicating 5 pages — then a full page reload/re-navigation left the entire main content area blank (only the top header/notification bell/user avatar rendered) on repeated tries:

- `/main/search` — blank content area (just "Search Results" title + header).
- `/main/dashboard` — blank content area (just the "checked in on you" banner + header).
- `/main/dashboard?_r=1` (cache-busting) — same, still blank.
- `/main/search` again after a ~5s wait — still blank.

This is the same failure signature as 2026-09-17 (site/rendering issue, not a login issue — session stayed logged in throughout). Indonesia/Singapore/Malaysia filter selection itself was confirmed correct before the page broke, so subscription scope is not in question this time. seen.json was not modified this run (still 16 BCI:: keys, all from 2026-09-17) — nothing was evaluated, so no duplicate-risk on the next successful run.

**Action needed:** same as before — someone should check the LeadManager site directly in a live interactive session to see if this is a recurring transient outage on BCI's end. Given this is the second occurrence in ~4 days with an otherwise-valid session, worth flagging to BCI Central support if it keeps happening.
