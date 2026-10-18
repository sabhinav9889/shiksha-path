# Svelte and Dexie for the learner app

**Status:** decided · 2026-10-19 · spec §5.4

## Context

The learner app runs on 1–2 GB RAM Android phones, often offline. It needs small bundles, a
service worker and a reliable local database. The core logic already lives in `@shiksha/learner-core`
behind ports.

## Decision

Svelte 5 + Vite + TypeScript for the UI; Dexie over IndexedDB for the adapters of the core's
storage ports; `vite-plugin-pwa` (Workbox) for the service worker. Client-side only: no server
rendering and no Supabase Realtime.

## Consequences

- Small compiled components and no virtual DOM runtime on low-end phones.
- Dexie hides IndexedDB quirks; the adapters must still pass the core's contract suites.
- Switching framework later touches only the screens, because logic is in the core.

Alternatives rejected: React (larger runtime for the same screens), raw IndexedDB (more code for
the same behaviour).
