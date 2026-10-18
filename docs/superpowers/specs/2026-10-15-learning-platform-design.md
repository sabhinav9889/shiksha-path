# Shiksha Path — Learning Platform Design (Pilot)

Date: 2026-10-15
Status: Draft for review
Owner: Chetan Parmar (product & build), on behalf of the NGO

## 1. Purpose

Help students from villages and tier-3 cities — with limited English, limited money and limited devices — become job-ready for tech.

**Outcome path (staged):**
1. **Foundation track** → entry-level IT services / tech-support / BPO roles (English, aptitude, problem solving).
2. **Developer track** → junior developer roles and internships (SWE, building products with AI). Built after the pilot.

**Success for the product:** a student with only a low-end Android phone and little English can start, keep making progress, and eventually get a tech job or internship.

## 2. Context and constraints

| Area | Decision |
|---|---|
| Learners | Hindi speakers from villages / tier-3 cities, weak English, some strong in English |
| Devices | Low-end Android phone for daily learning; NGO labs (laptops/PCs) for heavier work |
| Connectivity | Patchy, expensive → offline-first, small downloads |
| Delivery | Blended: self-paced app + NGO mentors and weekly lab sessions |
| Language | Hindi-first pilot; content system supports more languages from day one |
| Content authoring | Drafted with Claude by the product owner, reviewed by NGO mentors; open material (e.g. Khan Academy Hindi, public spoken-English resources) used as raw material, respecting licences |
| Team | One builder using Claude; NGO provides learners, labs, mentors |

## 3. Decomposition

The full program is split into independent sub-projects, each with its own spec → plan → build cycle:

1. **Learner app (phone)** — *this spec*
2. **Content system** — *this spec*
3. Lab environment (coding, AI-assisted building) — later
4. Mentor & NGO tools — *minimal version in this spec, plus mentor meetings and community (§10)*
5. Job pipeline (portfolio, interview prep, employer links) — later

## 4. Approach

**Progressive Web App (PWA)**, one codebase for phones and lab laptops, installable to the home screen, works offline, no app store needed.

Rejected:
- Native Android — better offline performance, but store publishing/updates and a second product for lab PCs.
- WhatsApp + web — fast to launch but no offline structure or real progress tracking; may be used later only for reminders.

## 5. Architecture

### 5.1 Content as files

- Each lesson is a structured file (Markdown with a front-matter header) in the repo.
- Fields: `id`, `track` (§14), `module`, `topic`, `level`, `hi_ratio` (Hindi/English mix), per-language text (`hi` now; others later), practice items, and `review` (`pending` / `approved`, see §9.4).
- Practice item types: multiple-choice meaning, fill-in-the-blank, word ordering, listen-and-choose, speak-and-compare, aptitude puzzle.
- Each wrong option (or common wrong answer) carries a short `why_wrong` explanation per language (see §9.2).
- Each module also has a **test-out quiz**. There is one **placement test**.
- A build step validates content and produces a compact **bundle per module** (target ≤ a few MB, compressed audio, no required video), each with a version number.

### 5.2 App layers

1. **Player** — renders lessons and runs practice items; fully offline once a module is cached.
2. **Progress store** — IndexedDB on the device; every action is recorded as an event in a local **outbox**.
3. **Sync service** — small backend (Supabase: Postgres, auth, file storage) that receives events and serves the mentor view.
4. **AI service** — Supabase Edge Functions that call the Claude API for doubt answers and mentor summaries (§9). The API key lives only in the Edge Function, never on the phone.

### 5.3 Login

- **Google sign-in is required** for every student (Supabase Auth, Google provider). It's free (no SMS OTP or DLT registration), it gives each student an email for calendar invites (§8), and it restores progress on a new device.
- **Set up at enrolment in the lab:** each student creates their own Gmail, or confirms they can sign in to theirs, and writes down the password. The mentor checks it works. Each student uses **their own** account, not a parent's or sibling's.
- **Backup: mentor-issued code**, only for a student who can't have a Google account yet (e.g. under 13 without parent approval through Family Link). These students can learn normally but can't book mentor meetings until they add Google sign-in. The code is reusable and the mentor can reset it.
- Multiple learner profiles per device (shared family phones), each with a 4-digit PIN. The PIN is stored only on the phone and only separates profiles on that device. Each profile keeps its own sign-in session.

### 5.4 Tech stack

The whole backend is Supabase; there is no custom server. Lesson content and the learner's working state live on the device.

| Layer | Choice | Status |
|---|---|---|
| App | PWA, one codebase for phones and lab laptops | Decided |
| Framework | Svelte + Vite + TypeScript (small bundles for 1–2 GB RAM phones) | Builder's call; recommended |
| Offline | Service worker via `vite-plugin-pwa` (Workbox); IndexedDB via Dexie | Builder's call; recommended |
| Content build | Node script: Markdown + front-matter parser, schema validation (e.g. Zod), produces versioned module bundles | Decided (format); tools builder's call |
| App + bundle hosting | Cloudflare Pages (free CDN; bundles are downloaded repeatedly, keep them off Supabase egress) | Recommended |
| Database | Supabase Postgres with row-level security (student → own data, mentor → own cohorts, admin → all) | Decided |
| Auth | Supabase Auth: Google sign-in (required); mentor-issued code as backup (custom Edge Function); mentor/admin accounts on Google | Decided |
| File storage | Supabase Storage for speaking recordings (wifi/lab upload only) | Decided |
| Server logic | Supabase Edge Functions: event ingest + de-duplication, login-code creation, CSV export, AI calls (§9) | Decided |
| Scheduled jobs | Supabase `pg_cron` (weekly mentor summaries) | Decided |
| Meetings | Google Calendar API (events + Meet links) on mentor accounts; NGO on Google Workspace for Nonprofits | Decided |
| Lesson audio | Text-to-speech (Hindi and English voices) generated in the content build; model recordings for speak-and-compare items recorded by mentors | Decided (TTS engine builder's call; pick by Hindi quality, cost and licence) |
| AI model | Claude API — `claude-haiku-5-5` for doubts and summaries; a stronger model (e.g. `claude-sonnet-5-5`) for content drafting | Recommended |
| Tests | Vitest (unit), Playwright (offline/sync scenarios) | Builder's call; recommended |
| Cost | Supabase Free for the pilot; Pro (~$25/month) before any ad-driven intake; Claude API usage capped per §9.1 | — |

Open: audio recording/playback format (size and Android browser support) — builder to pick and test on the cheapest cohort phones.

### 5.5 Backend portability

Supabase is the backend for the pilot and likely well beyond it. Offline-first sync keeps server load low, so Supabase Pro or above should handle tens of thousands of students. These rules keep a later move (for cost at large scale, a data-hosting requirement, or heavy background processing) a step-by-step migration, not a rewrite:

1. **The app talks to our own API, never directly to tables.** Every server call (sync, doubts, bookings, feature switches, mentor and admin actions) goes to versioned endpoints (`/v1/sync`, `/v1/doubts`, `/v1/bookings`, …) through one API module in the app. Moving the backend changes one base URL.
2. **Business logic lives in plain TypeScript modules** with no Supabase-specific imports. Each Edge Function is a thin wrapper that parses the request, calls the module and returns the response. The same modules can later run on Node (Cloud Run, a VM, Kubernetes).
3. **The schema is SQL migration files in git** (Supabase CLI), standard Postgres only. Nothing is created by hand in the dashboard.
4. **We own the user ID.** `learners.id` (and mentor/admin IDs) are our own keys, used everywhere. The Supabase Auth user ID appears only in one mapping table. Since login is Google, a future auth system signs the same people in with no password migration.
5. **One storage interface** (S3-style put/get/delete/signed URL) for recordings and attachments, so switching to S3 or Cloudflare R2 is a configuration change.
6. **No Supabase-only extras** (Realtime, Supabase-specific client features) unless a clear need is written into a spec. RLS stays as a second line of defence and is kept simple; the API modules do the main permission checks.
7. **NGO-owned backups:** a scheduled `pg_dump` plus a storage export to NGO-controlled storage. The Supabase project is in the Mumbai region (India data rules). These backups are also the starting point for any migration.

**Scaling on Supabase first:** bigger compute tier, read replicas, monthly partitions for the progress event log, and pre-computed summary tables for admin dashboards (§8.1).

**If we ever move, in this order:** (1) database → managed Postgres (AWS RDS / Google Cloud SQL); (2) Edge Functions → a Node service running the same modules; (3) files → S3 or R2; (4) auth → our own Google OAuth (or Keycloak). Each step is independent and invisible to students.

## 6. Learner experience

### 6.1 Daily loop (15–20 min)

1. Open → today's lesson shown immediately; streak and progress bar.
2. **Learn** (~5 min): short explanation in Hindi with Hindi audio; English introduced inside it.
3. **Practice** (~10 min): 5–10 small items.
4. **Finish**: recap; mistakes go to a **review queue** that brings them back over the next few days.

### 6.2 Hindi → English bridge

- Early modules ~80% Hindi; English as job-relevant vocabulary and phrases with Devanagari pronunciation help (e.g. "Interview — इंटरव्यू").
- Middle modules ~50/50; instructions in simple English with a Hindi toggle.
- Later modules English-first, Hindi on tap.
- Ratio set per module in content files (`hi_ratio`) as the default. A student's **language preference** (§6.7) overrides it: "English only" students see English everywhere. AI answers (§9.1) follow the student's preference, otherwise the current module's `hi_ratio`.
- Vocabulary focused on work: office, interview, email, computer, customer support.

### 6.3 Placement and skipping ahead

- **Placement test** on first launch (~10 min): reading, vocabulary, listening, sentence building, plus problem-solving items placed separately. Sets the starting point. Can be skipped (start from the beginning).
- *Pilot simplification (builder's call):* with only one module, placement sets the starting **lesson** within English Foundation 1. It is a **fixed form** (the same items for everyone, not adaptive), so the end-of-pilot retake (§13) gives comparable before/after scores. Adaptive placement comes later, once there are several modules. A mentor signs off on the items and scoring.
- **Test-out quiz** per module: pass → module marked complete.
- Mentors can change a student's level manually.
- **Skip what you already know:** English and problem solving are placed independently. A student strong in English skips the English modules they test out of and goes straight to the next thing, which in the pilot is the aptitude puzzles. No extra module is built for strong-English students in the pilot.

### 6.4 Problem solving

Aptitude-style puzzles (logic, patterns, basic maths) alongside English, Hindi wording first and English later, matching IT-services hiring tests.

### 6.5 Speaking

Record and compare with a model recording. **No automatic pronunciation scoring in the pilot**; mentors review recordings.

### 6.6 Pilot content scope

- Placement test.
- **English Foundation 1**: ~20 lessons (greetings, introducing yourself, numbers, basic workplace words, simple questions) + test-out quiz.
- ~20 aptitude puzzles.

### 6.7 Language preference

- Each learner profile has a preference: **"Hindi + English"** (default) or **"English only"**.
- Placement suggests "English only" when the English score is high. The student or their mentor can change it at any time.
- "English only" applies everywhere: app interface, error messages, lesson text, aptitude puzzles, `why_wrong` explanations, and AI doubt answers and summaries shown to the student.
- So the interface strings, aptitude puzzles and `why_wrong` text exist in both `hi` and `en`. The content pipeline (§9.4) drafts both versions together, and the build checks both are present.

## 7. Data and sync

### 7.1 On the phone (IndexedDB)

Cached module bundles; learner profile(s) (ID, level, placement result); progress, review queue, streak; speaking recordings until synced; outbox of unsent events.

### 7.2 On the server (Supabase)

Learners (ID, name, Google email or backup code, cohort, lab, language preference); append-only progress event log; cohorts, mentors, labs; speaking recordings (uploaded only on wifi/lab).

### 7.3 Sync rules

- Every action recorded locally first as an event with a unique ID.
- Outbox sent in small batches when online; server de-duplicates by event ID, so retries never double-count.
- Events only add; merging across devices is simple.
- "Last synced" indicator for students and mentors.
- New/lost device: sign in with Google (or backup code) → progress restored from server. Unsynced events on a lost device are lost; labs encourage a weekly sync.

### 7.4 Privacy

- Collect only: name, Google account email (or backup code), cohort, progress, recordings, and doubts asked to the AI helper. No location, contacts or other device data.
- Doubt text and the current lesson text are sent to the AI provider (Anthropic) to produce an answer. The app sends no name, phone number or other identifier. Before sending, the Edge Function masks anything in the doubt text that looks like a phone number or email address, since students may type these themselves. The NGO's consent form tells guardians this, worded as "we do not send" plus "we remove details students type by mistake where we can". It does not promise that nothing ever gets through.
- Recordings visible only to the student and their mentors.
- The NGO owns the data; simple deletion-on-request process.
- Some learners may be minors: NGO handles consent with guardians at enrolment.

## 8. Mentor and admin tools

**Mentor view** (web, part of the same PWA):
- Cohort list: level, lessons this week, streak, last sync.
- **Needs attention**: inactive ≥ 3 days, stuck on one lesson, repeated low scores.
- Student detail: progress, weak topics, recordings with short comments, doubts asked and the AI's answers, weekly AI summary (§9.3).
- Actions: create login codes, change level, mark lab attendance, set AI doubt limits (§9.1), flag a bad AI answer.

### 8.1 Admin panel

A web section of the same PWA, visible only to the **admin** role (NGO admins and the product owner). Admins see all cohorts, labs, mentors and students.

**Setup:** create labs, cohorts and mentor accounts; set the org-wide AI doubt maximum (§9.1); set the safeguarding contact email (§9.1); adjust booking rules (§10.1); branding (below).

**Manage students**
- A list of every student, with search and filters: cohort, lab, mentor, level, language preference, active / inactive, needs attention.
- Student detail: everything the mentor sees (§8), plus meetings booked and attended, AI doubt usage, and that student's feature switches.
- Actions: edit details, move to another cohort or mentor, change level, reset the backup code, deactivate (can't sign in, data kept), and **delete on request** (removes the student's data and recordings, per §7.4).

**Track progress**
- Org-wide dashboard, filterable by cohort, lab and date range:
  - active students per day and week, and the share active ≥ 4 days/week (§13 target)
  - lessons completed, test-outs, and English Foundation 1 completion rate
  - average placement score at start and on retake
  - streaks, students inactive ≥ 3 days, students stuck on a lesson
  - weak topics across the cohort, from wrong answers and doubts
  - doubts asked and AI cost; meetings booked, done and no-show
- Per-student progress timeline: lessons, scores, doubts and meetings in date order.
- CSV export of any list or dashboard, for funder reports.
- Tracking covers learning activity inside the app only: no location, contacts or activity outside the app (§7.4).

**Feature switches**
- Each switchable feature has an **all-students** setting (on/off), and an admin can set an **individual override** for any student. The individual override wins.
- Switchable features: AI doubt solver, speaking practice, placement test, "English only" option, mentor booking, community feed. *(Builder's call: more can be added as a list in the database, with no new screens needed.)*
- The phone fetches its switches at sign-in and on every sync, and keeps the last known values offline. Turning a feature off hides it in the app. The server also refuses that feature's requests (e.g. AI doubts, bookings), so an old copy on the phone can't use it.
- Turning off a feature never deletes data. Turning it on again brings everything back.

**Branding** *(details are builder's calls unless stated)*
- Admins can change the **platform name** (Hindi and English), the **logo**, and the **theme**, without a new app release. This is decided.
- **Logo:** SVG or PNG, max 500 KB. The server generates the PWA app icons (192 px, 512 px, maskable) and the favicon from it. Square images work best, and admins see a preview of the home-screen icon before saving.
- **Theme:** a primary colour and an accent colour, chosen from a curated set of presets or entered as a custom hex value. The panel **blocks colours that fail contrast** (WCAG AA 4.5:1 for text on that colour), so the app stays readable on cheap screens in sunlight. Fonts and layout are not changeable.
- **Live preview** of the phone home screen and the login screen before publishing; **Reset to default** is always available.
- **How it reaches phones:** branding is a small versioned file, fetched at sign-in and on every sync like the feature switches, and cached for offline use. The installed app's name and icon (PWA manifest) update when the browser refreshes the installed app, which can take a few days on Android. The admin panel says so.
- Every branding change is in the audit log.

**Audit log:** every admin action (switch changed, student edited, moved, deactivated, deleted) is logged with who did it and when, and admins can view the log.

**In pilot, see §10:** 1-to-1 mentor meetings and the mentor community feed.

**Out of pilot:** chat/direct messaging, student posts or comments in the community, assignments, in-app content editing, custom/advanced analytics beyond §8.1, automatic pronunciation scoring, coding environment, AI-building tools, job pipeline.

## 9. AI features

Four AI features in the pilot. All online AI calls go through Supabase Edge Functions; the phone never holds an API key.

### 9.1 Doubt solver

**Student flow**
- Every lesson and practice screen has a **"मुझे समझ नहीं आया"** button.
- The student types the doubt in Hindi, Hinglish or English. Voice input is the phone keyboard's built-in voice typing; the app does no audio processing for doubts.
- The answer appears in the same screen: short (a few sentences), simple Hindi at the student's `hi_ratio`, with English terms and Devanagari pronunciation as in §6.2.
- The student can mark an answer "समझ आया" (helpful) or "अभी भी समझ नहीं आया" (not helpful).

**Offline**
- A doubt asked offline is saved as an outbox event like any other action (§7.3) and the student sees "जवाब इंटरनेट मिलने पर आएगा".
- Answers are stored on the server; sync **pulls** new answers back to the phone. (This adds a pull step to sync, which was push-only.)

**How the answer is made**
- The phone sends: doubt text, lesson ID, item ID (if on a practice item), the student's level and `hi_ratio`. It does not send lesson text.
- The Edge Function loads the lesson text from the published bundle, builds the prompt and calls `claude-haiku-5-5`.
- The system prompt keeps the AI to the student's learning (English, aptitude, the current lesson, job-related study). Off-topic requests get a polite Hindi redirect, not an answer.
- **Safeguarding:** if a doubt suggests the student may be at risk or in distress, the AI does not attempt counselling. Instead:
  - The student gets a short caring reply with helpline numbers: **Tele-MANAS 14416** (mental health, 24×7) and **Childline 1098** (children in need).
  - The doubt is flagged "needs attention" for the mentor (§8).
  - An **email alert** goes immediately to the NGO's safeguarding contact, set by the NGO admin. It is sent from the NGO's Google Workspace and contains the student's name, cohort, mentor and the doubt text.
  - If the doubt was asked offline, the alert goes when it syncs, and the alert shows when the doubt was actually asked.
  - The helpline reply also works offline: the phone checks for a small built-in list of distress keywords and shows the helpline numbers immediately, without waiting for sync.

**Limits (configurable)**
- **Org maximum**: set by the NGO admin. A hard ceiling no one can exceed.
- **Cohort default**: set by the mentor; starts at **10 doubts per student per day**.
- **Per-student override**: set by the mentor (raise, lower, or 0 to switch off for that student).
- Effective limit = min(per-student override if set, else cohort default; org maximum).
- Enforced on the server, counted per student per calendar day in India time. Over the limit, the student sees a friendly message suggesting they try tomorrow or **book a Doubt meeting** with their mentor (§10.1), with a button that opens booking with the topic and note pre-filled. The doubt is not sent to the AI, but the mentor can still see it.

**No in-app mentor replies.** Mentors don't type answers to doubts. A student who needs a human answer books a Doubt meeting (§10.1).

**Mentor visibility**
- Mentors see every doubt and answer for their cohorts, including helpful / not-helpful marks.
- A mentor can flag an answer as wrong; flagged answers are listed for the product owner to improve prompts or lesson content, and the mentor can cover it with the student in a meeting or lab session.
- When a student marks an answer "अभी भी समझ नहीं आया", the app offers to book a Doubt meeting.

### 9.2 "Why was I wrong?"

- After a wrong answer, the player shows that option's `why_wrong` explanation (§5.1).
- Explanations are written at content-build time (drafted by §9.4, reviewed with the lesson), so this works fully offline and costs nothing per student.
- If an item has no explanation for the given answer, the player shows the correct answer and the "मुझे समझ नहीं आया" button.

### 9.3 Weekly mentor summary

- A weekly `pg_cron` job calls an Edge Function that, for each active student, sends that week's progress events and doubts (no name or phone number) to `claude-haiku-5-5` and stores a 2–3 line note, e.g. "Numbers में कमज़ोर, tenses पर 4 doubts, 3 दिन से inactive".
- Shown in the mentor's student detail and cohort list. No on-demand regeneration in the pilot (keeps cost predictable).
- The summary supports, not replaces, the rule-based "Needs attention" list (§8).

### 9.4 Content pipeline

- A script run by the product owner drafts lessons, practice items and `why_wrong` explanations into the lesson file format (§5.1), using a stronger Claude model. Open-licence source material is passed in as reference, respecting licences (§2).
- The pipeline also generates lesson **audio** with text-to-speech. Speak-and-compare model recordings are recorded by mentors and added to the lesson folder.
- Every generated file is marked `review: pending`. Mentors review and the product owner sets `review: approved`.
- *Review surface (builder's call):* a separate **preview build** of the app that includes `pending` lessons, plus one shared sheet (lesson ID, item, comment, OK/fix). Mentors never touch Markdown or git. The product owner applies fixes to the files and approves them.
- The content build refuses to include any lesson that is not `approved`.

### 9.5 Cost guardrails

- Doubt limits (§9.1) cap per-student spend; summaries run once a week.
- Prompts and answers are kept short (slow networks and token cost).
- A monthly spend limit is set on the Anthropic account as a backstop.
- Every AI call is logged (student/cohort, feature, tokens) so the NGO can see cost per cohort.

## 10. Mentor connect and community

Part of the pilot. It needs internet. The app caches the latest data so students can view it offline, but booking and posting happen online.

### 10.1 1-to-1 meetings

**Mentor side**
- The mentor connects their Google account once and publishes **open slots**: date, start time, length (default 30 min), one-off or weekly repeating.
- The mentor sees upcoming bookings with the student's chosen topic and note, and can cancel with a reason.

**Student side**
- The dashboard shows **"मेंटर से बात करें / Talk to a mentor"** with the open slots of mentors in the student's cohort *(my call: own cohort's mentors only)*.
- The student picks a **topic**: Doubt, Progress review, Career advice, Resume building. They can add a short note (e.g. the doubt), then book the slot.
- The booking shows in the app as "Upcoming meeting" with a **Join Google Meet** button.

**Calendar and Meet**
- On booking, an Edge Function creates a Google Calendar event on the **mentor's calendar** using the Google Calendar API, with the student's Google email as attendee and a Google Meet link attached.
- Both sides get the event in Google Calendar, with Google's own reminders (e.g. 30 min before). No separate notification system is built.
- Cancelling from either side deletes or updates the calendar event and frees the slot.
- **Setup (decided):** the NGO uses **Google Workspace for Nonprofits** (free), with mentor and admin accounts on the NGO's domain. The app's calendar access is an internal Workspace app, which avoids Google's public-app verification. Students keep their personal Gmail and only grant basic sign-in (email, profile). The NGO's Workspace also sends the safeguarding alert emails (§9.1).
- *Lead time:* the Google for Nonprofits application and domain setup should start now, since approval can take days to weeks.

**Rules (my calls, adjustable by NGO admin)**
- A slot can be booked by one student only. The database prevents double-booking.
- A student can hold at most **2 upcoming bookings** at a time.
- Students can book from 24 hours ahead up to 14 days ahead, and cancel up to 2 hours before.
- Mentors mark each meeting **done** or **no-show**, and can add a private note, which appears in the student detail (§8).
- Students on a backup code (§5.3) see the slots but are asked to add Google sign-in before booking.

### 10.2 Community

- A feed in the app where **mentors and NGO admins post**. Students read; there are no student posts or comments in the pilot.
- A post has a title, text, optional **session details** (date, time, link to Meet/YouTube/other) and optional attachments (images or PDF, size-limited, stored in Supabase Storage).
- Session posts show a **countdown** and an **"Add to calendar"** button that adds the event to the student's own Google Calendar.
- A post can go to everyone or to one cohort. Mentors can edit or delete their own posts, and admins can delete any post.
- The latest posts are cached for offline reading.

### 10.3 Data (Supabase)

`mentor_slots`, `bookings` (slot, student, topic, note, status, calendar event ID, Meet link), `meeting_notes`, `community_posts`, `post_attachments`. RLS: students see open slots of their cohort's mentors and their own bookings; mentors see their own slots and bookings; posts are visible to their audience.

## 11. Error handling

| Situation | Handling |
|---|---|
| Low storage | Check before download; Hindi message; offer to delete finished modules; audio downloadable separately |
| Failed/partial download | Chunked, resumable; bundle verified before it's marked ready; broken module never shown |
| Browser clears storage | Request persistent storage; nudge sync after each lesson when online; server is the backup |
| Sync failure | Outbox waits and retries; student sees "saved on phone, will upload later" |
| Old app version | PWA auto-updates in background; versioned bundles keep old phones working |
| Mic permission denied | Hindi explanation; speaking items skippable, never block a lesson |
| AI service down or slow | Doubt stays queued and is retried; student sees "जवाब थोड़ी देर में आएगा"; never blocks a lesson |
| Doubt limit reached | Friendly message; offer to book a Doubt meeting (§9.1, §10.1) |
| Slot taken just before booking | "यह समय अभी किसी और ने बुक कर लिया" and the list refreshes |
| Google Calendar/Meet creation fails | Booking kept as "pending link"; retried; mentor notified in the app; student sees "मीट लिंक जल्द आएगा" |
| Mentor's Google connection expired | Mentor prompted to reconnect; their slots hidden from students until fixed |
| All errors | Plain Hindi with an icon; no technical codes |

## 12. Testing

- **Unit tests** for scoring, review queue, outbox/sync (including duplicate events and answer pull), placement logic, doubt-limit calculation (org max / cohort default / override), booking rules (double-booking, max upcoming, cancel window), feature-switch resolution (all-students setting vs individual override).
- **Feature-switch test**: switching a feature off for one student hides it on their phone after sync, and the server rejects that feature's requests even from an un-synced phone.
- **Integration test** of booking → calendar event + Meet link → cancel, against a test Google Workspace account.
- **Content validation** in the build: required fields, Hindi text present, referenced audio exists, `review: approved`, `why_wrong` present for wrong options.
- **Safeguarding test**: a distress doubt asked offline shows the helpline immediately, and after sync it triggers the email alert.
- **AI prompt checks**: a fixed set of sample doubts (on-topic, off-topic, Hinglish, distress) run against the doubt prompt before each prompt change; answers read by the product owner and a mentor.
- **Device testing** on the cheapest real phones in the cohort (1–2 GB RAM, Android Go) and with Chrome slow-3G/offline simulation.
- **Field dry run** with 3–5 students and one mentor, observed without help, before the full cohort.

## 13. Pilot plan and success measures

One cohort of ~30 students, 6–8 weeks, one NGO lab.

| Measure | Target |
|---|---|
| Engagement | ≥ 60% of students active ≥ 4 days/week |
| Completion | ≥ 50% finish English Foundation 1 |
| Learning | Placement score improves on retake at the end |
| Technical | Works offline on the cheapest cohort phones; near-zero sync data loss |
| Qualitative | Mentor and student feedback on confusing, boring or too-hard parts |
| AI helper | ≥ 70% of doubt answers marked helpful; few mentor-flagged wrong answers; AI cost per student tracked |

Results decide the next build: more content, the lab coding/AI track, or fixes.

## 14. Curriculum roadmap (beyond the pilot)

The direction for the program after the pilot. Each stage gets its own content plan (and spec, where it needs new app features). Timings are rough and depend on pilot results.

| Stage | Months (approx.) | Where | Subjects | Exit |
|---|---|---|---|---|
| **1. Foundation** (the pilot) | 0–2 | Phone | English Foundation 1; aptitude basics (logic, patterns, basic maths) | — |
| **2. Job-ready foundation** | 2–6 | Phone + lab | English Foundation 2–3 (workplace English, spoken English, email writing); speaking practice and AI mock interviews; digital literacy (computer basics, typing, internet, email, Google Docs/Sheets); **using AI at work** (drafting emails, looking things up, checking AI answers for mistakes); customer support skills with a focus on **voice, complex cases and escalations** that bots hand over; aptitude at IT-services hiring-test level | **First job:** voice / escalation support, IT support / BPO; **Indian-language AI data work** (labelling, evaluating AI answers in Hindi, content review) |
| **3. Tech foundations** | 6–9 | Mostly lab; theory and quizzes on phone | How computers, the internet and data work; IT support basics (operating systems, networking, troubleshooting beyond scripted fixes); programming logic (flowcharts → Python or JavaScript basics); HTML and CSS; **software testing basics** (writing test cases, finding and reporting bugs); using AI to learn and to troubleshoot | Helpdesk / IT support; **QA / software testing**; **digital services for local businesses** (online presence, payments, simple websites) |
| **4. Developer track** | 9–18 | Lab / laptop | **Build and verify, not just write code:** reading and understanding code, debugging, testing, shipping. JavaScript → web apps (one framework); databases and SQL; APIs; Git and GitHub; building with AI (AI coding tools, small products using AI APIs) and reviewing what AI produces; 2–3 portfolio projects | **Junior developer roles and internships** |
| **5. Job pipeline** | Alongside stages 2–4 | Lab + mentors | Resume and portfolio; mock interviews in employers' actual formats; employer referrals; internships | Placement |

**Principles**
- **Two exits:** many students will take a job after Stage 2. A smaller group continues to Stage 4, possibly while working. Both count as success.
- **Coding happens in labs.** From Stage 3, laptops are essential, so lab capacity limits how many students can take the developer track. The phone app handles theory, quizzes and revision.
- **Design backwards from hiring.** Stage 2 and 5 content is shaped by the actual hiring criteria and test formats of 2–3 partner employers. The NGO collects these during the pilot.
- **AI is a skill in every stage, not a topic at the end.** From Stage 2 onward, students learn to use AI tools for their work and, above all, to check whether the AI's output is correct. The goal is students who work with AI, not students competing with it.
- **Build on what lasts.** English communication, problem solving and fundamentals (how computers, the internet, data and code work) are the core of every stage. Specific tools are taught as examples of the fundamentals and are expected to change.
- **Exits favour work that grows with AI.** Entry-level chat/email support, scripted helpdesk work and boilerplate coding are the most exposed to automation. The roadmap leans towards voice and escalation support, Indian-language AI data work (where Hindi fluency is an asset), QA and testing, local digital services, and developers who verify and ship. *(These exits are proposals; check them against local employer demand during the pilot.)*
- **Yearly roadmap review.** Once a year, the NGO and product owner review this roadmap against what partner employers are hiring for. They retire modules for skills that are no longer hired for and add new ones. Because content lives in files and tracks are extensible (below), this needs content work, not an app rewrite.

**What the pilot build must allow for (so later stages don't need a rewrite)**
- Lesson files carry a `track` (e.g. `english`, `aptitude`, `digital`, `ai-skills`, `support`, `tech`, `qa`, `dev`). Tracks are a list in the content, not hard-coded in the app, so the yearly review can add or retire them. Modules are grouped by track, and placement and test-outs work per track (as English and aptitude already do, §6.3).
- The practice-item types (§5.1) are an extensible list, so later stages can add items such as typing tests or code-reading questions without changing the format.
- Admin and mentor progress views (§8, §8.1) show progress **per track**.
- A student record can hold **job outcomes** later (interview, offer, joined, still employed after 3 months). These are not built in the pilot, but the data model shouldn't block them.

## 15. Open items for later specs

**Employability layer (future, worth planning for).** The roadmap's skills make students ready, but whether they get hired also depends on:
- A **job-readiness module** in Stage 5: mock interviews in employers' formats, workplace behaviour, offer and salary basics, and preparing to relocate (budget, housing, safety).
- **Proof:** a portfolio and a certificate per stage, plus recognised certifications (e.g. IT-ITeS Sector Skill Council / NSDC) if local employers value them.
- **Support after placement:** mentor check-ins during the first 3 months, when most first-job dropouts happen.
- **Job outcome tracking** in the admin panel: interviews, offers, joined, still employed after 3 months.
- **Non-syllabus barriers** the NGO helps with: documents and bank account, family support (especially for young women), and the cost of moving to a city before the first salary.

- AI speaking feedback, conversation (interview / support-call) practice, writing correction, AI-generated extra practice on weak topics.
- Self-serve onboarding for students acquired through ad campaigns (signup without a mentor, consent for minors, attribution fields).

- Lab environment for coding and AI-assisted product building.
- Job pipeline and employer partnerships.
- Second language rollout.
- Automatic pronunciation feedback.
