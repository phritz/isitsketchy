# Package deprecation signal update
_Exported on 7/1/2026 at 16:02:24 CDT from Cursor (3.9.16)_

---

**User**

lets change the package deprecation signal: only flag it if current version is deprecated, no yellow if an older version is deprecated. update in the code, in @plan/signals.md , and on the /ui/signals page. 

---

**Cursor**

Now I'll make the changes. First the signal computation:

Now the plan doc:

Now the signals page:

Let me check if `anyVersionDeprecated` is now unused anywhere else:

The field is now only produced, never consumed. I'll remove it to keep things clean:

Done. The package deprecation signal now only flags red when the current (latest) version is deprecated, and is green otherwise — the yellow "older version deprecated" case is gone.

Changes made:
- `lib/analysis/signals.ts` — `package_deprecated` dropped the yellow branch; green comment is now "Latest version is not deprecated".
- `lib/npm.ts` — removed the now-unused `anyVersionDeprecated` field (from the `NpmPackument` type and its computation in `fetchPackument`).
- `plan/signals.md` — updated the threshold table row and the "where the data comes from" note.
- `app/ui/signals/page.tsx` — updated the Deprecation row (yellow → "—", green → "latest not deprecated").

One note: `anyVersionDeprecated` was part of the cached npm blob shape. Removing it is safe on read (extra fields in existing cached rows are just ignored, and nothing reads it anymore), so I left `NPM_SCHEMA_VERSION` unchanged. Let me know if you'd prefer a schema bump + cache clear instead.

