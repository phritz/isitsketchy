# Signals page parameters
_Exported on 7/1/2026 at 16:02:17 CDT from Cursor (3.9.16)_

---

**User**

add a page that shows what signals we use and their parameters. keep it simple. put it at /ui/signals and link to it from the homepage. note on signals page that these parameters are hardcoded but could easily be web-configurable. link to this page also from the /ui/analysis/id page. 

---

**Cursor**

I'll research the codebase to understand the signals, page structure, and conventions before drafting a plan.

Now let me look at the signals implementation and the analysis page.

Let me check the existing subpage structure to match conventions.

I have enough context to write the plan. The request is clear, so I'll present a concise plan.

The signals and their thresholds live in [lib/analysis/signals.ts](lib/analysis/signals.ts), but the thresholds are baked into each `compute` function's inline logic rather than a declarative structure. Since the request is to keep it simple, I'll build a static page mirroring the threshold tables already documented in [plan/signals.md](plan/signals.md), rather than refactoring the signal registry.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

I'll implement the plan. Let me start with the signals page.

`Group` is already imported in the analysis page. Let me check for linter errors on the edited files.

All three to-dos are complete.

## Summary

- Created [app/ui/signals/page.tsx](app/ui/signals/page.tsx): a static server component with a `← Home` back link, an intro, a blue `Alert` noting the thresholds are hardcoded but could easily be made web-configurable, and two tables (Repo signals / Package signals) showing each signal's green/yellow/red thresholds, mirroring [plan/signals.md](plan/signals.md).
- [app/ui/page.tsx](app/ui/page.tsx): added a `How signals work` link next to `View past analyses`.
- [app/ui/analysis/[id]/page.tsx](app/ui/analysis/[id]/page.tsx): added a `What do these signals mean?` link in the header, alongside the existing home link (used the already-imported `Group` to keep the home link in the upper left).

No linter errors. The page is read-only with no data fetching, and the thresholds are hardcoded as a small typed `SignalRow[]` rather than refactoring the signal registry, per the plan.

---

**User**

new page error:

Runtime Error



Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined. You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.

Check the render method of `SignalTable`.
app/ui/signals/page.tsx (123:7) @ SignalTable


  121 |   return (
  122 |     <Table striped withTableBorder>
> 123 |       <Table.Thead>
      |       ^
  124 |         <Table.Tr>
  125 |           <Table.Th>Signal</Table.Th>
  126 |           <Table.Th>Green</Table.Th>



---

**Cursor**

The issue is that this is a server component, but Mantine's compound `Table.*` subcomponents don't resolve in the RSC context. The other pages using `Table` all have `"use client"`. Let me add it.

Fixed. The `Table.Thead`/`Table.Tr`/etc. compound subcomponents weren't resolving in the server-component context. Adding `"use client"` at the top of [app/ui/signals/page.tsx](app/ui/signals/page.tsx) matches the convention used by the other `/ui` pages (all of which are client components) and resolves the runtime error.

All three to-dos remain complete; this was just a rendering fix on the already-created page.

