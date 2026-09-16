# Ironline UI guidelines

How the app looks, so a new screen matches the ones already there without discussion.

Status: **decided 16 Sep 2026**. The eight open questions in the previous draft were settled on the
design system page (https://claude.ai/artifact/HqBeb5YUR9jeftwRbAKtP5), which also holds swatches,
component specimens and a screen-by-screen table of what each screen uses today. This file is the
short version that lives with the code.

Nothing was swept through the stylesheet on that date: **new and touched code follows this file, the
rest catches up screen by screen.** §10 lists what each screen still needs.

---

## 1 · Typefaces

| Role | Face | Where |
|---|---|---|
| Everything | **Archivo** 400–800 | body, tables, buttons, pills, inputs, labels, figures |
| Wordmark | **Kirana** (`--font-brand`, local) | "IRONLINE" in the client top bar, uppercase, 17–18px |
| Display figures | **Newsreader** 500–600 | a big figure or a dialog title, never in a table, button, pill or input |

- Manrope is retired. `--font-sans` should resolve to Archivo everywhere; the `body:has(.ad-shell)`
  override and the per-tab overrides in `.nd`, `.tr` and `.ci-screen` collapse into one root rule
  once the Manrope screens are converted.
- Libre Baskerville is retired: nothing reads the `--font-serif` override in `.nd`, and `.tr` uses it
  in one place by accident (the locked-week title).
- Numbers that sit in columns get `font-variant-numeric: tabular-nums`.

## 2 · Type scale

Ten sizes, px only, no half pixels. Pick the nearest; do not invent an eleventh.

| Role | Size / weight | Use |
|---|---|---|
| Display | 32 / 700, −0.015em | the one big line on a screen (programme name) |
| Title | 22 / 700 | card titles, dialog titles, the client's name |
| Section | 18 / 600 | a heading above a group |
| Figure | 28 / 500, tabular | kcal, days trained, a weight |
| Body strong | 14 / 700 | the primary cell in a row (exercise, goal, supplement) |
| Body | 14 / 400–500 | ordinary text and notes (16 in any input, see §6) |
| Small | 12 / 500–600 | secondary cells, footers, hints |
| Label | 11 / 700, +0.12em, uppercase | eyebrows, table headers, meta lines |
| Micro | 10 / 800, +0.1em, uppercase | badges, weekday letters |
| Coach dense | 12.5–13 | coach tables and rows, where 14 wastes the screen |

The Label recipe is one recipe: **11 / 700 / +0.12em / Muted**. It is the single biggest source of
drift — the same role currently appears at six letter-spacings and three weights.

## 3 · Colour

### Brand

| Name | Hex | Use |
|---|---|---|
| Navy | `#1e3a6e` | primary buttons, the pending bar, the navy Home card |
| Accent | `#2f5d8f` | links, focus rings, selected states, text buttons |
| Banner | `#D5DEEF → #E3E9F5 → #F4F7FC` | every client tab's banner (light); ink text, navy for the selected chip |
| Tint | `#e6ecf3` | card header bands, selected rows, icon circles |

Retire: `#081F5C`, `#1b3f6e`, `#334EAC`, `#3B5A8C`, `#5987a8`, `#7C9DE0`, `#3a3390`, and `#313851`
wherever it is standing in for a blue.

### Greys

| Name | Hex | Use |
|---|---|---|
| Ink | `#141a24` | headings, first cell in a row |
| Text | `#313851` | body copy |
| Muted | `#5b6474` | labels, second cells, table headers (4.9:1 on white) |
| Faint | `#8b93a1` | placeholders, hints, footers |
| Border | `#dfe3e8` | card and input outlines |
| Hairline | `#eceff3` | dividers inside a card |
| Page | `#F4F7FC` | every screen background, client and coach |
| Raised | `#edf0f4` | coach rail and client panel |
| Surface | `#ffffff` | cards, inputs |

Retire: `#5b6472`, `#8b93a0`, `#14171c`, `#c2cbd3`, `#c3c9d2`, and the blue-tinted set
`#3d4a68` / `#6C7A9C` / `#97A3BD`. Also `#f8f9fb` and `#F7F9FC` as page colours — the page is
`#F4F7FC`. `--border` and `--fp-line` should be changed to `#dfe3e8` at the token, not rule by rule.

### Status — a colour always carries a meaning

| Meaning | Text / fill | Tint |
|---|---|---|
| Good / on target / done | `#2f7a3f` | `#dff3ea` (text `#0f5c46`) |
| Warning / off target / draft / unsaved | `#b3471d` | `#fbe9e0` |
| Destructive | `#a32d2d` | `#fbeaea` |

Green never decorates; orange never means "training day". No status, no colour — it is grey.
Retire `#3f6e46`, `#1f7a4d`, `#9a5a33`, `#b8471f`, `#a13a3a`, `#9b2c2c`.

### Category tints

Classify, never judge: training `#e6e4fa` / `#3a3390`, nutrition `#dff3ea` / `#0f5c46`, lifestyle
`#efede6` / `#4a4a45`, feed note `#fff3dc` / `#8a5a12`, measurements `#e3edf7` / `#24507c`,
neutral `#eef0f3` / `#5b6474`. Macro chart hues stay: protein `#334EAC`, carbs `#D99A2B`,
fat `#2E8B7A`.

## 4 · Shape and space

| Radius | Use |
|---|---|
| 999px | pills, switches, progress tracks |
| 18px | client cards (phone) |
| 12px | coach cards, dialogs, client primary buttons, inner tiles |
| 10px | inputs, notes, inner cells |
| 8px | coach buttons, chips in tables |
| 6px | inline-editable cells, category tags |

Retire 5, 7, 9, 14, 16, 22, 24 and 99px.

Spacing stops: **4, 6, 8, 10, 12, 14, 16, 18, 22**. Cards 18px apart; controls in a row 10px; label
to value 4–6px. Coach card body: 22px sides, 16–18px top.

Shadows, one per job: client card `0 12px 30px -20px rgba(8,31,92,.4)`, popover
`0 12px 28px rgba(20,23,28,.16)`, dialog `0 18px 44px rgba(20,23,28,.22)`, segmented-control thumb
`0 1px 2px rgba(20,30,50,.12)`. Coach cards have no shadow — the border does that work.

## 5 · Motion

- **150ms ease** — hover, a bar turning solid, a chevron.
- **300ms ease** — something moving or reordering.
- **600ms `cubic-bezier(.22,1,.36,1)`** — a figure earning itself: a ring filling, a count-up, a tick.
- All of it behind `prefers-reduced-motion`, including JS timers and `behavior: "smooth"` scrolls.

## 6 · Controls

- **Primary button**: Navy fill, white text, one per card. Client: 48px tall, radius 12, 14 / 700,
  full width in a dock. Coach: 34px, radius 8, 12 / 800. The label says what happens ("Deploy now").
- **Secondary**: white, 1px Border, Navy text, same geometry as the primary beside it.
- **Text button**: Accent, no fill, no border.
- **Destructive**: outlined `#a32d2d`; filled only as the confirm inside a dialog.
- **Segmented control**: tint track, white active segment with the thumb shadow, Navy text.
  One treatment — not the filled-accent or filled-black variants.
- **Pill**: radius 999, 11 / 800, +0.06em, uppercase. Category tag: radius 6, same type.
- **Inputs**: white, 1px Border, radius 10; focus turns the border Accent, no outline, no shift.
  **On the phone every input is 16px** or iOS zooms the page. Client inputs are at least 44px tall.
- **Inline-editable cell**: transparent at rest, Border on hover, white on focus, saves on blur.
- **Tap targets are 44px**; where the control is smaller, expand it with an invisible `::after`.
- **Coach edits queue on the pending bar** — it is the only way batched edits land. No per-row save
  buttons beside it. A confirm dialog is needed before anything that moves dates, deletes, or changes
  what the client sees while a phase is live.

## 7 · Client page model

Every client tab opens the same way:

1. The fixed top bar (burger · IRONLINE · bell), off-white with Navy, see-through over a banner
   until the page scrolls.
2. A full-bleed banner holding the tab's one big fact: a Label eyebrow, a Display line, and a
   progress line where there is one. Side padding 22, bottom 58, top `calc(var(--topbar-h) + 2px)`.
3. The first card pulled up **−36px** over the banner: radius 18, no border, soft shadow.
4. `.tr-body` / `.nd-body` below: a flex column, 16px gap, 0 16px padding.

Home and Settings still use their own shapes (a card stack and flat rows); they move onto this model
when they are next reworked.

## 8 · Coach page model

- Card: white, 1px Border, radius 12, 18px apart.
- Header band: the accent tint, padding 14px 22px, centred. Left: a Label eyebrow, optionally one
  heading line. Right: a pill switch and at most one button.
- Table in a card: header strip `#fafbfc` with Label text, rows 10px 22px with a Hairline under each,
  footer strip with Small Faint text.
- Left rail 240px, client panel 296px, both `#edf0f4`.

## 9 · Words

- The client never reads a coach word: no "deploy", no "phase id", no "client 5".
- A control says what happens; the message after it says what happened.
- Errors say what went wrong and what to do about it.

## 10 · What each screen still needs

| Screen | Outstanding |
|---|---|
| Client · Home | ✅ done 16 Sep (banner with name and goal, Archivo, colours, corners) |
| Client · Training | ✅ done 16 Sep (colours, corners, labels, 16px inputs) |
| Client · Training session | ✅ done 16 Sep, with the Training tab |
| Client · Nutrition | ✅ done 16 Sep (colours, labels, pill switch, phase bar) |
| Client · Check-in | ✅ done 16 Sep (colours, corners, pill switch, Save radius 12) |
| Client · Settings | ✅ done 16 Sep (banner with name and photo, cards, Archivo, switches) |
| Client · Notifications | ✅ done 16 Sep (Archivo, colours, centred title, bare back arrow) |
| Client · Progress pictures | ✅ done 16 Sep (Archivo, centred title, corners, labels; purple kept) |
| Client · Coach profile | Archivo; navy; serif kept for the display lines only |
| Coach · all tabs | Label recipe; green `#3f6e46` confirms → Navy; page `#F4F7FC` |
| Coach · calendar | still on the old cream palette |

Also outstanding, app-wide: the duplicate `--fp-*` token set, the dead CSS blocks
(`.training-dark`, `.ts-day-head`, `.tr-tile`, `.nt-*`, the second `.ad-nav`), the "Workout complete"
card rendering in the wrong face because it is portalled to `body`, and the units preference in
Settings that the Kg | Lbs switch ignores.

## 11 · Browser floor

iOS Safari 15.6 and up (a live tester is on 16.1). `:has()` and container queries are fine; check
caniuse before anything newer.

---

### Decision log

Settled 16 Sep 2026: Archivo everywhere · Navy `#1e3a6e` + Accent `#2f5d8f` · neutral greys ·
page `#F4F7FC` · 18 phone / 12 desk radii · client primary radius 12 at 48px · Label 11 / 700 /
+0.12em · banner model on every client tab.
