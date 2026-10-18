# Offline-first with an outbox

**Status:** decided · 2026-10-18 · spec §7

## Context

Connectivity is patchy and expensive. A lesson must never wait for the network, and progress must
never be lost or double-counted.

## Decision

The phone is the primary store (IndexedDB). Every action is an event with a unique ID in a local
outbox, sent in small batches when online. The server de-duplicates by event ID; events only append.
Sync also pulls answers (AI doubts) and settings (feature switches, branding).

## Consequences

- Learning works fully offline; retries are safe.
- Unsynced events on a lost phone are lost; labs encourage a weekly sync.
- The server's event log grows without limit; monthly partitions when it gets large.
