# Analyses list loading issue
_Exported on 7/1/2026 at 16:02:57 CDT from Cursor (3.9.16)_

---

**User**

on the analyses list page it shows 'no results' when it should show loading. only show no results if there are actually no results.

---

**Cursor**

I'll add a loading state so it shows loading instead of "no results" while fetching.

Done. The list page now tracks a `loading` state that starts `true` and flips to `false` in a `finally` block after the fetch resolves or errors.

- While loading, the table body shows a spinner with "Loading analyses…".
- "No analyses yet." only appears once loading has finished and `rows` is genuinely empty.

---

**User**

make teh home link consistent with the other pages

---

**Cursor**

The other pages put `← Home` on its own line above the title. Let me match that.

Done. The Home link on the analyses list page now matches the other pages: `← Home` on its own line in the upper left, above the page title (instead of "Home" placed beside the title). `Group` is still used by the loading row, so no unused imports.

