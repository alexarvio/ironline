# Ironline UI guidelines

Rules for how the app looks, so new screens match the old ones without discussion. Written from what the code already does in `app/globals.css`; where the code disagrees with itself, this doc picks one and marks the other **to retire**.

Status: **draft for agreement**. Sections marked ⚖ need a decision.

---

## 1 · Typefaces

Two faces, loaded from Google Fonts at the top of `globals.css`.

| Role | Face | Weights loaded | Where |
|---|---|---|---|
| Everything | **Manrope** | 400 500 600 700 800 | body, tables, buttons, pills, inputs, eyebrows |
| Display only | **Newsreader** (serif) | 500 600 700 | the client's name on Home, a few big headings |

Rules

- Manrope is the default. If you have not got a reason, it is Manrope.
- Newsreader is for one line per screen at most, at 22 px or larger, and never in a table, button, pill or input.
- Fallbacks stay as declared: `ui-sans-serif, system-ui, -apple-system, "Segoe UI"` for Manrope, `Georgia, serif` for Newsreader.
- Numbers that sit in columns (kcal, kg, sets, dates) get `font-variant-numeric: tabular-nums` so they line up.

## 2 · Type scale

Nine sizes. Do not invent a tenth; pick the nearest.

| Token | Size | Weight | Use |
|---|---|---|---|
| Display | 40 px | 800, letter-spacing −0.02 em | one hero figure per card (the kcal number, a weight) |
| Title | 22 px | 800 | dialog titles, the client's name |
| Heading | 16–17 px | 800 | summary line in a navy band, section titles |
| Body strong | 13.5 px | 800 | the primary cell in a row (goal text, exercise name, supplement name) |
| Body | 13 px | 500–600 | ordinary text, notes, inputs |
| Small | 12–12.5 px | 500–700 | secondary cell text, footers, hints beside a control |
| Label | 11 px | 800, +0.06 em, uppercase | table headers, pills, meta lines |
| Eyebrow | 10–11 px | 800, +0.12–0.14 em, uppercase | the word above a heading (PHASES, DAILY TARGETS) |
| Micro | 9.5–10 px | 800, uppercase | weekday letters under a bar, badges inside a bar |

Weights: **800** for anything that names or measures, **700** for pills and buttons, **500–600** for reading text. 400 is only for long paragraphs the client reads.

⚖ *The code currently uses 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5 px all at once. Proposal: collapse the halves (10.5 → 10 or 11, 11.5 → 11 or 12) when a file is next touched. No big sweep.*

## 3 · Colour

### Core

| Name | Hex | Use |
|---|---|---|
| Ink | `#141a24` | headings and primary cell text |
| Text | `#313851` | body text |
| Muted | `#5b6474` | labels, secondary cells, table headers (4.9:1 on white, do not lighten) |
| Faint | `#8b93a1` | placeholders, hints, footers, dashes, the × on a row |
| Disabled | `#a0a7b3` | missed-day rows, "not logged", inactive icons |
| Hairline | `#eceff3` | row dividers, cell borders inside a card |
| Border | `#dfe3e8` | card outline, input outline on hover/focus |
| Surface | `#ffffff` | cards, inputs |
| Head fill | `#fafbfc` | table header and footer strips |
| Page | `#f8f9fb` | app background |
| Raised | `#edf0f4` | left rail, right panel |

### Brand

| Name | Hex | Use |
|---|---|---|
| Navy | `#1e3a6e` | card header bands, primary buttons on white, the Now marker |
| Accent | `#2f5d8f` | links, focus rings, protein bar, selected states on light fills |
| Accent tint | `#e6ecf3` | selected row, icon circles, cadence pills |

White on Navy is 10.7:1. White on Accent is 6.2:1. Both pass.

### Status

Three meanings, three colours, always the same three.

| Meaning | Text / fill | Tint (behind text) | Examples |
|---|---|---|---|
| Good / on target / done | `#2f7a3f` | `#dff3ea` (text `#0f5c46`) | within ±150 kcal, goal reached, week trained, Metric pill |
| Warning / off target / slipped | `#b3471d` | `#fbe9e0` | over/under target, goal slipped, unsaved changes |
| Destructive | `#a32d2d` | `#fbeaea` | delete hover, cancelled meeting |

Rule: a colour carries a meaning. Green never decorates; orange never means "training day". If a thing has no status it is grey.

### Category pills

Pills that classify rather than judge use tints, not status colours.

| Category | Tint | Text |
|---|---|---|
| Training day / Exercise / Post-workout | `#e6e4fa` | `#3a3390` |
| Progress pictures identity, off the training tint (Home upload card, open sheet on the Progress pictures screen; nowhere else in the client app) | `#f1f0fc`, border `#d9d6f5`, rule `#e6e3f7` | `#211d5e`; eyebrow `#6b64ab`; button / filled bar `#3a3390`; uploading `#8b84d6`; missing `#ddd9f4` |
| Rest day / neutral / Before bed | `#eef0f3` | `#5b6474` |
| With breakfast / draft programme | `#fff3dc` | `#8a5a12` |
| Metric / nutrition track | `#dff3ea` | `#0f5c46` |
| Habit / lifestyle track | `#efede6` | `#4a4a45` |

Macro bars: protein `#2f5d8f`, carbs `#3f6e46`, fat `#9a5a33`. These are chart colours only.

### To retire ⚖

The stylesheet has near-duplicates from two design passes. New code uses the left column; the right column goes when a file is next touched.

| Keep | Retire |
|---|---|
| Muted `#5b6474` | `#5b6472` |
| Faint `#8b93a1` | `#8b93a0` |
| Border `#dfe3e8` | `#c2cbd3`, `#c3c9d2` |
| Good `#2f7a3f` | `#3f6e46` (except as the carbs bar), `#1f7a4d` |
| Warning `#b3471d` | `#9a5a33` (except as the fat bar), `#b8471f` |
| Destructive `#a32d2d` | `#9b2c2c`, `#a13a3a` |

## 4 · Cards and bands

The pattern every admin tab now follows (Plan, Meetings, Nutrition):

- Card: white, 1 px Border, radius **12 px**, cards stacked with 18 px between.
- Header band: Navy, padding 14 px 22 px, white text. Left: Eyebrow, then optionally one Heading line where the tail after the first clause is 600 weight at 75 % opacity. Right: a pill switch and at most one white primary button.
- Table inside a card: header strip on Head fill with Label text; rows 9–10 px 22 px with a Hairline under each; footer strip on Head fill with Small Faint text.
- Content padding inside a card body: **22 px** sides, 16–18 px top.

## 5 · Radii

| Radius | Use |
|---|---|
| 999 px | pills, switches, share bars, progress tracks |
| 12 px | cards, dialogs |
| 10 px | inner cells (macro cell, textarea) |
| 8 px | inputs, small buttons |
| 6 px | inline-editable cell outline, chips inside tables |
| 4 px 4 px 0 0 | chart bars |

Nothing else. 5 px, 7 px and 99 px exist in the code and should become 6, 8 and 999.

## 6 · Controls

- **Primary button**: white on Navy inside a band; Navy on white elsewhere. One per card.
- **Secondary button**: white, 1 px Border, Text colour.
- **Pill switch**: Raised track, white active segment, 12 px 800.
- **Inline-editable cell**: transparent border at rest, Border on hover and focus, white fill on focus. No save button; saves on blur.
- **Pending bar** (blue strip with Discard / Apply): the only way batched edits land. Do not add per-row save buttons next to it.
- **Confirm dialog**: needed before anything that moves dates, deletes, or changes what the client sees while a phase is live.

## 7 · Spacing

An 2 px grid with these stops: 4, 6, 8, 10, 12, 14, 16, 18, 22. Gaps between controls in a row: 10 px. Between label and value: 4–6 px.

## 8 · Client app

Same faces, same status colours, same pills. Differences: the Home screen uses the "home-dark" tokens (`--fp-*`) with Text `#313851` and Dim `#5b6472` (these are the same greys, just older names), and Newsreader for the client's name. Anything new on the client side should read this doc, not copy an older client screen.

## 9 · Browser floor

iOS Safari 15.6 and up (a live tester is on iOS 16.1). No CSS that needs newer than that: container queries are fine, `:has()` is fine, but check caniuse before anything exotic.

---

### Decisions needed ⚖

1. Collapse the half-pixel font sizes as files are touched — yes / no.
2. Retire the duplicate greys, greens and oranges per the table in §3 — yes / no.
3. Keep Newsreader for the client's name only, or drop the serif entirely.
