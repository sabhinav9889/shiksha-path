# Testing

## TDD (always)

Red → green → refactor. Write the test, watch it fail for the right reason, then write the minimum
code. A test that passes before the code exists is testing nothing.

## Tools and layout

- Vitest for unit and integration tests: `<name>.test.ts` next to the source.
- Playwright for app flows, offline and slow-network scenarios.
- Coverage minimum: **70%** lines, functions, branches, statements (CI fails below).

## What to test

- Behaviour, not implementation. Assert outputs and effects, not that a mock was called.
- Every bug fix starts with a test that reproduces it.
- **Data isolation:** always test with **2+ students and 2+ cohorts**, and prove one cannot read or
  change the other's data (repositories and RLS policies).
- **Offline:** lessons work with the network off; the outbox retries; duplicate events don't
  double-count.
- **Limits and switches:** doubt limits (org max / cohort default / override), feature switches
  (all-students vs individual override), booking rules.

## Mocks

- Mock only at the edges (ports): AI, calendar, email, clock.
- Test data from factories: `makeLearner(overrides)`, `makeLesson(overrides)`.
- Never mock the thing under test.

## Tests are code

The size rules apply, except: test files up to 500 lines, no function-length limit, magic numbers
allowed.
