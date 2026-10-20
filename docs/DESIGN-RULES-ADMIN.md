# NorCoach coach admin · design rules

Read this before touching any coach (admin) screen or pop-up. It is the admin half of the design rules; the client app's are in `docs/DESIGN-RULES.md`. If a request or spec conflicts with this file, follow the file and say so. When Alex settles something new, add it here in the same change.

## 1. Voice: facts, no explanations
- No sentences explaining what a feature is or how it works. No hint lines under fields, no footer hints ("Only you see a draft until it is sent."), no "optional" tags, no info banners.
- At most one quiet fact line under a title: `3 weeks · 9 Nov – 29 Nov`, `Bar Tricep Pushdown · Upper — push`.
- A real problem is a short fact plus its fix button: `Overlaps Health, 19 Oct – 15 Nov.` [Start Mon 16 Nov].
- Buttons say the action, one word when it can: Save, Delete, Remove, Add, Copy, Schedule it. Not "Save new dates", not "Add as copy of Week 1".
- Empty states are one or two words: `None yet`, `No gyms yet`.

## 2. Tokens
- Page `#F5F6F8` · surface `#fff` · ink `#141a24` · body `#3a4250` · secondary `#5b6474` · muted `#8b93a1` · faint `#98A2B3`.
- Hairline `#E1E5EB` · button hairline `#DCE1E8` · divider `#EEF0F3`.
- Success green `#2f7a3f` · danger red `#b42318`.
- Archivo, weights 500 and 600 only. Small caps labels: 10.5px, 600, letter-spacing .16em, uppercase, `#5b6474`.
- **Never navy** (`#1d3466`, `#1e3a6e`, `#2f5d8f`) for an action, a selection or a toggle. Actions and selections are ink `#141a24`.

## 3. Track and state colours (one source: `app/admin/phaseChrome.ts`)
- Track accents, `TRACK_ACCENT`: training purple `#3a3390`, nutrition teal `#1d7a70`, lifestyle beige `#a08a5c` (tint `#efede6`).
- How a track colour appears: a tinted tag (background `rgba(accent, .12)`, text and icon in the accent), a tile's icon, the new value in a change, a calendar range (band `rgba(accent, .10)`, first and last day solid). Never a big filled block.
- States, via `stateChip()` in `plan/PlanDraft.tsx`: **Live is green** `#2f7a3f` on `rgba(47,122,63,.12)` on every track (never the track's own colour); Scheduled and Draft (peach) keep their `phaseChrome`; Past is grey.
- A phase's pop-ups show both tags under the title: `[icon Training] [LIVE]`.
- Lifestyle is one beige everywhere, admin and client (21 Oct): `#a08a5c` for marks and text, `#efede6` behind. Never amber, orange or grey for lifestyle. (The Lifestyle tab's metric groups have their own colours in `app/lib/categoryColors.ts`; those are groups of metrics, not the track.)

## 4. Pop-ups: one pattern
- Use the `.dlh` card (`training/trn.css`) or, for pop-ups with a calendar, `.npd` (`plan/phase-dialog.css`). Use the existing components before writing a new one: `ConfirmDialog`, `RemoveDialog`, `DeletePhaseDialog`, `DeleteSessionDialog` (training), `MoveDialog`, `PhaseDialog`, `ScheduleDialog`.
- Card: white, radius 20, padding 20/20/16, shadow `0 30px 60px -24px rgba(16,24,40,.35)` plus a 1px `#E1E5EB` ring, no border. No gradients, glows, washes, big header icons, coloured header bands or chips in navy/indigo fills.
- Head: title 18px/600 and a round ghost ✕ (28px, `#8b93a1`). Tags or one fact line under it.
- Footer: right-aligned, no line above it. Cancel is a text button (`#5b6474`). The action is a black pill (36px, radius 999). A destructive action is red words, no pill. Delete of an existing thing sits on the left.
- Destructive confirms: `Delete X?` + `This permanently deletes the phase. It can't be undone.` (or the equivalent) + red Delete. When the client's data would go (logged sets, trained sessions), add a tick that must be checked first. Removing a row asks first; nothing destructive happens on one click.
- Text inputs are a clean line: no box, `border-bottom: 1px #E1E5EB`, ink on focus, 15px/500.
- A note that saves (Note to client, the goals/note pop-over): no line until something is typed; then the line appears as a separator and Cancel / Save show.
- Phase goals: three bullet lines (a dot and a clean line each), folded behind a chevron row with the count. Never a textarea.

## 5. Choices and toggles
- Two or three short options: a capsule (36px, hairline `#DCE1E8`), the chosen one ink with white text. KG/LBS, Blank/Copy week, Live/Scheduled/Draft/Past.
- Picking a category, track or type with icons: tiles across the whole row, equal widths, white with a hairline, the icon in its colour, the chosen tile filled ink. Event categories and the phase Track picker.
- A status that has actions (a Draft or Scheduled programme) is itself the menu: click the tag for Schedule it / Make it live / Back to draft. No separate navy buttons for them.
- Date boxes (Starts / Ends): rounded boxes, radius 12, hairline, ringed in ink while armed. Not capsules.

## 6. Dropdowns and search
- A list floats over the page (`Popover` / absolute). It never pushes the page down or stretches a card.
- Six rows, then it scrolls inside. A Create / Use row stays pinned at its foot, outside the scroll.
- The list is as wide as its field, and a search field is only as wide as its list (560px max), not the whole row.
- Never the browser's own `<datalist>` or `<select>` list. Use `Picker` or the floating list; a plain `+ Add` that opens a menu when the choices are fixed.

## 7. Dates
- Typed or picked, always both. `DateText`: digits only, slashes fill in (0811 → 08/11/), dd/mm/yyyy, a pasted 2026-11-08 is turned round.
- Phase dates: no earlier than a year back (`min`). Training phases run Monday to Sunday; the dates snap, and no sentence explains it.

## 8. Lists, rows and tables
- Training sessions: separate white cards (radius 18, hairline, 8px apart), no numbers, the whole row opens it, ⋯ shows on hover only.
- Row actions in general show on hover only.
- Table heads: white, small caps, no line between a row's head and its column heads, hairlines between rows.
- Status pills: hairline capsules. Completed green, In progress ink, Not started grey, and Not started only on the current week and past weeks, never on weeks still to come.
- A summary lives in the column head (`ENJOYMENT  AVG 8`), never as a fake row of data.
- A change from → to: two columns, the old value struck through in grey, the new one in the track's accent. No arrows.
- NOW on the week rail: the word in black with a green pulse on its left. No pill.

## 9. Saving
- The Training tab autosaves: one status on the week's line (`✓ All changes saved` / `Saving…` / `Not saved · Retry`), none per session. Other tabs still use the pending bar; ask Alex before switching another tab to autosave.
- Nothing on the client's screen changes before the coach (or client) confirms: a sheet with Done applies on Done.

## 10. Timeline (Plan)
- Phase bars: the grab handles at both ends show while the pointer is on the bar, darker on the end itself.
- ‹ › step back into the past a month at a time; Today comes back.

## 11. Before you build
- Search for an existing pattern first: `.dlh`, `.npd`, `ConfirmDialog`, `Picker`, `DateText`, the floating add-row list (`rd-addpop`), `trn-btn`, `trn-state`, `stateChip`, `TRACK_ACCENT`.
- Don't add a CSS file for a pop-up that fits `.dlh`. Don't hardcode a track colour; take it from `phaseChrome.ts`.
- Check the result against this file before saying it's done.
