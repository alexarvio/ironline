# NorCoach client app · design rules

Read this before touching any client screen. One hero language, one everyday language, nothing else. (The coach admin has its own: `docs/DESIGN-RULES-ADMIN.md`.)

## 1. Two languages, no third
- **Hero**: the phase cards on Home only. Full-bleed photo, dark glass panel, white type. Nothing else may look like this.
- **Hairline**: everything else. Thin 1px lines, rings and icons alone, light type, the page colour behind. No white cards with borders and drop shadows, no gradient fills, no tiles around icons.

**Where hairline belongs (16 Oct, Alex):** screens you read and scroll: lists, feeds, timelines (Home, Events, Meetings, Notifications, the session overview under its photo header, and the workout screen: sets on one spine, the open set as big light numerals with a thin underline instead of a box; the Training tab, shape updates, settings, the check-in screen, the food diary, Nutrition, invoices and, lightly, chat too). Pop-ups and sheets where you enter things (the check-in, measurements, Add an event, Request a meeting, the gym picker) keep their fields and boxes; don't flatten them. Since 17 Oct they speak the shared voice: a plain white sheet (no wash or glow), titles at 600, small grey uppercase labels, fields and tiles white with a hairline (ink while typing), the chosen choice ink, the thing's colour only on its icon, ring or edge, one ink pill to save.

**The one exception (16 Oct, by choice):** the Training tab's week card and its session cards keep their card shape (the done tint does real work on a to-do list). They speak the shared tokens: 500/600 type, the palette indigo and green, tints at 8–12%, a white hairline chip for Up next. Do not restyle them to hairline rows; that was tried and reverted.

## 2. Page and lines
- Page `#F5F5F5` on Home, `#F5F6F8` on the pushed screens (Events, Workout, Notifications). One per screen, never two tones on one screen.
- Hairline `#E1E5EB`. Separate rows and sections with **space alone** (17 Oct, Alex): no lines between list rows, no lines over sections or above buttons. The only line on a screen is a timeline's spine (Events, the Home events row), and a note's own underline where nothing sits right under it.
- White `#fff` only for a pill or a button, and it gets `inset 0 0 0 1px #E1E5EB`, never a shadow.

## 3. Type (Archivo)
- Weights **500** and **600** only. Date numerals may be **300**. Never 700 or above on a client screen.
- Eyebrow / label: 10–11px, 600, letter-spacing .16–.18em, uppercase, `#5b6474` or the item's colour.
- Title: 15–17px, 500; the focused or live one 17–18px, 600. One line with an ellipsis, and a chevron when it is cut.
- Secondary: 12px, 500, `#8b93a1`. Tabular numerals for dates, counts and times.
- Ink `#141a24`, body `#3a4250`, faint `#8b93a1`, label grey `#98A2B3`.

## 4. Colour
- One colour per category, everywhere (see `app/lib/eventTypes.ts`, `notificationTypes.ts`, `phases/timeline.ts`):
  training indigo `#3a3390` · nutrition teal `#1d7a70` · lifestyle beige `#a08a5c` (tint `#efede6`; 21 Oct: one beige everywhere, not amber or grey) · trip `#2f5d8f` · supplement `#1f7a4d` · health `#b8471f` · work `#5b6472` · shape update rust `#b8471f` · meeting blue `#2f6fd6`.
- A colour appears as a thin ring, an icon, a label or a 2px line. Never as a filled block behind text.
- Tints: `rgba(rgb, .12)` at most. Past things go grey (`grayscale(1)`) and fade to 30–45%; future things keep their colour at ~55%; the live or focused one is at 100%.

## 5. Icons
- The existing category icons, drawn at **stroke 1.6**, round caps and joins, no fills.
- The icon alone. A ring around it only when the item is live or in focus; a live ring pulses in its colour. No tile, no disc, no halo.

## 6. Buttons and controls
- Primary: ink pill `#141a24`, white text, height 38–44, 600. One per screen at most.
- Secondary: white pill with the hairline inset, ink text.
- Text action: 12–13px, 600, ink or `#5b6474`, no underline.
- Facts in a row are parted by a short drawn upright bar, never a middle dot (21 Oct, Alex: the workout's targets, `15 min | 6 km/h | 8%`), as the coach admin does.
- The workout's finish list (21 Oct, Alex): a weighted exercise with sets logged shows `kg  lbs` before its Done, the words alone as Done is (no pill), the one on in ink, the other grey; a tap switches the exercise's logged sets and it opens in that unit next time. A cardio marked done just says `Done` in green (a tap still takes it back), no "tap to undo".
- A pill that opens a list (Saved days, Supplements; 17 Oct): closed, the white hairline pill; open, the pill stays as the header and the list drops out under it flat on the page, tied to the pill's icon by a thin line down the left that runs behind the rows. No white box round the list.
- Segments and chips: white with the hairline, the active one ink with white text.
- Anything on/off (17 Oct, Alex): white while off, ink while on. The rest timer, KG/LBS, filter chips, Settings switches, the current tab in the nav. An action like Demo is not a toggle: it stays a white secondary pill.
- Inside a row, an action is its words alone (Fill in, Edit, Use, View), no pill.
- A note the client writes (17 Oct, Alex), in a pop-up or on a page: no box, the words on a hairline underline (`#C9CFD8`, ink while typing), 16px at 500. Cancel is a text action, Save or Send a small ink pill. Short fields like numbers, names and search keep their white hairline box. Exception: in a pop-up where Save sits right under the note (check-in, add event), no underline at all; it read as a bar between them.
- Exceptions by choice: the indigo Live chip and the navy-tinted Up next chip on Training.
- No navy fills, no gradients, no shadows under buttons.

## 7. Motion
- 200–250ms ease for size and colour. Scroll-driven focus follows the finger live.
- Snap to one spot; the item in the spot grows (ring ×1.25–1.3, title to 17–18px) and nothing else moves. Rows keep a fixed height so content below never jumps.
- Only live things pulse. Respect `prefers-reduced-motion`.

## 8. Layout
- Section eyebrow at 28px in from the screen edge, content 16px in, rows may bleed edge to edge.
- Sections vs. items (16 Oct): a section label (Events, Latest from, Meetings) is ink `#141a24` at 11.5px and sits under a hairline 16px in from the screen edge, with room above. Labels inside a section stay grey, and lines inside a section are inset (40px), so they read as a level below.
- Dates in a left column as light numerals, one date per day, the live one dated today.
- No position dots (except under the Home phase cards, brought back 16 Oct by Alex), no "See all" when a tap on the item already leads there, no explanation sentences.

## 9. Before editing
- Check this file. If a spec you were given conflicts with it, follow this file and say so.
- Reuse an existing pattern (events row, Events screen, progress pill, workout header) before inventing one.
- A list over time is the Events-screen itinerary (`evp-` classes): white pill on top to add or ask, one spine, light date numerals, a snap spot that grows its row, the past greyed under a PAST label. A row opens only when it has more; then it gets a chevron.
  - Events: a Today row always, even when nothing (shown) is on: an empty ink ring with no icon, "Nothing on today" (or "No trips today" under a filter).
  - Notifications: flat rows with a hairline between them (inset to the text), the ink dot and a 600 title for unread, 500 once read. Text cut at two lines gets a chevron by the title that eases it open in place; the row itself still opens the thing.
  - Meetings: calls are few, so no Today row. The next call is a fixed white pill under the ask ("No upcoming meetings" when none), more booked behind "+1 more"; only the past scrolls, with its snap spot near the top.
