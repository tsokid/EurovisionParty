# Runbook — move the Supabase project to tsokid's Org and go Pro (25 Nov 2026)

**Goal:** the database (project `ameneqrrfdhntfzvchnn`, "Eurovision") moves from **apostolistsolakidis's Org** (Free) to **tsokid's Org**, on the **Pro** plan. GitHub and Vercel are already under tsokid and stay as they are.

**What does not change:** the project ref, the URL, the API keys, the data, the users, storage, edge functions, secrets, cron and settings. The site, Vercel and the CMS need no change.

**What cannot be undone:** the transfer itself.

Labels in the Supabase dashboard may differ slightly from the ones below. Follow the meaning.

---

## Step 1 — Backup (Claude, ~5')
- [ ] A full `pg_dump` of the database (schema plus data) to `C:\Users\User\backups\eurovision-2026-11-25.dump`, outside the repo.
- [ ] Check that the file restores: list its contents with `pg_restore --list`.
- [ ] Note the current row counts: rooms, players, contests, cms_documents, quiz_questions, auth users. Step 7 compares against them.

## Step 2 — Pre-checks on the current project (you, as apostolistsolakidis, ~5')
- [ ] Sign in to supabase.com with **apostolistsolakidis**.
- [ ] Project Eurovision → **Project Settings → Integrations**. If there is a **GitHub** connection, **Disconnect** it. We don't use it (migrations are applied directly), and it blocks the transfer. The `GITHUB_TOKEN` secret of `publish-content` is separate and is not affected.
- [ ] Same page: if there is a **Vercel** integration, note it. The transfer warns about it. Our Vercel takes its keys from environment variables, so this is not expected.
- [ ] Organization → **Billing**: no unpaid invoice.
- [ ] Organization → **Team**: your role is **Owner**.

## Step 3 — Prepare tsokid's Org (you, as tsokid, ~10')
- [ ] Sign out, then sign in with **tsokid**.
- [ ] **Decide about FORGE first.** Pro charges every active project's compute (about $10/month each; the Pro plan includes $10 of credit, which covers one).
  - If FORGE is not needed, **Pause** it first.
  - The 4 paused projects (BeWell, GivingGood, Katiko, Multi_Agent_Trading_Simulation): the upgrade screen shows what happens to them and the monthly cost. Read it before confirming.
- [ ] Organization → **Billing → Change plan → Pro** ($25/month). Enter the card yourself.
- [ ] Leave the **Spend cap ON** for now. It is turned off only for the week of the final (master plan Step 8).
- [ ] Organization → **Team → Invite member**: the **apostolistsolakidis** account's email, role **Owner** (or Administrator).

## Step 4 — Accept the invite (you, ~2')
- [ ] Open the invite email in the apostolistsolakidis mailbox and accept it **while signed in as apostolistsolakidis**.
- [ ] Check: with apostolistsolakidis you now see **both** organizations in the org switcher.

## Step 5 — Transfer (you, as apostolistsolakidis, ~5')
- [ ] Before starting, make sure nobody is playing (Claude checks `rooms` for activity in the last hour).
- [ ] Project Eurovision → **Project Settings → General → Transfer project**.
- [ ] Target: **tsokid's Org**. Wait for the checks to finish.
- [ ] **Read every warning.** If something unexpected appears (a blocker, a compute change, a cost), **stop** and send Claude a screenshot.
- [ ] If everything passes: **Transfer project**. Confirm.

## Step 6 — First checks (you, ~2')
- [ ] With tsokid: the project appears in tsokid's Org with **Pro**.
- [ ] Settings → Infrastructure: the compute size (Pro starts from Micro).

## Step 7 — Checks after the move (Claude, ~15')
- [ ] Row counts are the same as in Step 1.
- [ ] Live site: `/el`, `/en`, a past contest page and the countries page load, and the console shows no errors.
- [ ] Game: create a test room, join from a second browser, play one quiz question. Then delete the test room.
- [ ] `/admin`: sign in, preview one page (no Publish).
- [ ] Edge functions (`publish-status`) respond.
- [ ] Auth limits, Realtime and cron jobs are as before (Pro allows larger limits, but they are raised only for the final).
- [ ] The next day: Database → **Backups** shows the first daily backup.

## Step 8 — Wrap-up
- [ ] Roadmap: O3 ☑.
- [ ] Remove the apostolistsolakidis account from tsokid's Org (Owner) if you don't want it there. Or keep it as a second Owner, so that if one account is lost you don't lose the project.
- [ ] Keep the backup from Step 1 until the first daily backup appears.

## If something goes wrong
- The transfer is refused by a check: nothing has changed. Fix what it says and try again.
- The site has a problem after the transfer: the keys have not changed, so it is not the move. Claude looks at the logs. The Step 1 backup is there for the worst case.
