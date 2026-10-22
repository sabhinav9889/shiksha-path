# Supabase setup (owner runbook)

For the product owner. These steps create the real backend for the pilot: the database, Google
sign-in and the `/v1` API. Nobody but the owner runs them. Keys and passwords go only into the
Supabase and Cloudflare dashboards, never into the repo or a chat.

Plan: [Plan 3a](../superpowers/plans/2026-10-20-backend-sync.md) · Spec §5.4.

## Before you start

- A Supabase account, a Google Cloud account and the Cloudflare Pages project for the app.
- The repo checked out, with `npm ci` run once.
- The app's real address, for example `https://app.example.org` (written `<APP_URL>` below).

## 1. Create the Supabase project

1. In the Supabase dashboard, create a project named `shiksha-path`.
2. Region: **South Asia (Mumbai), ap-south-1**. Students' data stays in India, and it is closest
   to them.
3. Plan: **Free** for the pilot. Move to **Pro** before any ad-driven intake (spec §5.4).
4. Save the database password in your password manager. You need it in step 4.
5. Note the **project ref**, the part of the project URL `https://<PROJECT_REF>.supabase.co`.

## 2. Create the Google sign-in client

1. In Google Cloud Console, create or choose a project, then set up the **OAuth consent screen**:
   - user type: External;
   - app name: Shiksha Path;
   - scopes: **only** `email` and `profile`. Add nothing else.
2. Under **Credentials**, create an **OAuth client ID** of type **Web application**.
3. Under **Authorised redirect URIs**, add `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.
4. Keep the client ID and client secret for the next step. Do not email them or paste them into
   chat.

## 3. Turn on Google in Supabase Auth

1. In the Supabase dashboard, go to **Authentication → Sign In / Providers → Google**. Enable it
   and enter the client ID and secret from step 2.
2. In **Authentication → URL Configuration**:
   - set **Site URL** to `<APP_URL>`;
   - add the redirect URL `<APP_URL>/**`. The app comes back to `<APP_URL>/#/auth-callback`.
3. In **Authentication → Sign In / Providers → Email**, keep the provider **on** and keep
   **Confirm email** **on**. Do not turn off email sign-ups or the Email provider: Supabase then
   refuses every email login, and backup-code students sign in through it. With confirmation
   required, a stranger who signs up with an email gets no session, and the API never lets an
   email sign-in it did not create itself make a learner. (An earlier version of this runbook said
   to turn the Email provider off. That was wrong; turn it back on if you followed it.)

## 4. Create the tables

From the repo root:

```sh
npx supabase login
npx supabase link --project-ref <PROJECT_REF>      # asks for the database password
npx supabase db push --dry-run                     # lists the migrations it would apply
npx supabase db push --include-seed                # applies them, then adds the feature switches
```

The seed is safe to run again: it only adds switches that are missing.

## 5. Deploy the API

```sh
npx supabase secrets set ALLOWED_ORIGINS=<APP_URL>
npm run functions:build
npx supabase functions deploy api --no-verify-jwt
```

- Run `functions:build` before **every** deploy. The function ships a bundle that git does not
  keep.
- `--no-verify-jwt` is needed because the browser's CORS check carries no token. The API checks
  every request's sign-in itself and answers 401 without one.
- Supabase gives the function its database URL and service key itself. Never set those by hand.
- The function's package versions are pinned in `supabase/functions/api/deno.json`. Change them
  only together with `package.json`, so every deploy runs the code the tests ran.
- To allow more than one address, separate them with commas, for example
  `ALLOWED_ORIGINS=<APP_URL>,https://preview.example.org`.

## 6. Point the app at the backend

1. In Cloudflare Pages, open the app project and go to **Settings → Environment variables**
   (Production). Set:
   - `VITE_SUPABASE_URL` = `https://<PROJECT_REF>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = the **anon / publishable** key from Supabase
     **Project Settings → API**.
2. Redeploy the app. Never use the `service_role` or secret key here: the app is public.

## 7. Check it on a real phone

- [ ] Create a profile, tap **Google से जुड़ें**, and sign in with a test Google account. The app
      shows "Google से जुड़ गया".
- [ ] Turn on airplane mode and finish a lesson. It says it is saved on the phone.
- [ ] Turn the network back on, open **मैं** and tap **अभी sync करें**. It shows
      "सब अपलोड हो गया".
- [ ] On a second phone (or a private browser window), tap **पुरानी प्रोफ़ाइल वापस लाएँ**, choose a
      PIN and sign in with the same Google account. The lesson shows as done and the streak
      matches.
- [ ] In the Supabase table editor, set `placement_test` to off in `feature_switches`, then sync on
      the phone. The starting test card disappears. Set it back on afterwards.

## 8. Backups (every night, owned by the NGO)

The job `.github/workflows/backup.yml` runs at 02:00 IST. It dumps the database, copies the
recordings, encrypts both with the NGO's key, and uploads them to the NGO's own Cloudflare R2
bucket. Then it deletes recordings past their retention time. Only the NGO's private key can read
a backup. Neither Supabase, Cloudflare nor GitHub can.

**Once, on an NGO computer:**

1. Install `age` (https://age-encryption.org), then run `age-keygen -o shiksha-backup-key.txt`.
   It prints the **public key** (`age1...`).
2. Print the key file and keep **two copies offline**, in two places, for example two safes. Then
   delete the file from the computer. Without this key, no backup can ever be restored.
3. In Cloudflare, go to **R2** and create a bucket, for example `shiksha-backups`. Add a
   **lifecycle rule** that deletes objects after **30 days**. A student deleted on request then
   leaves the backups within 30 days; the consent form should say so.
4. Under **R2 → Manage API tokens**, create a token with Object Read & Write on that bucket only.
5. In Supabase, go to **Project Settings → Storage → S3 Connection** and create an access key.

**In GitHub** (**Settings → Secrets and variables → Actions → New repository secret**), add:

| Secret                                             | Value                                                   |
| -------------------------------------------------- | ------------------------------------------------------- |
| `BACKUP_DB_URL`                                    | Supabase **Connect → Session pooler** connection string |
| `SUPABASE_URL`                                     | `https://<PROJECT_REF>.supabase.co`                     |
| `SUPABASE_S3_REGION`                               | `ap-south-1`                                            |
| `SUPABASE_S3_ACCESS_KEY`, `SUPABASE_S3_SECRET_KEY` | from step 5                                             |
| `BACKUP_AGE_RECIPIENT`                             | the public key from step 1 (`age1...`)                  |
| `BACKUP_R2_BUCKET`                                 | the bucket name from step 3                             |
| `R2_ENDPOINT`                                      | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`         |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`         | from step 4                                             |
| `SUPABASE_SERVICE_ROLE_KEY`                        | Supabase **Project Settings → API** service role key    |
| `CODE_PEPPER`                                      | the same value you set for the function                 |

Then open **Actions → Backup → Run workflow** once, and check that two files appear in the bucket.

**Restore drill (once a term):** on the NGO computer, download the newest `db-*.dump.age`. Run
`age -d -i shiksha-backup-key.txt db-<date>.dump.age > db.dump`, then
`pg_restore --no-owner --no-privileges -d <a test database URL> db.dump`. Recordings come back the
same way: `age -d ... recordings-<date>.tar.age | tar -xf -`. CI runs the same check on a local
copy (`tooling/backup/restore-check.sh`) on every pull request.

## Know before the pilot

- **Free projects pause** after about a week without activity. Open the dashboard to resume one
  before a class.
- **Free projects have no Supabase backups.** The nightly job in section 8 is the NGO's own
  backup. Set it up before any student data goes in.
- If something fails, the function's logs are in the Supabase dashboard under **Edge Functions →
  api → Logs**. They carry learner ids only, never names or emails.
