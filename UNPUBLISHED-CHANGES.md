# Review list — what is live and what is not

Live means pushed to `main` and deployed on Railway, so Finlay and his testers have it.
Groups are ticked off here as they ship, so nothing gets lost track of.

Where to look: coach side at `localhost:3000/admin`, client side at `localhost:3000/client` (Sam Rivera, client 5, has the most data).

---

## 1 · Client Home restructure — ✅ LIVE 12 Sep
Commits `3591086`, `9d4c581`, `678dea8`, `f25a211`

- [x] ~~**Home tab rebuilt**: name, plan rows (phase + programme with time left), next meeting card with a Join button ("Starting now" when it's time), goals list, then the Data card. Weekly training stats moved to the Training tab.~~
- [x] ~~**Data card**: one card with a stat strip over the graph, four pinned figures at most.~~ Superseded by group 8: the Data card is off Home again.
- [x] ~~**Goals never close themselves**: a met target stays until the coach ticks it off; if it slips again it reads "Reached Sep 8 · slipped, X to go" in orange.~~

## 2 · Goals are one list — ✅ LIVE 12 Sep
Commits `afaacd0`, `a69cda6`, `e71ce15`, `a27588e`, `9363cc9`

- [x] ~~**No more short-term / long-term**: one list per client, shared by Home, Meetings and Plan.~~
- [x] ~~**Goal editor**: type-to-search pickers for metrics, exercises and check-in habits; nothing preselected; calories logged is a trackable figure; start date; pace verdict line.~~
- [x] ~~**Drag to reorder** goals; untracked goals show no status word.~~

## 3 · Meetings tab — ✅ LIVE 12 Sep
Commits `5b17f23`, `70049c7`, `89f743a`, `55bfae5`, `7bb62ac`, `e46503b`, `8a9f4e3`, `e3536eb`

- [x] ~~**Meetings tab** on the client page: upcoming meeting card (topic, join link set in a dialog, prep notes that autosave, Cancel / Reschedule / Mark completed), goals to review beside it.~~
- [x] ~~**Mini calendar** with a day agenda listing what's booked; schedule form with a 24-hour text time field.~~
- [x] ~~**Past meetings**: "2 weeks ago · 1 goal set" beside the title, status pill on the far right, no dropdown.~~
- [x] ~~**Client side**: the join link reaches the client's Home meeting card.~~

## 4 · Plan tab redesign — ✅ LIVE 12 Sep
Commits `3c42851`, `3213446`, `70667f7`, `c8fd5d7`, `dd09703` (part)

- [x] ~~**Phases grid**: 13 / 26 / All weeks, months and ISO weeks, nutrition / training / lifestyle lanes, Now marker, bars with badges and progress, "+ add" on empty tracks.~~
- [x] ~~**Drag**: edges change length, the whole bar moves; a "Move X?" dialog confirms before saving; a programme the client already trained in keeps its start.~~
- [x] ~~**Goals table** under the grid: Open / Done / All, columns for tracks, live standing, progress, set in, by; done-ticks queue on a blue pending bar with Apply.~~
- [x] ~~**Band subheadings removed** under Phases and Goals.~~
- [x] ~~Side panel no longer shows goals.~~

## 5 · Client notes to the coach — ✅ LIVE 11 Sep
Commit `fea5a08`, pushed on its own as `7566593`.

## 6 · Admin Nutrition tab redesign — ✅ LIVE 12 Sep
Commits `dd09703`, `e804934`

- [x] ~~**Daily targets card**: phase switch, Training / Rest toggle, "Same macros on both", big derived kcal with share bar, macro cells (% kcal, g/kg), water goal, note beside.~~
- [x] ~~**Supplements card**: inline-editable sheet, timing pills, add row in the footer.~~ Fixed before shipping: the typed name now starts the row, and every empty cell shows a placeholder so it reads as editable. The "Show in app" switch is gone, the list always shows.
- [x] ~~**Calories logged card**: 7 / 30-day bar strip and table judged against that weekday's target, client note column.~~

## 7 · Small Training-tab tidies — ✅ LIVE 12 Sep
Commits `d36a12f`, `c39e672`

- [x] ~~Set rows centred; the Edit column no longer leaves a gap on the right.~~ Shipped early in the `hotfix-training` push.
- [x] ~~The week-over-week volume percentage beside "Sets logged" is gone.~~ Overtaken by group 8: the whole Sets logged figure went.

## 8 · Client Home reordered around one main goal — ✅ LIVE 12 Sep
Commit `f0b6a02`

- [x] ~~**Main goal under the name** replaces the nutrition phase. New `main_goal` on the client profile.~~ Until the coach sets one, the line reads "Your coach hasn't set your main goal yet".
- [x] ~~**New order**: name and main goal, plan rows, next meeting, Check-ins, then Goals.~~
- [x] ~~**Data card off Home** for now.~~
- [x] ~~**Training tab**: "Days trained" only, "Sets logged" gone.~~

## 9 · Training day cards — ✅ LIVE 12 Sep
Commit `4c1e7a0`, pushed as `hotfix-training`

- [x] ~~One day open at a time: opening Friday folds Wednesday.~~
- [x] ~~The open exercise card carries its number, matching "Exercise 2 of 5" in the day header.~~

---

## 10 · Client Home rebuilt to design "2a", plus the Training, Plan and Meetings follow-ups — ✅ LIVE 12 Sep
Commits `71739ba` … `a9d120b`

Five blocks instead of six, three of them expandable, so the screen is
scannable without losing anything.

- [x] **Profile card**: 44px avatar (navy circle with the initial; a photo slots in when client photos land), date eyebrow over the first name in Newsreader, the main goal underneath. Nothing else when collapsed. The chevron opens a row per track with the phase name, time left, a progress bar, the week position and what is up next.
- [x] **Up next**, the only navy card: the session titled by the coach's own name with its exercise and set counts, and a Start button that opens the Training tab on it. No weekday, no time estimate.
- [x] **Check-in row** under it: how many are due, or "All check-ins done" with a green tick when there are none. No list of metric names.
- [x] **Next meeting** with a calendar-leaf tile and a status pill that turns green ten minutes before the call. The chevron shows only when the coach has set a call link, and reveals nothing but the Join button.
- [x] **From the last meeting**: a recap the coach writes for the client, attached under the next meeting in the same card. Written from a box on the coach's past-meeting row.
- [x] **Current goals**: open goals only, in the order the coach dragged them into. Completed ones no longer clutter the list.
- [x] **Drag to reorder on the Plan tab**: every goal row has a grip, and the order the coach drops them into is the order the client sees. The drag queues on the same pending bar as the done-ticks, so it saves on Apply and Discard puts it back. Dragging inside the Open filter leaves the closed ones behind it.
- [x] **A reached goal no longer draws a full green bar**, which read as finished. It shows its figure and "On target since 26 Aug" instead. The coach’s table still reads 100%.
- [x] **Mark completed asks for the recap**: closing a call opens a box for what was covered and agreed, which goes straight to the client. "Complete without one" skips it.
- [x] **Plan tab phases**: the now line and the Now pill are gone; the shaded current week is the marker. The current week sits in the second column, so the grid mostly shows what is ahead. The range switch is 13 or 26 weeks; All is gone.
- [x] **Client Training tab**: the week strip opens with last week at the left edge so the current week sits second, and drifts right only when the programme runs out of weeks. Days trained is a percentage ring on the right of its card.
- [x] **Set logging asks only for what the coach set**: reps always, kg and RPE only when a target exists. The target line and the columns are centred whatever their count, so a reps-only exercise is one wide box in the middle.
- [x] **Programme note for the coach**: a box between Days trained and the sessions, always open for typing; Save and Cancel appear once the text differs from what is saved. One note per programme, shown to the coach at the top of the Training tab above the builder. New `client_program_notes` table.
- [x] **Reserved**: a dashed empty slot held for a bodyweight sparkline.
- [x] **Header** is a white band now: 26px logo, "Ironline" in Newsreader navy, and a 34px circular button carrying an accent dot when notifications are unread.

New data: `summary` on a meeting, the coach's recap written for the client.
It is deliberately separate from `prep_notes` and from the meeting-notes
log, both of which stay on the coach's side and must never reach the
client. `getUpNextSession()` picks the session Home offers to start.

Look: `/client` Home.

## 11 · Plan tab goals table: Live figure only — ✅ LIVE 12 Sep

- [x] The Progress column is gone. Live shows the current figure alone ("90 kg", "3 of 7"), with no "reached" or "on pace" after it; the rule underneath the goal already says what it is measured against.

## 12 · Main goal control, Start scrolls to the session — ✅ LIVE 12 Sep

- [x] **Main goal** is set from the top of the Plan tab: one line above the phases, Save and Cancel once it differs. It shows under the client’s name on Home.
- [x] **Start on Home** opens the Training tab with that session open and scrolled to the top of the screen.
- [x] The "Only you see this" hint under the exercise note is gone.

## 13 · Supplements sheet on the pending bar; calories strip gone — ✅ LIVE 12 Sep

- [x] **Supplements**: edited as a draft. + Add item opens a blank row with the cursor in it; every cell is a plain input; a trash button on the row’s right asks before removing; rows drag by a grip. All of it queues on the bar at the foot ("3 changes · Zinc added · Creatine changed · Order changed") and lands on Apply or goes on Discard. The footer add box is gone.
- [x] **Calories logged**: the weekday bar strip above the table is gone; the table carries it.

## 14 · Meeting card always present — ✅ LIVE 12 Sep

- [x] With nothing booked, Home still shows "Next with your coach · Nothing booked yet" with a calendar icon where the date leaf goes, so a new client sees the slot rather than a gap.

## 15 · Daily targets on the pending bar — ✅ LIVE 12 Sep

- [x] The Save targets button in the band and the Save note button under the note are gone. Macros, water and the note all queue on the bar at the foot ("3 changes · Training day 2,949 kcal · Water 3.5 L · Note changed") and land on Apply or go on Discard.

## 16 · Home: main goal as a headline, bigger call to action — ✅ LIVE 12 Sep

- [x] The main goal is set in the display serif at title size, so it reads as what the programme is for. The Up next card grew: bigger session name, a larger Start button, a taller check-in row.

## 17 · Calorie note box, programme and phase titles — ✅ LIVE 12 Sep

- [x] The calorie note for the coach is the same tap-to-open box as the programme note: Cancel and Save from the first tap, and a line saying the note saves with the calories while the kcal field is empty.
- [x] The client’s Training tab shows the programme’s name above the week strip, with its length.
- [x] The client’s Nutrition tab shows the current nutrition phase’s name above the targets, when the coach has one on the plan.

## 18 · Check-in rebuilt: one list, then Your progress — LOCAL ONLY, not pushed

- [ ] Keep  [ ] Drop — **One list, no tabs.** Dailies every day, weekly metrics join once their window opens (the coach’s check-in day onwards) under a "This week" caption, measurements under theirs. One Save posts everything; one note for the coach.

- [ ] Keep  [ ] Drop — Under every check-in metric with two or more readings, a small chart of its movement inside the current phase: the change since the phase began on the right, the start and latest readings under the line, and a tap opens the readings as a list. The phase is the running nutrition phase on the Plan tab; with none, the card’s phase start, then the start of coaching. The last reading before the phase began carries over as its starting line, drawn as a hollow dot. Shows in the open form and on the saved card.

Look: `/client` Home → check-in row.

## 19 · Client profile photo — ✅ LIVE 12 Sep
Commit `a10ba40`, ported from `next` and pushed on its own.

- [x] The client sets a photo from Settings (tap the circle; Remove underneath). It shows on their Home profile card, in the coach’s client rail and at the top of the client panel. The initial stands in until one is set.

## 20 · Builder: Rest column editable, Notes always last, summary gone — ✅ LIVE 12 Sep

- [x] The Rest column takes a value ("90s", "1:30", "2 min") and saves through the pending bar like the others; the client sees it in the exercise’s target box.
- [x] Notes is always the last column, whatever order columns were switched on in.
- [x] The "5 training days · 50 sets logged" line is gone from the toolbar.
- [x] Custom column is a dashed "+ Custom column" chip that opens a name box, instead of a bare input that read as a label.

## 21 · Week rail lights the days actually trained — ✅ LIVE 12 Sep

- [x] A green tick means a set was logged on that weekday, wherever the session was planned. A planned day with nothing logged stays grey. A session moved to another day lights the day it was done, with "moved from another day" on hover.

## 22 · Programme note inside its programme; set times in local time — ✅ LIVE 12 Sep

- [x] The client’s programme note is a card at the far right of the week row, inside the programme it is about. A dot marks a note the coach has not opened yet; opening it shows the text and clears the dot until the note changes.
- [x] Set logs are stamped in the server’s local time like every other date, instead of UTC. Live runs in UTC with no timezone set, so a session before 7am Bangkok time was landing on the previous day.

## 23 · Nightly backups, Amsterdam time — ✅ LIVE 12 Sep

- [x] Every night at 03:15 server time, and a minute after each start, the store is copied as a dated snapshot (thirty kept) plus `latest.json`, and the uploads folder is mirrored, to the `ironline-backups` Railway bucket (region ams). Coach can POST `/api/backup` for one on demand. Dev machines with no `BACKUP_*` variables never upload.
- [x] Live runs in Europe/Amsterdam (`TZ` on the Railway service), so check-in dates, set times and the week rail read that clock.

## Still to build

2. **Short-term goals set from the Plan tab.** The Goals list on the client's Home is the coach's list; the intent is that these are the micro goals, set alongside the main goal.
3. **What else belongs beside "Days trained"** on the client's Training tab, if anything. Left as the single figure for now.

## Not in this push
The `next` branch is separate and unmerged: branding, packages, progress pictures, and the check-in rebuild that drops the Measure tab. See `WHATS-NEW-ON-NEXT.md` on that branch. Merging it now conflicts in ten files, including the check-in screen, because live has moved a long way since it was cut.
