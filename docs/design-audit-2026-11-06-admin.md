# Coach admin harmony audit, 6 Nov 2026

Read-only. Alex asked whether all the admin screens "share the same design… is there harmony between them". Every screen in the coach's menu was read in code (header, sections, cards, rows, controls, type and colour, empty states), compared with the others and with docs/DESIGN-RULES-ADMIN.md, and the headers, section titles and cards were measured as the browser draws them at 1440×900. Nothing was changed.

## Verdict
Mostly, yes. 14 of 17 screens share the same header (26px/600, the same place on every page), the same white card (radius 18, a real hairline), the same 36px capsule, the same header pill, ⋯ and state pill, weights 500/600 and one rust. What breaks the harmony is inside the screens: three screens still on the older header system, the same list row drawn three ways, column headings four ways, and a few leftovers from before the redesign on Training and Lifestyle.

## Seen most (high)
- **Plan, Phases and the chat panel use the older header and sections** (`rd-head`, `rd-eyebrow`): a darker, tighter eyebrow and 28px between sections, where every other screen uses `trn-head` and 22px. Phases leaves 46px under Needs you. (draft.css:24, 28; plan.css:69, 89–91; phases.css:140; MessagesDraft.tsx:512)
- **A list row is drawn three ways**, two of them on one screen on Nutrition and Meetings. Full width at 52–53px with a `#eef0f3` line (Home Activity, Feed, Business, Invoices, Lifestyle metrics, Nutrition supplements); inset `rd-row` with `#eceff3` at 42–49px (Nutrition's logs, Meetings' past calls, Plan's Events log, Lifestyle check-ins); Shape update's own 54px grid. (measurements.css:179; draft.css:125, 138; NutritionDraft.tsx:743, 827; MeasurementsDraft.tsx:700; meetings.css:139; pictures.css:99)
- **Column headings in four looks**: most at 10.5px/600/.16em `#5b6474`; Training's at 700/.1em lighter grey; Meetings' 600 but lighter grey; Shape update's 10px `#98a2b3` with a darker line. (draft.css:134; meetings.css:15; pictures.css:97; invoices.css:17)
- **An ended phase on Lifestyle and Nutrition**: a grey "Ended. This phase is here to look back on…" banner at 800 and every control faded to 55%; the rules ask for Training's look-only way, no banner, no fade. (MeasurementsDraft.tsx:402; NutritionDraft.tsx:495; draft.css:191–193)
- **Training's Last session / 30 days cells and set chips**: tinted filled blocks at 700 in `#1b7a4b`, where Home shows the same kind of figure flat in `#2f7a3f`. A flat version already exists behind `?look=hairline`. (draft.css:152–155, 247–250; training-hairline.css:63–66)

## Medium
- Card edges as an inset shadow instead of a real border: Plan's and Phases' timeline cards, Training's week, Muscle map and after-workout cards, Library's tiles (also radius 14), Invoices' fix row. (plan.css:92; trn.css:125, 378; library.css:40–41; invoices.css:7)
- Section titles in several sizes on one screen: Training's Week 20px, Muscle map 15px, Rogue sessions and the after-workout check 14px; Business 15px chart titles beside 20px logs. Two levels are enough: 20px on the page, 15px inside a card.
- The rail: hairlines between its sections, its own row hover `#f5f6f8`, and All | Needs you with unpicked words at 500.
- The page is `#f4f7fc` (bluish) on the admin, `#f5f6f8` in the chat panel beside it; the rule is `#F5F6F8`.
- Lifestyle's Graph draws its latest point as a ring and its hover pill over the line; Home's Weight (the rule) a pulsing dot and the pill in room kept above.
- Shape update builds its own copies: an outline-only header tag, its own log grid, `Show all N` instead of the Pager, 10px small caps, a 32px Send.
- Two dropdown looks: the ⋯ menus (radius 10, items at 600) and the floating lists on Feed, Calendar, Business, Phases and Settings (radius 14, items at 500).
- ‹ Today › two ways: Calendar's 36px white pills; Plan's and Phases' ghost buttons at 32px.
- Three search fields: the rail's 34px pill, Library's 40px box with radius 10, the Feed filter's underline.
- The chat panel: its + opens a menu of ours, the ⌄ sits on a gradient, pins use emoji, the Media button is the client app's, its tabs capsule sets unpicked words at 500.
- Meetings: its own date tile (a 17px/600 numeral, where the rule says light numerals), its own state pill and its own empty word.
- Lifestyle's check-in rows don't fold open; a note opens in a pop-over instead (Nutrition's log and Meetings fold in place).

## Small (low)
- The save status written by hand on Training, Lifestyle and Meetings instead of `SaveStatus`; Plan keeps its own CSS copy.
- Pill heights between 28 and 36px (trn-btn 34, Invoices' Template 32, Shape update's Send 32, the chat's Save 28); Nutrition's row action a 34px ghost button, not the 30px ⋯.
- Rust and red mixed for one meaning on Business (a fall) and Settings (a bad field).
- Faces: 32px in the support inbox, 34px in the chat list, none in Business's Owed; the rule is 24px.
- Settings' switch 34×20 at 0.2s; Training's demo switch 36×20; the rule is one switch at 250ms on the shared curve.
- Words: a full sentence on a full week (Training), "Nothing logged for {name} in this range." (Lifestyle), "Nobody" (Phases), a centred "No messages yet" (chat).
- The Feed's and Phases' Needs you cards: a 4.5% tint and a 55% rust edge over the grey border; the to-do strip they should match is 8% and a full rust edge.

## Biggest wins, in order
1. Plan, Phases and the chat panel onto the same header and 22px sections as the rest.
2. One list row for every log, one column heading for every table.
3. The ended phase as Training's look-only, no banner or fade.
4. Training's trend cells and set chips flat, as the hairline version already draws them.
5. The page colour to `#F5F6F8` everywhere, and real borders on every card.
