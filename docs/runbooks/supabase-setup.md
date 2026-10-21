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
3. In **Authentication → Sign In / Providers**, turn off the **Email** provider. Students sign in
   with Google only, and email sign-in is on by default. Leave the general "allow new users to
   sign up" setting **on**: new students sign up through Google.

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

## Know before the pilot

- **Free projects pause** after about a week without activity. Open the dashboard to resume one
  before a class.
- **Free projects have no backups.** Backups and the move to Pro come with Plan 3b. Until then,
  keep the pilot small.
- If something fails, the function's logs are in the Supabase dashboard under **Edge Functions →
  api → Logs**. They carry learner ids only, never names or emails.
