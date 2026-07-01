# AGENTS.md

Conventions for working in the isitsketchy project. Follow these unless a task explicitly overrides them.

## Architecture

- This is a multi-page application (MPA).

## Planning

- Planning markdown files live in `/plan`.
- `plan/project.md` holds the high-level project overview.

## API Endpoints

- Use API endpoints for new CRUD functionality, not server actions.
- Each new CRUD resource declares its handlers together in a single `route.ts`:
  - list -> `GET`
  - create -> `POST`
  - update -> `PUT`
  - delete -> `DELETE`
- All endpoints force dynamic rendering and disable caching:
  - `export const dynamic = "force-dynamic"`
  - return `Cache-Control: no-store` (and related no-cache headers) on responses
- Argument passing:
  - simple args use URL parameters
  - anything non-trivial uses an explicit JSON `FooRequest` type
- Error handling:
  - one top-level `try/catch` per handler
  - do not nest `try/catch` within a function
  - do not suppress errors in handlers

## Types and Client

- Every endpoint declares explicit request and response types: `FooRequest`, `FooResponse`.
- Every endpoint has a `client.ts` file that is the entrypoint for that endpoint and declares its input and output types.
- For now, cast requests and responses to the appropriate type. Adopt zod for runtime validation later if there is time.

## TypeScript Style

- Do not use `any`. Prefer explicit types.
- Use explicit type annotations in function declarations.
- Do not use default parameter values. Require explicit parameters.
- Use axios for fetching.
