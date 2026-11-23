# Runbook: the night of the Eurovision 2027 final (Saturday 15 May 2027)

Semifinals are on 11 and 13 May; the final is on 15 May, in Burgas.
Everything happens in `/admin`. Button names are written as they appear in the admin.

## A. Weeks before (January–April 2027)

| When | Action | Check |
|---|---|---|
| When the line-up is announced (~Jan–Mar) | Re-enable the `parser-tick` cron: re-run migration **047** (it was stopped by 068 on 30 Oct 2026 because the logs grew to 1.33 GB). `purge-cron-logs` keeps 7 days, so the DB does not fill up again. | `select jobname from cron.job` shows `parser-tick`. |
| Same day | **Parser συμμετοχών** → let it run, then check the entries in Contests → Edit (there is no Approve step yet; it is a Track 1 item). | Every entry has an artist **and** a song. Until then the game does not switch to 2027 (migration 078). |
| After that | Contests → 2027 → **Δημοσίευση**. | The 2027 hub on the site shows the entries. |
| April | Do a test run in a test room: **Άνοιγμα προβλέψεων** → **Κλείσιμο προβλέψεων** → **Δοκιμή των parser (2025)** (no-write) → **↺ Επαναφορά ολοκλήρωσης**. | Nothing reached the public pages (tests never publish). |
| April | Check the Supabase plan's edge function wall clock. A results publish may wait up to ~100 s for a running page publish. The browser waits 150 s. | The limit is greater than 150 s. |
| April | Test the VFX at 60fps on a mid-range Android (open item from Track 2). | No stutter in the reel or the winners. |

## B. The day of the final

1. **Freeze page publishes** from the afternoon onwards: no **Δημοσίευση** on pages, no header/footer/settings, no «Publish all». Only contests/results. (Why: Vercel builds in order, so a page build ahead of results delays them by 3–5′.)
2. In **Parser αποτελεσμάτων**, confirm it is set to run on schedule (shown as «Οπλισμένο…»).
3. Create the party room. The QR on the TV carries the password; players scan it, pick an avatar and enter a stage name and a real name.

## C. During the show (the owner drives the phases)

| Moment | Button | Phase players see |
|---|---|---|
| Before the show | — | Λόμπι / Προθέρμανση |
| Before the first song | **Άνοιγμα προβλέψεων** | Οι προβλέψεις είναι ανοιχτές |
| When voting opens | **Κλείσιμο προβλέψεων** (locks the picks) | Ψηφοφορία σε εξέλιξη |
| Mistake | **↺ Πίσω, πριν τις προβλέψεις** | (back to the previous phase) |

Trivia and duels run in parallel; nothing needs doing from the admin.

## D. Results (after the announcement of the winner)

1. **Parser αποτελεσμάτων** reads the results on its own. Wait for status «Ολοκληρώθηκε» or check the ranking.
2. **Ολοκλήρωση 2027** → **Ναι, ολοκλήρωση 2027**. It locks the results, scores every room and produces winners. **Δεν αναιρείται.** Rooms move to «Τελικά αποτελέσματα», the reel plays, and «Ποιος ήταν ποιος;» reveals the real names.
3. **Αντιγραφή αποτελεσμάτων 2027 στα δημόσια** → check the entries in Contests → Edit.
4. Publish **only** with **Μόνο διαγωνισμοί**. Never «Δημοσίευση»/«Publish all» that night.
5. Watch the Contests PublishBar:
   - **busy / error** → **Ξανά: μόνο διαγωνισμοί**.
   - **revert_blocked** with "the build of these results failed…" → the build of the results themselves failed. Nothing is reverted automatically. Fix the data and publish again with **Μόνο διαγωνισμοί**.
6. The site shows the results about 2–5′ after the publish.

## E. If something goes wrong

| Problem | What you do |
|---|---|
| The parser doesn't find results | **Ολοκλήρωση χειροκίνητης κατάταξης**: enter the ranking by hand, then step D2 onwards. |
| The parser cron doesn't run | **Έναρξη τώρα** in Parser αποτελεσμάτων. (Without `parser-tick` it reads once; repeat it.) |
| Wrong results before Ολοκλήρωση | Fix them in Contests, then run the parser/results again. |
| Wrong results after Ολοκλήρωση | Contests → change the entries → **Μόνο διαγωνισμοί**. The room scores do not change (locked). |
| A page publish got stuck that afternoon | Leave it. Results publishes take over a stale page slot on their own. |

## F. The next day

- Refresh the SEO baseline: `npm run seo:baseline`.
- Unfreeze page publishes.
- `send-email-drain` stays off (nothing calls `queue_email`).
