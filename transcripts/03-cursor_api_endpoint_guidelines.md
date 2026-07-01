# API endpoint guidelines
_Exported on 7/1/2026 at 15:57:33 CDT from Cursor (3.9.16)_

---

**User**

start an agents md file that includes the following information:
- planning md files go in /plan and plan/project.md has the high level
- all api endpoints should force dynamic and return headers such that caching is disabled
- all api endpoints must declare explicit request and response types FooRequest, FooResponse; all endpoints have a client.ts file that provides the entrypoint for the endpoint and declares the input and output types
- for now we will case requests and responses to the appropriate type, we will use zod later for runtime validation later if there is time
- do not use any, prefer explicit types; use explicit type annotations in function declarations
- do not use default values, require explicit parameters
- use axios for fetching
- new api endpoints should have the list (GET), create (POST), update (PUT), delete (DELETE) handlers all in a single route.ts file
- for new CRUD functionality use api endpoints not server actions
- api endpoint should take url parameters if the args are simple, otherwise an explicit json FooRequest type
- don't use nested try/catch within a function, just have a top level try/catch
- do not suppress errors in handlers


---

**Cursor**

I'll take a quick look at the repo structure to understand the project context before drafting the AGENTS.md plan.

The repo is essentially empty (just `LICENSE` and `.gitignore`), so this is greenfield. The request is clear and self-contained. Let me put together the plan for the `AGENTS.md`.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Created `AGENTS.md` at the repo root with four sections:

- **Planning** — plan files in `/plan`, high-level overview in `plan/project.md`.
- **API Endpoints** — API endpoints over server actions, all CRUD handlers (`GET`/`POST`/`PUT`/`DELETE`) in one `route.ts`, force-dynamic + no-store caching, URL params for simple args vs. `FooRequest` JSON otherwise, single top-level `try/catch` with no error suppression.
- **Types and Client** — explicit `FooRequest`/`FooResponse` types, a `client.ts` entrypoint per endpoint, casting for now with zod planned later.
- **TypeScript Style** — no `any`, explicit type annotations, no default params, axios for fetching.

I left `/plan` unscaffolded since it wasn't requested—let me know if you'd like me to create `plan/project.md` as a starting point.

---

**User**

add that this is an MPA to agents file

---

**Cursor**

Added an **Architecture** section to `AGENTS.md` noting that this is a multi-page application (MPA).

