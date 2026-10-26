# Freezing the submission (until results on 6 November)

The hackathon allows no changes or further work after the 30 October deadline. Judges may open the
deployed demo between 2 and 5 November, and the backend is one shared Supabase project, so a stray
deploy changes what they see. This page is the procedure for submitting once and then holding still.

## Before the deadline (by Thursday 29 October)

1. Merge the last pull requests. Read and approve the lesson drafts first
   (`review: pending` → `review: approved`, see the README).
2. Redeploy the backend, then confirm it answers:
   ```sh
   npm run functions:build
   npx supabase functions deploy api --no-verify-jwt
   curl -i https://<PROJECT_REF>.supabase.co/functions/v1/api/v1/branding   # expect 200
   ```
   Cloudflare Pages rebuilds the app and the lessons by itself. Open the site and check that a
   lesson downloads.
3. Seed the demo cohort once: `npm run admin -- seed-demo` (fake students only).
4. Run every check from a clean checkout of `main`: `npm ci`, `npm test`, `npm run typecheck`,
   `npm run lint`, `npm run test:db`, `npm run test:e2e`, `npm run test:e2e:backend`.

## At submission (Thursday night or Friday morning)

1. Tag the exact commit you submit, and push the tag:
   ```sh
   git switch main && git pull
   git tag -a hackathon-2026-submission -m "AI Product Hackathon 2026 submission"
   git push origin hackathon-2026-submission
   ```
2. Build the ZIP **from that tag**, so it is exactly what is tagged. It clones the repository
   (ignored files such as `.env` are never included), scans for secrets, and checks the result:
   ```sh
   npm run package:submission -- --ref hackathon-2026-submission --out ~/shiksha-path-submission.zip
   ```
   It prints the commit count and a SHA-256. Keep that line with the ZIP.
3. Unzip it somewhere else, run `npm ci && npm test`, and check the ZIP has no passwords, keys or
   tokens. (CI already runs `gitleaks` over the whole history on every pull request.)
4. Record the demo (see [DEMO-SCRIPT.md](DEMO-SCRIPT.md)) and submit the ZIP, the video, the
   description and the AI-development and QA documents.

## Holding still until 6 November

- **Cloudflare Pages.** Production deploys from `main`, so a later merge would change the demo. First
  create a branch at the tag, `git branch submission-freeze hackathon-2026-submission` and push it.
  Then in Cloudflare, open the Pages project, go to **Settings → Builds → Production branch**, and
  set it to `submission-freeze`. Merges to `main` then only build previews.
- **Supabase.** Run no `db push`, no `functions deploy`, no `secrets set`, and do not change
  Authentication settings. Do not run `seed-demo --remove`, and do not delete the demo students.
- **Judge access.** If judges need a login, share it through the hackathon's submission process,
  never in the repository.
- **If something breaks,** do not fix it quietly. Tell the organisers what and why. A change they
  did not allow is a bigger risk than a known bug.

## After results

Point Cloudflare's production branch back to `main`, merge the waiting work, redeploy the function
and apply new migrations as the runbook says, and carry on with Plans 4b to 6b.

## Ask the organisers

The rules say "no changes or further work after the submission deadline". It is not clear whether
that covers new work on other branches of the same repository. Ask. If in doubt, hold all pushes
until 6 November.
