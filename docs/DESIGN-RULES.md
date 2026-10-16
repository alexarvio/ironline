# NorCoach client app · design rules

Read this before touching any client screen. One hero language, one everyday language, nothing else.

## 1. Two languages, no third
- **Hero**: the phase cards on Home only. Full-bleed photo, dark glass panel, white type. Nothing else may look like this.
- **Hairline**: everything else. Thin 1px lines, rings and icons alone, light type, the page colour behind. No white cards with borders and drop shadows, no gradient fills, no tiles around icons.

**Kept as is (16 Oct, by choice):** the Training tab's week card and its session cards (white, tinted green when done, "Up next" chip). Do not restyle them to hairline; the hairline attempt was reverted. They are the one list drawn as cards.

## 2. Page and lines
- Page `#F5F5F5` on Home, `#F5F6F8` on the pushed screens (Events, Workout, Notifications). One per screen, never two tones on one screen.
- Hairline `#E1E5EB`. Separate things with one hairline or with space, never with a box.
- White `#fff` only for a pill or a button, and it gets `inset 0 0 0 1px #E1E5EB`, never a shadow.

## 3. Type (Archivo)
- Weights **500** and **600** only. Date numerals may be **300**. Never 700 or above on a client screen.
- Eyebrow / label: 10–11px, 600, letter-spacing .16–.18em, uppercase, `#5b6474` or the item's colour.
- Title: 15–17px, 500; the focused or live one 17–18px, 600. One line with an ellipsis, and a chevron when it is cut.
- Secondary: 12px, 500, `#8b93a1`. Tabular numerals for dates, counts and times.
- Ink `#141a24`, body `#3a4250`, faint `#8b93a1`, label grey `#98A2B3`.

## 4. Colour
- One colour per category, everywhere (see `app/lib/eventTypes.ts`, `notificationTypes.ts`, `phases/timeline.ts`):
  training indigo `#3a3390` · nutrition teal `#1d7a70` · lifestyle amber `#a8761f` · trip `#2f5d8f` · supplement `#1f7a4d` · health `#b8471f` · work `#5b6472` · pictures rust `#b8471f` · meeting blue `#2f6fd6`.
- A colour appears as a thin ring, an icon, a label or a 2px line. Never as a filled block behind text.
- Tints: `rgba(rgb, .12)` at most. Past things go grey (`grayscale(1)`) and fade to 30–45%; future things keep their colour at ~55%; the live or focused one is at 100%.

## 5. Icons
- The existing category icons, drawn at **stroke 1.6**, round caps and joins, no fills.
- The icon alone. A ring around it only when the item is live or in focus; a live ring pulses in its colour. No tile, no disc, no halo.

## 6. Buttons and controls
- Primary: ink pill `#141a24`, white text, height 38–44, 600. One per screen at most.
- Secondary: white pill with the hairline inset, ink text.
- Text action: 12–13px, 600, ink or `#5b6474`, no underline.
- Segments and chips: white with the hairline, the active one ink with white text.
- No navy fills, no gradients, no shadows under buttons.

## 7. Motion
- 200–250ms ease for size and colour. Scroll-driven focus follows the finger live.
- Snap to one spot; the item in the spot grows (ring ×1.25–1.3, title to 17–18px) and nothing else moves. Rows keep a fixed height so content below never jumps.
- Only live things pulse. Respect `prefers-reduced-motion`.

## 8. Layout
- Section eyebrow at 28px in from the screen edge, content 16px in, rows may bleed edge to edge.
- Dates in a left column as light numerals, one date per day, the live one dated today.
- No position dots, no "See all" when a tap on the item already leads there, no explanation sentences.

## 9. Before editing
- Check this file. If a spec you were given conflicts with it, follow this file and say so.
- Reuse an existing pattern (events row, Events screen, progress pill, workout header) before inventing one.
