# Architecture

Spec §5. Patterns and the "not using" list: `docs/engineering-standards.md`.

## Layers

`handler (Edge Function / route) → service (business logic) → repository (database)`

- Handlers parse and validate input, call one service, map the result. No logic.
- Services hold business rules. No SQL, no Supabase client.
- Repositories are the only code that talks to the database.

## Ports & adapters (spec §5.5)

- Core code depends on interfaces: `Storage`, `Auth`, `AIProvider`, `Calendar`, `Email`, `Clock`.
- Adapters implement them (`SupabaseStorage`, `AnthropicAI`, `GoogleCalendar`). Supabase, Anthropic
  and Google imports live **only** in adapters.
- Swapping a provider means writing one adapter, not editing services.

## API

- The app calls only our versioned API (`/v1/...`) through one API module. Never query tables from
  the app.
- Breaking changes go to a new version (`/v2`); old phones keep working.
- Every request and response is validated with Zod.

## Patterns in use

Offline-first + outbox · append-only events + idempotency keys · repository · strategy + registry
for practice-item types · feature flags · retry with backoff + circuit breaker for external calls ·
rate limiting · summary tables for dashboards · content-addressed assets · error codes.

## Not using (needs a decision record to change)

Microservices · Kubernetes · message queues · GraphQL · custom backend server · Supabase Realtime.
