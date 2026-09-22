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

## 2026-09-22 (blocked — session logged out)

**Status: scan skipped. No projects evaluated.**

Navigating to `https://app-leadmanager.bcicentral.com/main/dashboard` redirected to the SSO login page (`https://sso.bcicentral.com/login?app=lm`) with a "Login To Your Account" form (username/password fields pre-filled by browser autofill, but not submitted). This is the logged-out case — per instructions, no credentials were entered and the Login button was not clicked.

**Action needed:** please log back in manually at https://sso.bcicentral.com/login?app=LM&var=au&username=dyntek_reg1, then the next scheduled run should pick back up normally.

Note: this is the third blocked run in ~5 days (2026-09-17 rendering failure, 2026-09-21 logged-out + separate same-day rendering failure, and now this logged-out incident) — worth considering whether the session needs a more durable login/refresh strategy.

## 2026-09-22, later same day (completed successfully)

**Status: scan completed. 16 projects evaluated, 5 new suitable, 11 new not suitable.**

User logged back in manually after the earlier logged-out incident. Project Location filter set to Indonesia + Malaysia + Singapore under "In Your Subscription" (158,758 matching projects, 1,442,396.33m USD total value) — Indonesia confirmed selectable/in-subscription, though the ~15 most-recently-updated projects by last-update sort all turned out to be Singapore/Malaysia (none from Indonesia in this recency window — not a subscription-scope issue, just how the update timestamps landed today).

### New SUITABLE projects (5)

1. **COLLEGE - alterations & additions** (Temasek Polytechnic — School of Engineering, Blocks 10/11/13)
   Ref: 62213006 | Singapore | Pre-Construction, Tender Called, closing 13 Oct 2026, construction Q1–Q4 2027 | Contact: Temasek Polytechnic (Government Implementing Agency, company-only), +65 6788 2000, enquiry@tp.edu.sg | Fit: explicit "Structural Steel Framing", "Blockwork", "Brickwork", "Timber Framing" in building elements list | [Detail page](https://app-leadmanager.bcicentral.com/main/project/62213006?versionNumber=1) | **Bitrix24 Lead #801, Task #2405 → Ben See**

2. **APARTMENTS (434) - new - 37 storey** (KIARA 8 RESIDENCE)
   Ref: 121962003 | Kuala Lumpur, Malaysia | Design & Documentation, Design Application (amended dev. application submitted after refusal), tenders expected ~Q2 2027, construction Q1 2028 | Contact: **Mr Abdul Hakim bin Abdullah, Architect**, ArchiMatrix Sdn Bhd, +60 3 7984 3121, hakim@archimatrix.com.my | Fit: explicit "Beams, Posts & Columns", "Structural Steel Framing", "Blockwork", "Brickwork" — strongest lead of the batch, large 37-storey/434-unit tower with a named architect contact | [Detail page](https://app-leadmanager.bcicentral.com/main/project/121962003?versionNumber=5) | **Bitrix24 Lead #805, Task #2409 → Steve Ting**

3. **STEEL FRAMES for FACTORY - extension**
   Ref: 151137004 | 62 Loyang Way, Singapore | Construction, Construction Commenced, Main Contract Awarded | Contact: Ceilcon International Pte Ltd (Main Contractor, company-only), +65 6288 4428 | Fit: direct title match — "Steel Frames" — Dyntek's exact business | [Detail page](https://app-leadmanager.bcicentral.com/main/project/151137004?versionNumber=1) | **Bitrix24 Lead #807, Task #2411 → Ben See**

4. **OFFICES / SHOPS (50) - new - 2 storey** (SEED HOMES CT: mixed development)
   Ref: 150539004 | Sungai Petani, Kedah, Malaysia | Design & Documentation, Building Application, earthworks subcontractor appointed, construction Q1 2027–Q1 2029 | Contact: Sime Darby Property (Developer, company-only), +60 3 7849 5000, group.communications@simedarbyproperty.com | Fit: weaker — generic finishes-only elements list, but a substantial new-build 50-unit commercial development inherently needs wall/structural systems | [Detail page](https://app-leadmanager.bcicentral.com/main/project/150539004?versionNumber=2) | **Bitrix24 Lead #803, Task #2407 → Steve Ting**

5. **EXECUTIVE CONDOMINIUMS (430) - new**
   Ref: 40383006 | Miltonia Close, Singapore | Concept, Early Planning, no main contractor appointed | Contact: Hoi Hup Realty Pte Ltd (Developer, company-only), +65 6311 9555, enquiry@hoihup.com | Fit: weakest of the batch — generic finishes-heavy elements list (only "Raft/Slab-on-Grade Foundations" as a structural mention), no named contact, very early stage — but a large-scale (430-unit) new-build condo inherently requires structural framing | [Detail page](https://app-leadmanager.bcicentral.com/main/project/40383006?versionNumber=5) | **Bitrix24 Lead #799, Task #2403 → Ben See**

All 5 leads/contacts created and timeline-commented successfully (no Bitrix24 API errors this run). Follow-up tasks routed by country per the standing rule (Singapore → Ben See; Malaysia → Steve Ting; Indonesia → Wei Quan Hoo + Steve Ting — no Indonesian suitable projects this run).

### New NOT SUITABLE (11, one-line tally)

Restaurants/Club Bayou Walk Langkawi (F&B fit-out, construction not until 2028+); Barrage/Reservoir Kota Tinggi (pure water infrastructure); Envelope Control Intermediate Terrace House, 58 Cardiff Grove (single private residence); Air Systems for Waterworks, Chestnut Ave (mechanical replacement only); Offices/Apartments Kyliez Suite KL (construction underway since 2024, current subcontractors are MEP/finishing, structural phase passed); Envelope Control Detached House, Belmont Rd (single private residence); Multipurpose Hall refurbishment, Kepala Batas (roofing/facade/flooring refurb only); Clinic/Apartments(7) redevelopment, Tebedu Sarawak (no structural elements listed — see anomaly note below); Early Childhood Development Centre alterations, Tampines (minor interior fit-out only); Government Office/Store refurbishment, Banting (refurbishment-only, tiny value); Restaurant/Karaoke Lounge alterations, KL (F&B fit-out).

### Anomaly

Project 135307003 (Clinic/Apartments(7) redevelopment, Tebedu, Sarawak — marked NOT SUITABLE above) shows **"Associated Team: Dyntek Pte Ltd"** in BCI Central's own Opportunity Details panel — meaning Dyntek's sales team already has this project flagged as an opportunity directly within BCI Central's platform (Opportunity Value/Quoted/Order fields all blank, so no recorded progress yet). This is separate from our `seen.json`/Bitrix24 automation and wasn't something this scan created — flagging in case it's useful context for whoever owns that BCI Central account-side tracking.
