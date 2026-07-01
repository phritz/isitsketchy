# Homepage update for Is It Sketchy
_Exported on 7/1/2026 at 16:02:01 CDT from Cursor (3.9.16)_

---

**User**

update homepage:
- say a sentence about what Is It Sketchy? is: shows trustworthiness signals for a github repo or npm package
- currently only works for direct dependencies
- instead of "Get" have buttons say "analyze"
- have two buttons above the github box that say "Analyze Anthropic SDK repo" that analyzes https://github.com/anthropics/anthropic-sdk-typescript  and another that says "Analyze 'Is it sketchy' repo" that analyzes https://github.com/phritz/isitsketchy 
- separate the github and npm sections
- have a button above npm box that says "Analyze Anthropic SDK package"
- use a question mark icon for the favicon 

---

**Cursor**

Let me look at the current homepage and related files.

I need to look at the search components referenced by the homepage.

Now let me look at the layout for favicon setup and check for existing icons.

Now I have a full picture. Let me make the changes. First, the GitHub search component with the "Analyze" button and quick-analyze preset buttons.

Now the homepage with the description, direct-dependencies note, and separated GitHub/npm sections.

I used `Group` but didn't import it. Let me fix the import.

Now the favicon. Let me create a question-mark SVG icon and remove the existing binary favicon so the SVG takes precedence.

All changes are done. Here's a summary of what I updated:

**`app/ui/page.tsx`** (homepage)
- Added a one-liner describing the product: "Is It Sketchy? shows trustworthiness signals for a GitHub repo or npm package."
- Added a dimmed note: "Currently only works for direct dependencies."
- Split into two clearly separated sections ("GitHub repo" and "npm package") with a `Divider` between them, each keeping its cache-management link.

**`app/home-search.tsx`** (GitHub)
- Renamed the "Get" button to "Analyze".
- Added two quick-analyze buttons above the input:
  - "Analyze Anthropic SDK repo" → `https://github.com/anthropics/anthropic-sdk-typescript`
  - "Analyze 'Is it sketchy' repo" → `https://github.com/phritz/isitsketchy`
- Refactored the search into a single `analyze(target)` function so presets and the text input share the same logic (and the input fills in with the analyzed URL).

**`app/home-npm-search.tsx`** (npm)
- Renamed "Get" to "Analyze".
- Added an "Analyze Anthropic SDK package" button above the input targeting `@anthropic-ai/sdk`.

**Favicon**
- Added `app/icon.svg` — a blue rounded square with a white "?" — which Next.js serves as the favicon.
- Removed the old `app/favicon.ico` so the question-mark SVG is used.

One choice worth flagging: I set the Anthropic SDK npm package name to `@anthropic-ai/sdk` (the actual published package for that repo). Let me know if you intended a different package.

---

**User**

add back links from all our subpages to main page and include this in the agents file

---

**Cursor**

Let me find all the UI subpages to see which need back links.

Both subpages already have a "Home" link, but they point to `/` while the main page is at `/ui`. Let me check the root route.

Both subpages already link "Home" to `/`, which redirects to the real main page at `/ui`. I'll standardize them to point directly at `/ui` and document the convention. Let me read AGENTS.md.

Now let me update both subpages to link directly to `/ui`, and add the convention to AGENTS.md.

Done. Both subpages already had a "Home" link, but they pointed at `/` (which redirects to the real main page at `/ui`), so I standardized them:

- **`app/ui/sources/github/page.tsx`** and **`app/ui/sources/npm/page.tsx`**: the header "Home" link now points directly to `/ui`, avoiding the redirect hop.
- **`AGENTS.md`**: added to the Architecture section that `/ui` is the main page and that every `/ui/*` subpage must include a back link to it (`<Anchor href="/ui">Home</Anchor>`), conventionally in the page header — so future subpages follow the same pattern.

---

**User**

change labels on search boxes to be "Analyze a GitHub Repo by URL" and on package box to be "Analyze an npm package by name"

---

**Cursor**

Updating the two input labels.

Done. The GitHub input label is now "Analyze a GitHub Repo by URL" and the npm input label is "Analyze an npm package by name".

---

**User**

put cache management links down at the bottom in a debug section. make it subtle

---

**Cursor**

Done. I removed the cache management links from the section headers and moved them into a subtle "Debug" section at the bottom of the page — separated by a divider, with a small uppercase dimmed "Debug" label and both links styled as extra-small, dimmed anchors.

---

**User**

add note that package and github results are cached and they can clear cache with debug section below

---

**Cursor**

Added a note under the intro text explaining that GitHub and npm results are cached and can be cleared from the debug section below.

---

**User**

 backlinks should go in upper left

---

**Cursor**

Both files still use `Group` elsewhere, so imports are fine. Let me verify.

Done. On both subpages, the back link now sits in the upper left as "← Home" above the page title, instead of being right-aligned next to it.

I should also update the AGENTS.md convention I added earlier so it reflects the upper-left placement.

Also updated the AGENTS.md convention to specify the back link goes in the upper left above the page title.

---

**User**

combine the home page caveats into one paragraph and say if you want to fetch fresh data, clear the cache with links below. also say that it evaluates trustworthiness based on repo and package metadata

---

**Cursor**

Combined the caveats into a single paragraph that now also states it evaluates trustworthiness based on repo and package metadata, and that you can clear the cache with the links below to fetch fresh data.

---

**User**

put "It currently only works..." section in separate paragaph

---

**Cursor**

The file was edited since I last saw it. Let me read the current version.

Split it into two paragraphs — the "It currently only works..." caveat is now its own `Text` block below the intro sentence.

---

**User**

add a link at bottom of page to the is it sketch repo

---

**Cursor**

Added a subtle link at the very bottom of the page to the [Is It Sketchy? repo](https://github.com/phritz/isitsketchy), opening in a new tab.

---

**User**

make sure Is It Sketchy? is capitalized like that

---

**Cursor**

Let me find all references to the app name to normalize capitalization.

The button label in `app/home-search.tsx` uses "Is it sketchy". Let me fix its capitalization.

The only miscapitalized user-facing instance was the GitHub quick-analyze button — it now reads "Analyze 'Is It Sketchy?' repo". All other UI references (`app/ui/page.tsx`, `app/layout.tsx` title/description) already use "Is It Sketchy?" correctly.

Note: `plan/project.md` has "# Is It Sketchy" (a heading, no question mark) — I left it since it's an internal planning doc, not user-facing. Let me know if you want that normalized too.

---

**User**

"npm package" -> "Analyze an npm package" in section title

---

**Cursor**

Done. The npm section title now reads "Analyze an npm package".

For consistency, do you want the GitHub section title changed from "GitHub repo" to "Analyze a GitHub repo" as well?

---

**User**

pressing a button should only cause that button to spin, not all of them

---

**Cursor**

The component now navigates on analyze. I'll track which specific button is pending. Let me check the npm search too.

Now I'll track a per-button pending identifier in both components. Starting with the GitHub search.

Now the npm search component.

Done. Both search components now track which specific button was pressed (via a `pending` identifier) instead of a shared boolean:

- Only the clicked button shows the spinner.
- The other buttons are disabled while one action is in flight, preventing concurrent/double submissions.

This applies to all three GitHub buttons (Anthropic repo, Is It Sketchy? repo, and the URL input's Analyze) and both npm buttons (Anthropic package and the name input's Analyze).

---

**User**

move the link to the sketchy repo on home page to same line as cache management

---

**Cursor**

Moved the "Is It Sketchy? on GitHub" link into the same `Group` row as the cache management links, so all three now sit on one line in the debug section.

---

**User**

"GitHub repo URL" -> "Analyze a GitHub repo by URL"

---

**Cursor**

Done. The GitHub input label is now "Analyze a GitHub repo by URL".

