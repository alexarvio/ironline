# NorCoach coach admin · design rules

Read this before touching any coach (admin) screen or pop-up. It is the admin half of the design rules; the client app's are in `docs/DESIGN-RULES.md`. If a request or spec conflicts with this file, follow the file and say so. When Alex settles something new, add it here in the same change.

## 1. Voice: facts, no explanations
- No sentences explaining what a feature is or how it works. No hint lines under fields, no footer hints ("Only you see a draft until it is sent."), no "optional" tags, no info banners.
- At most one quiet fact line under a title: `3 weeks · 9/11 – 29/11`, `Bar Tricep Pushdown · Upper — push`.
- A real problem is a short fact plus its fix button: `Overlaps Health, 19 Oct – 15 Nov.` [Start Mon 16 Nov].
- Buttons say the action, one word when it can: Save, Delete, Remove, Add, Copy, Schedule it. Not "Save new dates", not "Add as copy of Week 1".
- Empty states are one or two words: `None yet`, `No gyms yet`.
- Say a thing once (20 Oct): the week rail dates every week, so the week's own line doesn't (`0 of 5 sessions done`, no date).
- Don't offer an action that would change nothing (20 Oct): no "Copy week 3 here" when the weeks already match, no copy from an empty week, no "Copy to weeks 5–6" when they're the same.

## 2. Tokens
- Page `#F5F6F8` · surface `#fff` · ink `#141a24` · body `#3a4250` · secondary `#5b6474` · muted `#8b93a1` · faint `#98A2B3`.
- Hairline `#E1E5EB` · button hairline `#DCE1E8` · divider `#EEF0F3`.
- Success green `#2f7a3f` · danger red `#b42318`.
- Archivo, weights 500 and 600 only. Small caps labels: 10.5px, 600, letter-spacing .16em, uppercase, `#5b6474`.
- **Never navy** (`#1d3466`, `#1e3a6e`, `#2f5d8f`) for an action, a selection or a toggle. Actions and selections are ink `#141a24`.

## 3. Track and state colours (one source: `app/admin/phaseChrome.ts`)
- Track accents, `TRACK_ACCENT`: training purple `#3a3390`, nutrition teal `#1d7a70`, lifestyle beige `#a08a5c` (tint `#efede6`).
- How a track colour appears: a tinted tag (background `rgba(accent, .12)`, text and icon in the accent), a tile's icon, the new value in a change, a calendar range (band `rgba(accent, .10)`, first and last day solid). Never a big filled block.
- **A state tag is always colour-coded** (20 Oct, Alex), wherever a phase's or programme's state shows: the Training header, the programme switcher, the Plan and Phases views, every pop-up. **Live green** `#2f7a3f` on `rgba(47,122,63,.12)`, on every track (never the track's own colour); **Scheduled blue** `#1e3a6e` on `#e6ecf3`; **Draft peach** `#b3471d` on `#fbe9e0`; **Past grey** `#5b6474` on `#EEF0F3`. One source: `STATE_TAG` / `stateTagStyle()` in `phaseChrome.ts`. The same when the tag is a menu. Never a black-and-white capsule. (The Scheduled blue is a state, so the no-navy rule in §2 doesn't apply to it.)
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
- Two or three short options: a capsule (36px, hairline `#DCE1E8`, 4px of air between the chosen one and the edge), the chosen one ink with white text. KG/LBS, the time window, the phase switcher's Live/Scheduled/Draft/Past.
- The one exception (20 Oct, Alex): the client tabs (Home, Plan, Training…) are a grey track with the tab on screen a white pill, its words in ink (never blue).
- A choice that is the action itself is a menu, not a capsule and a button (20 Oct, Alex): + Week opens Blank / Copy Week 6 / Copy Week 3, and a pick adds the week.
- Picking a category, track or type with icons: tiles across the whole row, equal widths, white with a hairline, the icon in its colour, the chosen tile filled ink. Event categories and the phase Track picker.
- A status that has actions (a Draft or Scheduled programme) is itself the menu: click the tag for Schedule it / Make it live / Back to draft. No separate navy buttons for them.
- Date boxes (Starts / Ends): rounded boxes, radius 12, hairline, ringed in ink while armed. Not capsules.

## 6. Dropdowns and search
- A list floats over the page (`Popover` / absolute). It never pushes the page down or stretches a card.
- Six rows, then it scrolls inside. A Create / Use row stays pinned at its foot, outside the scroll.
- The list is as wide as its field, and a search field is only as wide as its list (560px max), not the whole row.
- Never the browser's own `<datalist>` or `<select>` list. Use `Picker` or the floating list; a plain `+ Add` that opens a menu when the choices are fixed.

## 7. Dates
- A date in words is day/month numerals (20 Oct, Alex): `Scheduled · starts 9/11`, `5/10 – 2/11`, `Start 16/11`. Never `9 Nov` or `Mon 9 Nov` in a pill, a fact line, a note, a button or a toast; the year only when it isn't this one (`9/11/2027`). Grids keep their month names: the timeline's axis (`9 Nov` under `NOV`), the week rail, calendars. One helper writes them, server and screen alike: `dayMonth` (`app/lib/dayMonth.ts`); no local copies.
- Every date field, everywhere (20 Oct, Alex): typed or picked, always both. `DateText`: digits only, slashes fill in (0811 → 08/11/), dd/mm/yyyy, a pasted 2026-11-08 is turned round. A single date is `DatePick` (the typed field with the calendar on its icon); a range is two `DateText` boxes beside `MonthRange`. Never `<input type="date">`, never a calendar-only picker, never a date shown as words where it can be set.
- The format lives in `DateText` alone, so a coach setting (dd/mm/yyyy or yyyy-mm-dd, to come) switches every field at once. Don't format a typed date anywhere else.
- Phase dates: no earlier than a year back (`min`). Training phases run Monday to Sunday; the dates snap, and no sentence explains it.

## 8. Lists, rows and tables
- Training sessions: separate white cards (radius 18, hairline, 8px apart), no numbers, the whole row opens it, ⋯ shows on hover only.
- Row actions in general show on hover only.
- Table heads: white, small caps, no line between a row's head and its column heads, hairlines between rows.
- Status pills: hairline capsules. Completed green, In progress ink, Not started grey, and Not started only on the current week and past weeks, never on weeks still to come.
- A summary lives in the column head (`ENJOYMENT  AVG 8`), never as a fake row of data.
- A change from → to: two columns, the old value struck through in grey, the new one in the track's accent. No arrows.
- NOW on the week rail: the word in black with a green pulse on its left. No pill.
- NOW on a timeline (Plan, Events): an ink line with a black dot on top that pulses (20 Oct, Alex).
- The tracks always run Lifestyle, Training, Nutrition (20 Oct, Alex): the Plan's lanes, the track tiles, the client tabs.
- Use the width (20 Oct, Alex): a section with little in it is one row: its title, its items and add on the left, its summary and fold on the right (the After-workout check). Never a title line, a pill line and a fold line stacked in a wide card.
- A log (the Events log, 20 Oct, Alex): one line a row; a note goes in its own column to the right, never under the title. What is on or coming first, newest first; what is over last, the latest ended first.
- Pills down a column (a category, a kind) are all one width, the word centred, whatever its length.
- Two dates in a row (`14/10 → 5/11`) get air: a faint grey arrow with room either side.
- A bar on a timeline is outlined in the colour it is now (its track or kind at half strength); a draft's outline is dashed.

## 9. Saving
- The Training tab autosaves: one status on the week's line (`✓ All changes saved` / `Saving…` / `Not saved · Retry`), none per session. Other tabs still use the pending bar; ask Alex before switching another tab to autosave.
- Nothing on the client's screen changes before the coach (or client) confirms: a sheet with Done applies on Done.

## 10. Timeline (Plan)
- Phase bars: the grab handles at both ends show while the pointer is on the bar, darker on the end itself.
- ‹ › step back into the past a month at a time; Today comes back.
- A phase with nothing in it yet (no sessions, no targets, no metrics asked) wears a small rust warning sign before its state pill; hovering it says what is missing (20 Oct, Alex). Not on a past phase.
- An empty week on a lane is a way in: a + on hover, a click opens New phase on that track from that week.

## 11. Before you build
- Search for an existing pattern first: `.dlh`, `.npd`, `ConfirmDialog`, `Picker`, `DateText`, `dayMonth`, the floating add-row list (`rd-addpop`), `trn-btn`, `trn-state`, `stateChip`, `TRACK_ACCENT`.
- Don't add a CSS file for a pop-up that fits `.dlh`. Don't hardcode a track colour; take it from `phaseChrome.ts`.
- Check the result against this file before saying it's done.
