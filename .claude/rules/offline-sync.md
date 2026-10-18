# Offline and sync

Spec §7. The phone is the primary store; the server is the backup and the mentor's view.

## Outbox

- Every learner action is saved locally first as an event with a unique ID (UUID v4).
- The outbox sends small batches when online and retries with backoff.
- The server ingests idempotently: the same event ID twice changes nothing.
- Events only append. Never edit or delete past events to "fix" progress.

## Pull

Sync also pulls: AI doubt answers, feature switches, branding, mentor level changes.

## Never block learning

- A lesson must work with the network off, the AI down or the server slow.
- Show "saved on phone, will upload later", never an error, when sync fails.

## Bundles

- Lesson bundles are versioned and content-addressed. Verify the SHA-256 before marking a bundle
  ready; never show a broken module.
- Check storage before downloading; downloads are resumable.
- Request persistent storage; nudge a sync after each lesson.

## Tests

Offline lesson, failed sync with retry, duplicate events, a second device restoring progress, an old
bundle version still working.
