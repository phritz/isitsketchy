# Risk column width adjustment
_Exported on 7/1/2026 at 16:02:32 CDT from Cursor (3.9.16)_

---

**User**

the red/green etc bubble in the risk column of /ui/analysis/$id is clipped, make that column wider by a bit

---

**Cursor**

The risk column is in the `FullResults` table. I'll widen the "Risk" column header and prevent the badge cell from wrapping.

Done. I made two small changes to the full-results table in `app/ui/analysis/[id]/page.tsx`:

- Set the "Risk" column header to a fixed width of `90` so it has more room.
- Added `whiteSpace: "nowrap"` to the risk cell so the colored badge/bubble isn't clipped or wrapped.

