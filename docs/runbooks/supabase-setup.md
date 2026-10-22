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

`db push` also creates the private **recordings** bucket. In the dashboard, under **Storage**,
check that it is private, limited to 1 MB, and takes audio types only.

## 5. Deploy the API

```sh
openssl rand -base64 48            # the code pepper: keep it in your password manager
npx supabase secrets set ALLOWED_ORIGINS=<APP_URL> CODE_PEPPER=<the value above>
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
- `CODE_PEPPER` keys the backup login codes. If it changes, every issued code stops working,
  so set it once. Never set `PUBLIC_SUPABASE_URL` in production; it is for the local stack.

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

## 8. The admin tool (codes, export and deletion)

Mentors issue and reset codes in the app (section 10). Export, deletion and the first admin are
done by the owner from the repo, on a trusted computer, with the keys in the shell for that
session only:

```sh
export SUPABASE_DB_URL='<Session pooler connection string>'
export SUPABASE_URL='https://<PROJECT_REF>.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='<service role key>'
export CODE_PEPPER='<the same pepper as the function>' # only for issue-code and reset-code
npm run admin -- --help
```

- **A student without Google:** `npm run admin -- issue-code --name "<name>"` prints the learner
  id and a code like `ABCD-EFGH`. Write the code down for the student. It is not stored anywhere
  and cannot be shown again.
- **A lost or shared code:** `npm run admin -- reset-code --learner <id>`. The old code, and any
  phone signed in with it, stop working at once.
- **A request for their data:** `npm run admin -- export --learner <id> --out <folder>`. This
  writes `learner.json` and the recordings. Hand them over safely, then delete the folder.
- **A request to delete:** check with `npm run admin -- delete --learner <id> --dry-run`, then run
  it with `--yes`. It removes their rows, recordings and sign-ins everywhere. Their phone wipes
  its copy on the next sync, and backups age it out within 30 days.

Close the terminal afterwards, so the keys do not stay in the shell.

## 9. Backups (every night, owned by the NGO)

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
4. Under **R2 → Manage API tokens**, create a token with **Object Write** only, on that bucket
   only. The nightly job only uploads, so a leaked GitHub secret cannot read old backups. For
   restores, create a second token with **Object Read** on the bucket, and keep it offline with
   the age key. Never add the read token to GitHub.
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

Then open **Actions → Backup → Run workflow** once, and check that two files appear in the bucket.

**Restore drill (once a term):** on the NGO computer, download the newest `db-*.dump.age`. Run
`age -d -i shiksha-backup-key.txt db-<date>.dump.age > db.dump`, then
`pg_restore --no-owner --no-privileges -d <a test database URL> db.dump`. Then run
`psql <the same URL> -f tooling/backup/after-restore.sql` (without it, phones see none of the
restored progress). Recordings come back the
same way: `age -d ... recordings-<date>.tar.age | tar -xf -`. CI runs the same check on a local
copy (`tooling/backup/restore-check.sh`) on every pull request.

**Restoring into the live project:** a backup from before a deletion brings that student back.
Before restoring, save the current list of deleted students:
`psql <live URL> -At -c 'select id from deleted_learners' > deleted.txt`. After restoring (and
`after-restore.sql`), run `npm run admin -- delete --learner <id> --yes` for every id in
`deleted.txt`, then delete the file.

## 10. Mentors and admins

**The first admin (once):** with the keys from section 8 in the shell, run
`npm run admin -- add-staff --email <their Google email> --role admin --name "<name>"`. It prints
only the staff id. The admin then opens `<APP_URL>/#/staff` and signs in with that Google account.

**Inviting mentors:** an admin opens **सेटअप**, adds labs and cohorts, and invites each mentor by
their Google email, ticking the cohorts they look after. The invite is claimed by the first
Google sign-in with that email; until then it shows "अभी साइन इन नहीं किया".

**What mentors can do, for their own cohorts only:** see each student's progress and who needs
attention; listen to recordings and mark them reviewed with a short comment; add a student
without Google and give them a backup code, or reset a code; move a student's English or aptitude
start lesson; mark today's attendance.

**What admins can do, for everyone:** everything a mentor can; set up labs, cohorts and staff;
search, move, pause and delete students (delete asks twice and needs the name typed); turn
features on or off for all students or one; set the name and colours (refused when hard to read);
read the audit log.

**Limits:** a mentor never sees students outside their cohorts, and cannot change setup, features,
branding or the audit log. Nobody, admins included, can see a backup code after it is first
shown, or a student's email. Every change is in the audit log; a deleted student's entries stay
but no longer name them. Renaming a student, and pausing or removing a staff member, have no
screen yet: the API supports them, and the screens follow in Plan 4b.

## Know before the pilot

- **Free projects pause** after about a week without activity. Open the dashboard to resume one
  before a class.
- **Free projects have no Supabase backups.** The nightly job in section 9 is the NGO's own
  backup. Set it up before any student data goes in.
- **Consent wording** for the NGO's form: recordings are kept until 30 days after a mentor
  reviews them (90 days if nobody does). Data deleted on request also leaves the backups within
  30 days.
- If something fails, the function's logs are in the Supabase dashboard under **Edge Functions →
  api → Logs**. They carry learner ids only, never names or emails.
