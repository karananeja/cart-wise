# ADR-001: Application Architecture

**Status:** Proposed — awaiting user decision (open question Q1)
**Date:** 2026-10-06

## Decision

Build a pnpm workspace with a React single-page app and a small Node API backed by SQLite.

## Context

- Brief §22 prefers `React Frontend → Your Backend / API → (External Catalog, Application-Owned State)` and asks that the ownership boundary stay clear even if simplified.
- Brief §26: frontend-focused pet project demonstrating frontend architecture, state management, API integration, async behaviour, testing and simulation.
- Needs real-feeling auth (password hashing, sessions), server-owned inventory with reservations, and simulation timers that run independently of any browser tab.
- Must run locally with no paid services (NFR-1).
- Environment at discovery: Node 24.14, npm 11.14, pnpm 10.33.

## Options Considered

1. **React SPA + Node API + SQLite** — clear boundary, realistic auth and inventory, simulation runs server-side. Two processes (started by one command).
2. **React SPA + in-browser mock backend (MSW + IndexedDB)** — single process, but application-owned data lives in the browser; auth and inventory are fictional; state diverges across tabs.
3. **Next.js full-stack** — one framework, but merges UI and API concerns and shifts focus to framework conventions rather than SPA architecture.

## Decision

Option 1.

| Layer | Choice |
|---|---|
| Workspace | pnpm workspaces: `apps/web`, `apps/api`, `packages/shared` |
| Web | Vite, React, TypeScript, React Router, TanStack Query (server state), small client store for guest state, Tailwind CSS with Radix-based accessible primitives |
| API | Node, Fastify, TypeScript, Zod validation (schemas shared via `packages/shared`) |
| Data | SQLite file database via Drizzle ORM; seed/import scripts |
| Catalog | DummyJSON imported once into the local database by a script and normalised to the application's own product model (see ADR-002) |
| Tests | Vitest + Testing Library (web), Fastify inject (API), MSW for frontend network mocking, Playwright for E2E |

## Reason

It is the smallest architecture that keeps the brief's ownership boundary real, and it lets the frontend be built against a stable, application-defined API contract.

## Consequences

- Two processes in development; mitigated with a single `pnpm dev`.
- SQLite is single-file and local; not a production choice, which is acceptable for the MVP (CLAUDE.md §20: production hardening is separate).
- After the initial import the app works without DummyJSON; only product images still load from its CDN.
