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
4. Mentor & NGO tools — *minimal version in this spec*
5. Job pipeline (portfolio, interview prep, employer links) — later

## 4. Approach

**Progressive Web App (PWA)**, one codebase for phones and lab laptops, installable to the home screen, works offline, no app store needed.

Rejected:
- Native Android — better offline performance, but store publishing/updates and a second product for lab PCs.
- WhatsApp + web — fast to launch but no offline structure or real progress tracking; may be used later only for reminders.

## 5. Architecture

### 5.1 Content as files

- Each lesson is a structured file (Markdown with a front-matter header) in the repo.
- Fields: `id`, `module`, `topic`, `level`, `hi_ratio` (Hindi/English mix), per-language text (`hi` now; others later), and practice items.
- Practice item types: multiple-choice meaning, fill-in-the-blank, word ordering, listen-and-choose, speak-and-compare, aptitude puzzle.
- Each module also has a **test-out quiz**. There is one **placement test**.
- A build step validates content and produces a compact **bundle per module** (target ≤ a few MB, compressed audio, no required video), each with a version number.

### 5.2 App layers

1. **Player** — renders lessons and runs practice items; fully offline once a module is cached.
2. **Progress store** — IndexedDB on the device; every action is recorded as an event in a local **outbox**.
3. **Sync service** — small backend (Supabase: Postgres, auth, file storage) that receives events and serves the mentor view.

### 5.3 Login

- Phone number or mentor-issued code. No email.
- Multiple learner profiles per device, each with a 4-digit PIN (shared family phones).

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
- Ratio set per module in content files (`hi_ratio`).
- Vocabulary focused on work: office, interview, email, computer, customer support.

### 6.3 Placement and skipping ahead

- **Placement test** on first launch (~10 min, adaptive): reading, vocabulary, listening, sentence building, plus problem-solving items placed separately. Sets starting module and Hindi/English ratio. Can be skipped (start from the beginning).
- **Test-out quiz** per module: pass → module marked complete.
- Mentors can change a student's level manually.

### 6.4 Problem solving

Aptitude-style puzzles (logic, patterns, basic maths) alongside English, Hindi wording first and English later, matching IT-services hiring tests.

### 6.5 Speaking

Record and compare with a model recording. **No automatic pronunciation scoring in the pilot**; mentors review recordings.

### 6.6 Pilot content scope

- Placement test.
- **English Foundation 1**: ~20 lessons (greetings, introducing yourself, numbers, basic workplace words, simple questions) + test-out quiz.
- ~20 aptitude puzzles.

## 7. Data and sync

### 7.1 On the phone (IndexedDB)

Cached module bundles; learner profile(s) (ID, level, placement result); progress, review queue, streak; speaking recordings until synced; outbox of unsent events.

### 7.2 On the server (Supabase)

Learners (ID, name, phone/code, cohort, lab); append-only progress event log; cohorts, mentors, labs; speaking recordings (uploaded only on wifi/lab).

### 7.3 Sync rules

- Every action recorded locally first as an event with a unique ID.
- Outbox sent in small batches when online; server de-duplicates by event ID, so retries never double-count.
- Events only add; merging across devices is simple.
- "Last synced" indicator for students and mentors.
- New/lost device: log in with phone/code → progress restored from server. Unsynced events on a lost device are lost; labs encourage a weekly sync.

### 7.4 Privacy

- Collect only: name, phone or code, cohort, progress, recordings. No location, contacts or other device data.
- Recordings visible only to the student and their mentors.
- The NGO owns the data; simple deletion-on-request process.
- Some learners may be minors: NGO handles consent with guardians at enrolment.

## 8. Mentor and NGO tools (minimal)

**Mentor view** (web, part of the same PWA):
- Cohort list: level, lessons this week, streak, last sync.
- **Needs attention**: inactive ≥ 3 days, stuck on one lesson, repeated low scores.
- Student detail: progress, weak topics, recordings with short comments.
- Actions: create login codes, change level, mark lab attendance.

**NGO admin:** create labs, cohorts, mentor accounts; CSV export of progress for funder reports.

**Out of pilot:** messaging, assignments, in-app content editing, analytics dashboards, automatic pronunciation scoring, coding environment, AI-building tools, job pipeline.

## 9. Error handling

| Situation | Handling |
|---|---|
| Low storage | Check before download; Hindi message; offer to delete finished modules; audio downloadable separately |
| Failed/partial download | Chunked, resumable; bundle verified before it's marked ready; broken module never shown |
| Browser clears storage | Request persistent storage; nudge sync after each lesson when online; server is the backup |
| Sync failure | Outbox waits and retries; student sees "saved on phone, will upload later" |
| Old app version | PWA auto-updates in background; versioned bundles keep old phones working |
| Mic permission denied | Hindi explanation; speaking items skippable, never block a lesson |
| All errors | Plain Hindi with an icon; no technical codes |

## 10. Testing

- **Unit tests** for scoring, review queue, outbox/sync (including duplicate events), placement logic.
- **Content validation** in the build: required fields, Hindi text present, referenced audio exists.
- **Device testing** on the cheapest real phones in the cohort (1–2 GB RAM, Android Go) and with Chrome slow-3G/offline simulation.
- **Field dry run** with 3–5 students and one mentor, observed without help, before the full cohort.

## 11. Pilot plan and success measures

One cohort of ~30 students, 6–8 weeks, one NGO lab.

| Measure | Target |
|---|---|
| Engagement | ≥ 60% of students active ≥ 4 days/week |
| Completion | ≥ 50% finish English Foundation 1 |
| Learning | Placement score improves on retake at the end |
| Technical | Works offline on the cheapest cohort phones; near-zero sync data loss |
| Qualitative | Mentor and student feedback on confusing, boring or too-hard parts |

Results decide the next build: more content, the lab coding/AI track, or fixes.

## 12. Open items for later specs

- Lab environment for coding and AI-assisted product building.
- Job pipeline and employer partnerships.
- Second language rollout.
- Automatic pronunciation feedback.
