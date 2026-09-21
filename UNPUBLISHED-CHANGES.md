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

## 24 · No more jumping to the top — ✅ LIVE 12 Sep

- [x] Check-in and Notifications open as layers over the tab instead of replacing it, so closing them returns to the same scroll and the same open day. Tapping the tab you are already on does nothing rather than rebuilding it.

## 25 · Nutrition: supplements above the logged days; phone screen sized to the visible viewport — ✅ LIVE 12 Sep

- [x] Supplements sit between today’s calorie entry and the list of days already logged.
- [x] On a phone the screen is sized to the visible viewport (dvh) and the tab layers are stacked with grid, so the page itself never scrolls and the header no longer slides under the status bar.

## 26 · Programme note as a dialog; nutrition cards keep only their titles — ✅ LIVE 12 Sep

- [x] The client’s programme note card matches the week pills’ height and opens the note in a dialog rather than expanding in place. A long programme no longer scrolls the whole page sideways; only the week rail scrolls.
- [x] The Daily targets, Supplements and Calories logged cards show just their titles; the summary line under each is gone.

## 27 · Cardio on a programme day — ✅ LIVE 12 Sep

- [x] Under each day’s exercise table the coach can add cardio rows with their own columns: activity (free text), time, pace, incline, notes. They queue on the day’s pending bar with everything else, mirror to later weeks with “Also apply”, and count toward the day (a day with only cardio is a workout, not rest).
- [x] The client sees each cardio entry as a card after the day’s exercises, with the targets and the note. Nothing is logged against cardio yet.

## 28 · Gyms: weights kept per gym — ✅ LIVE 14 Sep

- [x] ~~A client can have more than one gym. Only the coach keeps the list, from the "Client gyms" pill at the far right of the programme row on the Training tab: it opens a list with Add and Delete. (Behind the scenes the first gym holds the plain Weight figure; deleting it hands that to the next gym, weights swapped over so nothing changes.) Removing a gym only hides it; what was logged there stays.~~
- [x] ~~With two or more gyms, an open session has a "Which gym are you training at?" box right under its header, the gyms side by side. The client taps one; it stays highlighted for the whole workout, and the box never goes away. It starts on the gym picked last. The client cannot add, rename or remove gyms. Every set logged records the gym. Switching gym after logging moves that session's sets to the new gym (it asks first).~~
- [x] ~~Each gym's weights move forward on their own, by the same rule as before. The first gym is the home gym: the Weight figure is its weight, and everything logged before gyms existed counts as there. Another gym starts from the Weight figure; after the first visit, what was lifted there becomes that gym's weight.~~
- [x] ~~Builder, with two or more gyms: the Weight cell has a box per gym (empty = starts from the home weight), queued on the pending bar like any other edit. "What the client did" names the gym and compares against the last visit to that same gym; a first visit says "First visit" instead of "under".~~
- [x] ~~"My notes" are kept per gym.~~
- [x] ~~Builder: once the client has logged a session, its day header shows the gym as a blue pill, e.g. "Muscle Factory", beside Copy. The per-gym weights in the Weight goal cell sit in even, centred columns.~~
- [x] ~~Two gyms are two parallel tracks for every weight figure: the ▲/▼ % trend beside an exercise in the builder counts one gym (this week's, or the gym in use now), and an exercise goal counts one gym's sets. The goal editor asks which gym when there are two or more; existing goals count the home gym. The goal reads "Lat Pulldown · PureGym · best set" on Home and "… at PureGym" in the coach's lists.~~
- [x] ~~Postgres: new `client_gyms` table, migration `drizzle/0001_client_gyms.sql`.~~

## 29 · Coach's note open in the exercise card; builder columns lined up — ✅ LIVE 14 Sep

- [x] ~~Client session: the coach's note shows open inside the exercise card, as a "From your coach" box between the target and "My notes". No note, no box. The chat icon in the card header is gone; the note counts as read once the card is open. Cardio cards show their note the same way, under the figures.~~
- [x] ~~Builder: with two or more gyms the cardio table's columns line up with the exercise table again (both use the wider Weight goal column).~~

## 30 · Check-in reminders tick themselves off — ✅ LIVE 14 Sep

- [x] ~~A reminder in the client's notifications (daily or weekly check-in, measurements, progress pictures) is marked read as soon as it is no longer due: the client did it, or its day, week or photo period has passed. Only reminders; notes, reports and new plans still wait for a tap.~~

## 31 · Sessions instead of weekdays — ✅ LIVE 14 Sep

- [x] ~~A programme week is a list of sessions, not Monday to Sunday. An empty week shows only "+ Add session"; each click adds Session 1, 2, 3 … as an expandable row with its name field, Copy and Delete (Delete takes its exercises, cardio and logged sets; the sessions after it move up). The Workout / Rest toggle is gone.~~
- [x] ~~Existing programmes convert once, on the first load after deploy: days with nothing on them (unbuilt and rest days) are dropped, the rest keep their order as Session 1, 2, 3 … with their exercises and logged sets.~~
- [x] ~~Copy week, Copy session, "Also apply to remaining weeks" and "add to the remaining weeks" match sessions by number; a later week with fewer sessions grows to fit.~~
- [x] ~~Week rail: one tick per session (trained, not trained in a past week, not yet).~~
- [x] ~~Nutrition: a training day is a day the client logged a set, on the client's toggle default and in the coach's calorie log, instead of the programme's weekday.~~
- [x] ~~Coach feed titles read "Session 2 · Push (Week 3)".~~

## 32 · Copy a session: a dialog with "New session" — ✅ LIVE 14 Sep

- [x] ~~Copy on a session opens a dialog, "Copy Session 3 · Push", listing where the copy can go: first "New session — Adds Session 6 to this week", then every other session with what it replaces ("Replaces its 5 exercises"). The button says the outcome: "Add as Session 6", "Replace Session 1".~~
- [x] ~~A tick does the same in the rest of the programme ("Also add it to the remaining week (W3)"); a new session is added at the end of each later week, so no empty sessions appear.~~
- [x] ~~A copied session brings its cardio along, not only its exercises.~~

## 33 · Admin client panel redesign — ✅ LIVE 14 Sep

- [x] ~~Header: 40px avatar (photo or navy initial), name over "Client since …", a 28px chevron that folds the panel away, and the phase pill on its own line that wraps instead of truncating.~~
- [x] ~~Snapshot unchanged in content, restyled: label outside the card, value and unit as separate spans so the numbers line up.~~
- [x] ~~Member info (closed), Coaching info (open) and App access (closed) are collapsible cards whose headers say what is inside ("1 of 6 filled", "7 of 8 set", "Signed up"). Empty fields read "Add" and open that section's editor on the field; each section edits on its own ("Edit details", "Edit plan"). Coaching info gains a Change row (−3.8 kg); the goal / phase row is the header pill instead.~~
- [x] ~~Each section remembers open or closed in this browser, so folding the panel away and back leaves them as they were.~~
- [x] ~~App access keeps reset and remove behind the closed section: the temporary-password field, then Reset password and Remove access side by side.~~
- [x] ~~Recent activity shows three entries with a blue dot for this week, and "See all" to the feed. Delete client is last, outlined and quiet.~~

## 34 · Coach rail redesign: search, Needs you — ✅ LIVE 14 Sep

- [x] ~~The left rail is 240px: brand block with the real logo mark, Feed and Calendar (Feed shows how many clients need you), then the client roster, then the coach at the foot.~~
- [x] ~~Roster: search by name, All / Needs you filter with its count, "4 of 9" when narrowed. The selected client is the only navy avatar; an amber ring means the client hasn't signed in to the app yet (no login, or a temporary password never replaced); the orange dot still means they need you. Only the list scrolls, with no visible scrollbar. New client is pinned at its foot.~~
- [x] ~~Coach footer: initial, name (from the login email, as accounts have no name), "Coach", and a gear that opens a menu with Sign out. There is no coach Settings page on main yet; when it lands, the gear can link to it.~~

## 35 · Seven sessions a week at most — ✅ LIVE 14 Sep

- [x] ~~A programme week holds up to 7 sessions. At 7, "+ Add session" is replaced by a line saying so, the Copy dialog drops "New session" and offers only replacing one, and copying a new session into later weeks skips any week that is already full. Enforced on the server too.~~

## 36 · Sign-in lockout — ✅ LIVE 14 Sep

- [x] ~~3 wrong tries on one account from the same device lock that device out of the account for 15 minutes; 10 wrong tries on one account from anywhere lock the account everywhere for 15 minutes. While locked the password isn't checked, and the page says "Too many attempts. Try again in 15 minutes." Unknown emails count the same, so nothing reveals which accounts exist. A correct sign-in clears the count. Counts live in server memory, so a redeploy clears them.~~
- [x] ~~Every lock is written down and shown at the top of the Feed for 7 days ("Sign-in lockouts"): who, why, when, the email and IP, and whether it is still locked. A coach sees their own account and their clients'; the owner sees every lock, including emails with no account. A client locked out right now gets the orange dot and counts under Needs you.~~
- [x] ~~Resetting a password (coach for a client, owner for a coach) ends any lock on that account at once.~~

## 37 · Plan tab: tinted card headers — ✅ LIVE 14 Sep

- [x] ~~The Phases and Goals card headers are filled with the accent tint (#e6ecf3), like the panel's Edit buttons: navy title, darker helper text, and a white switch track with a tinted active option.~~

## 38 · Accent-tint headers across the client tabs — ✅ LIVE 14 Sep

- [x] ~~Nutrition: the Daily targets (with its phase chips and live line), Supplements and Calories logged headers use the #e6ecf3 tint, like Plan. The phase chips on it are white; a scheduled phase has a dotted outline, and the chip being edited is outlined in navy.~~
- [x] ~~Training: each session's header row is tinted.~~
- [x] ~~Meetings: the upcoming meeting's band is the tint instead of navy (navy text, white date tile, navy Join button), and the past meeting rows are tinted.~~
- [x] ~~Progress pictures: a "Sheet setup" header band on the settings card, a tinted Sheets header, and tinted week rows.~~
- [x] ~~App access in the client panel: Reset password and Remove access stacked full width, so the label no longer wraps inside its button.~~

## 39 · New nutrition phase from the Nutrition tab — ✅ LIVE 15 Sep

- [x] A dashed "+ New phase" chip after the phase chips on Daily targets (a "+ New phase" button in the band when the client has none) opens the same phase dialog as the Plan tab, fixed to the Nutrition track. It defaults to four weeks starting the week after the last nutrition phase ends, or this week. The phase lands on the Plan tab's nutrition lane like any other, and the Nutrition tab switches to it so its targets can be set straight away. Edit dates uses the same dialog, also fixed to Nutrition.
- [x] **Nutrition phases start as drafts**, like programmes. A new one (from Nutrition or Plan) has an orange Draft pill, a dashed chip and "Draft: Alex doesn't see this yet". Only the coach sees it: not the client's Home, plan, Nutrition targets, the calorie log's phase column or Progress pictures. "Schedule for Oct 5" (or "Deploy now" once its start week has come) sends it out: it is then Scheduled and goes live by itself on its start week. A scheduled phase has "Back to draft". On the Plan tab a draft nutrition bar is dashed with "draft · deploy". Going live straight away notifies the client. Phases made before this count as deployed. No database migration: the flag rides in `extra`.

Look: `/admin` → a client → Nutrition.

## 40 · Training tab: one header card like Nutrition — ✅ LIVE 15 Sep

- [x] The programme chips, "+ New program", Client gyms, the programme being edited (name, deploy controls, live line) sit in a tinted header titled "Programmes", with the week rail and the client's note in the white body under it, the same shape as Nutrition's Daily targets. The column pills and the session cards follow below, unchanged.
- [x] A programme scheduled to deploy reads **Scheduled** (blue pill) on its chip instead of Draft, matching Nutrition's scheduled phases.
- [x] Deploy now is navy instead of green, and Schedule for later… / Cancel are white with navy text, like the buttons on Nutrition and Plan.
- [x] Deploy now, Schedule for later… and Nutrition's Training day / Rest day toggle use the app font like Create login; they were falling back to the browser's own button font and looked heavy.
- [x] The "kcal" beside the calorie figure on Daily targets is in the app font; the figure itself stays in the serif.

Look: `/admin` → a client → Training.

## 41 · Progress pictures: add an angle above the angles — ✅ LIVE 15 Sep

- [x] "Name an angle…" and Add sit on their own row under "Angles you ask for", above the angle pills, so the box stays in the same spot instead of being pushed right by every new angle.

Look: `/admin` → a client → Progress pictures.

## 42 · Meetings: plain Schedule button — ✅ LIVE 15 Sep

- [x] The schedule form's button reads just "Schedule" instead of "Schedule · shows in Alex's app".

Look: `/admin` → a client → Meetings.

## 43 · Training: open session marked in navy — ✅ LIVE 15 Sep

- [x] An expanded session in the builder carries the same navy stripe down its left edge as an open past meeting, header and body both, so the session being built stands out from the folded ones.

Look: `/admin` → a client → Training → expand a session.

## 44 · Kg / lbs switch; a finished workout folds away — ✅ LIVE 15 Sep

- [x] **Client, logging sets**: the weight column's label is a Kg | Lbs switch. On Lbs, the target, the prefilled weight and the logged sets on that exercise show in lbs, and a weight typed in lbs is saved as kg (to four decimals, so 135 lbs reads back as 135). A figure already typed converts with the switch. Remembered per exercise on the phone, since it is the machine that decides. Everything stored stays kg: progression, goals and the coach's view are unchanged. Lbs are always whole numbers, rounded up (60 kg reads 133 lbs), on the client and in the builder.
- [x] **Coach, builder**: a Kg | Lbs switch in the toolbar beside Expand all. On Lbs, "What the client did" (sets, over / under, week-over-week) is in lbs, and each weight goal box shows its lbs figure underneath. Goals are still typed in kg. Remembered in the coach's browser.
- [x] **Workout complete**: logging the day's last set (or ticking its last cardio) pops a "Workout complete" card with a drawn tick, the session name and sets logged; after under two seconds the day folds itself and scrolls back to its header. Opening a day that was already finished does not replay it. No animation with reduced motion on.

Look: `/client` → Training → an exercise with a weight target; `/admin` → a client → Training toolbar.

## 45 · Lbs mode shows the kg too, rounded up — ✅ LIVE 15 Sep

- [x] On the client's exercise in lbs mode, every weight carries its kg: the target reads "133 lbs · 61 kg", each logged and upcoming set has its kg in small type underneath, and the weight box shows the kg of what is being typed, live (135 → 62 kg). Those kg figures are whole numbers, rounded up, as the lbs are. Flipping a typed lbs figure back to kg rounds it up too. Kg the coach set exactly (62.5) still shows as set in kg mode.

Look: `/client` → Training → an exercise with a weight target → Lbs.

## 46 · Client Nutrition tab redesign — ✅ LIVE 16 Sep

- [ ] **Banner** in place of the app header on this tab, scrolling with the page: brand and bell, Training day / Rest day as centred underline tabs, the phase name, one thin line for the phase that fills day by day, and under it "Started …" on the left with "Week 2 of 4" on the right (switching to "Day 24 of 28" with under a week to go).
- [ ] **Calories card** overlapping the banner: three thin rings one inside the other (protein outside, carbs, fat inside), each filled from the top by that macro's share of the kcal, with the kcal target in the centre; beside them protein / carbs / fat stacked with grams and % of kcal. Switching day tabs slides the arcs round and counts the kcal, grams and percentages over to the new figures. The card also swipes: left for Rest day, right for Training day (a clearly sideways swipe only, so scrolling past it never flips it), with two dots under the ring showing which day is up. At its foot, a light-blue Supplements row with how many there are folds down under a chevron. The bottom nav's current tab icon is black instead of blue.
- [ ] **Supplements** (in that fold) with a tick per item, as a reminder. The ticks stay on the phone for today only; nothing is sent to the coach.
- [ ] **Coach card**: the coach's note on the targets; hidden when there is none.
- [ ] **Calories**, after the coach card, with "‹ Today ›" in its header to step back through the last month (Yesterday, 7 September…), never past today, so a day can be filled in once it is over. For the day showing, the client picks Training day or Rest day, types the figure, can add a note for the coach (why a day went 400 over, say), and saves. The note is the one the coach reads beside the day in Calories logged, and it shows under the figure once locked. Saving locks the card: the green washes in, a tick pops and draws itself, and the card shows just the figure with Edit to open it again (a day already logged opens locked, without the animation). The day type is saved with the log (no migration, it rides in `extra`), and the last 7 days and the coach's Calories logged table use it, falling back to whether a set was logged that date on older logs.
- [ ] **Last 7 days**: each logged day with its type, note, kcal and "On target" (within 100) / +N / −N against that day's own phase target, and "k of 7 on target".
- [ ] Water goal and the "Meal logging isn't on yet" line are gone. The tab is set in Archivo (self-hosted): regular text, Medium for every figure, SemiBold for headings and names like the phase, "Supplements" and "Creatine". Only the Ironline wordmark is different (Kirana, group 50). The rest of the app keeps its fonts.

Look: `/client` → Nutrition.

## 47 · Client Training tab retouch — ✅ LIVE 16 Sep

- [ ] **Banner** in #5987a8 with faded diagonal stripes, in place of the app header, its text navy like Nutrition's (no white text): wordmark and bell, "PROGRAMME" and its name, one line filled by the days gone since it was deployed, "Started … / Week N of M", and the week chips at its foot (white when selected; a dot on this week, ✓ on finished weeks, a lock on weeks ahead; they scroll past three weeks). The "Your coach's deployed week…" paragraph is gone.
- [ ] **Days trained** card overlapping the banner: the figure "of N", "N sessions left" / "Week complete", and a ring with the percentage that fills as the tab opens. Its footer is the programme note: one line and a send button; the saved note shows as a bubble, and tapping it puts the text back in the line to change.
- [ ] **Sessions** header with "N of M done". Each session is a white card: the name, "N exercises · M sets" / "In progress · N exercises left" / "Session complete", and on the right the sets pill (green once every set is logged, as on live) and a chevron. Inside, everything keeps the live structure: the gym picker, exercise cards with the target line, the coach's and your own notes, the set table and the full-width "Log set N of M" button, and the cardio cards. Logging, gyms, kg / lbs and notes work as before.
- [ ] Archivo like Nutrition, rather than the SF Pro / Baskerville the prompt named, to match the tab you preferred.- [ ] **Weights round up to a step** and show in one unit only: kg to the next .25, lbs to the next .5, in the client's app and the coach's builder. The kg shown beside lbs (group 45) and any second unit under a logged set are gone; only the unit on the toggle shows.

Look: `/client` → Training.

## 48 · Coach profile — ✅ LIVE 16 Sep (parked: nothing opens it)

- [ ] **Your profile** (`/admin/profile`, from the gear menu at the foot of the rail): photos (a tall hero and a candid, drop or pick, Replace / Remove), About you (display name, title, headline, location, languages, years coaching, reply note), Story (intro, bio, quote, outside the gym, with live character counts), Specialties as chips (Enter adds, up to 8), Studies and Experience as rows you add, remove and drag into order. A live phone preview beside the form is the client's own screen fed from what you type. Save at the foot, with when it was last saved, and a Published switch ("Clients see this from their Account tab"); publishing needs a display name. The owner can switch to any coach's profile.
- [ ] **Client, Account tab**: a Coach row at the top (photo or initial, name, title) opens the profile over the tab: the photo drifts and grows slightly as it scrolls, with the name and years over it; sticky Overview / Background / Outside the gym tabs that follow the scroll; headline, "Your coach · place · languages", pills for years, clients and a degree; the intro with a drop cap, the bio, the quote, "Works most with" chips; where they studied and a timeline of their experience; the candid photo with a line about life outside the gym. A dock at the foot: "Book a call with {first name}" (takes the client to Home's meeting card), the reply note, Share and Save. Sections with nothing in them, and their tabs, stay hidden. Unpublished, the row opens a minimal card: initial, name and email.
- [ ] Data: a new `coach_profiles` table (migration `drizzle/0002_coach_profiles.sql`, applied at startup on Railway). Photos under `/uploads/coaches/{coachId}/`, visible to the coach, the owner and that coach's clients.
- [ ] Labels use the coach's first name ("How Finlay coaches", "Where Finlay studied") rather than "he".

Look: `/admin/profile`, then `/client` → Account → Coach.

## 49 · Check-in retouch — ✅ LIVE 16 Sep

- [ ] Two tabs, **Daily** and **Weekly**, as a pill switch; the coach's measurements now sit in Weekly, and the Measure tab is gone. A header with the date, "Check-in" and a pill counting what is filled in ("3 / 5").
- [ ] Each tab is one white card of rows: the metric's name, its last reading ("87.7 kg on Sep 14"), and a value pill on the right to type into, with its unit. Rating metrics (1–5 and the like) show the pick in the pill and a row of number buttons under it; tap again to clear. A row already logged for this period turns steel blue: tinted row, blue pill with the value in white, a tick after the name.
- [ ] The note for your coach under the card, and a Save dock pinned over the list: "Goes to your coach · 2 still empty" / "All logged". Saving posts the weekly metrics and the measurements to the same two actions as before, with the same fields; the saved summary card works as it did.
- [ ] Archivo like the other client tabs, rather than SF Pro / Baskerville.

Look: `/client` → Home → the check-in row.


## 50 · Wordmark in Kirana — ✅ LIVE 16 Sep

- [ ] "IRONLINE" at the top of the client app (the white header and the Nutrition / Training banners) is set in Kirana, in capitals, self-hosted from `app/fonts/Kirana-Regular.ttf`. It is smaller than before (17–18px), just the name with no logo mark, and centred under the island. A burger menu icon sits on the left and the bell on the right, both bare icons with no circle around them. The rest of the app keeps its fonts.
- [ ] **One top bar on every tab**, and it stays put. On Home and Settings it is off-white with navy name and icons. On Training and Nutrition it floats over the banner, see-through at the top of the page (white on Training's navy banner, navy on Nutrition's light one); the moment the page scrolls it turns off-white with navy, and the page scrolls under it. The burger does nothing yet.
- [ ] **Training banner** is a light navy with a fine grain and faint stripes, its text and week chips white (the selected chip white with navy text), replacing the #5987a8 blue with navy text.
- [ ] Nutrition's banner had its own top row (old logo, Baskerville, bell in a circle) that the earlier wordmark changes missed; it now uses the shared bar too.

Look: `/client` → any tab.

## 51 · Client Training tab on the design system — ✅ LIVE 16 Sep

The first screen brought onto `docs/UI-GUIDELINES.md` (decided 16 Sep). Layout and behaviour unchanged; only colours, corners and type sizes.

- [ ] One navy: `#1e3a6e` for the selected week chip, the send button, the note bubble and the "started" pill; `#2f5d8f` for the Days trained ring. The deeper `#081F5C` / `#334EAC` are gone from the tab. Headings and the big figure are Ink `#141a24`; body `#313851`; labels `#5b6474`; hints and chevrons `#8b93a1`. Tints are `#e6ecf3`, borders `#dfe3e8`, dividers `#eceff3`, done-green tint `#dff3ea` throughout.
- [ ] Corners: Days trained, session cards, the locked-week and empty cards 22 → 18; exercise rows and the gym picker 14 → 12; set inputs 8 → 10; Log set and cardio Done are 48px tall with radius 12.
- [ ] Labels ("Programme", "Days trained") are the one label recipe: 11 / 700 / +0.12em. "Sessions" is 18 / 600.
- [ ] Set inputs and My notes are 16px, so an iPhone no longer zooms the page when they are tapped.
- [ ] The top bar's name and icons are Ink on every tab (was `#3B5A8C`).
- [ ] **Training's banner is the same light blue as Home and Nutrition** (ink text, navy selected week chip), with a fine diagonal hatch instead of their rings so it keeps a texture of its own. The navy banner and its stripes are gone.
- [ ] The "Workout complete" card is in Archivo like the rest of the tab (it is portalled to `body`, so it was falling back to Manrope). Baskerville is no longer declared on the tab; the locked-week title uses Newsreader like the rest of the app.

Look: `/client` → Training, open a session.

## 52 · Client Nutrition tab on the design system — ✅ LIVE 16 Sep

Same treatment as Training (group 51). Layout and behaviour unchanged.

- [ ] One navy: `#1e3a6e` for the selected day tab, the phase bar, Save, the date arrows, the avatar and the swipe dot; `#2f5d8f` for links, the dirty kcal underline and the note's focus border. `#081F5C` / `#334EAC` are gone from the tab. Headings and figures are Ink `#141a24`, body `#313851`, labels `#5b6474`, hints `#8b93a1`; borders `#dfe3e8`, dividers `#eceff3`, tints `#e6ecf3`. The macro ring hues (protein, carbs, fat) are unchanged.
- [ ] The phase name is 32 / 700 like the programme name on Training; "Phase" and the ring and macro labels use the label recipes.
- [ ] The phase bar is a solid navy fill with a marker at its end and the same grow-in animation as Training's.
- [ ] Training day / Rest day on the calorie log is a pill switch (tint track, white active segment, navy text) like the Kg | Lbs switch; Save is radius 12.
- [ ] Baskerville is no longer declared on the tab.

Look: `/client` → Nutrition.

## 53 · Client Home on the design system — ✅ LIVE 16 Sep

Home moves onto the same page model as Training and Nutrition (decision 8 in `docs/UI-GUIDELINES.md`).

- [ ] **Banner instead of the profile card**: the date, the client's name (32 / 700) and the main goal (18 / 600) sit in a navy banner like Training's, in white, with the top bar floating over it. The plan rows still fold out under the chevron, inside the banner.
- [ ] **Up next overlaps the banner**, like Days trained on Training, and is a two-tone blue (navy to accent, corner to corner); the rest of the cards follow at 16px.
- [ ] Archivo instead of Manrope and Newsreader; page `#F4F7FC`; cards and the navy card radius 18; Start, Join call and Upload radius 12; the chevron button is a circle. Colours were already on the system.
- [ ] The "Reserved" dashed slot is still there, untouched.
- [ ] **Progress pictures are a reminder row, not a card.** While a sheet is open and missing photos, Up next carries a "Progress pictures due" row with the same pulsing dot under the check-ins row, opening the pictures screen. Once the last one goes in the row reads "Progress pictures sent" with a tick for 24 hours, then leaves Home until the next sheet opens (the Account tab still reaches them). The purple prompt card and the "Pictures sent" card are gone.
- [ ] The check-in dot pulses while check-ins are due; the chevron beside the name has no circle; the top bar's name and icons are Ink rather than Navy on every tab; Up next is a two-tone blue.
- [ ] **Banner rewritten**: "Hello, Alex." in Baskerville, the date under it in small caps, then the main goal with a small target icon before it, and nothing at all while the coach hasn't set one. The avatar is off Home (it stays in Settings). In the plan fold-out each track is an icon and its name in the track's colour (green apple, purple dumbbell, heart for lifestyle) with the phase name on its own line under it; the chips are gone.
- [ ] Nutrition tidies: the date arrows have no circles and the one that cannot go further is hidden; the supplements count is a plain number; the logged tick has no disc; the saved note sits on the card under a "Your note" label. Training: filled and selected things inside a session (gym, exercise number, Log set, cardio Done) are Navy like the week chip.

Look: `/client` → Home.

## 54 · Client check-in on the design system — ✅ LIVE 16 Sep

Same treatment as the tabs (groups 51–53). Layout and behaviour unchanged; still Daily / Weekly with measurements inside Weekly.

- [ ] One navy: `#1e3a6e` for the logged pill, a picked scale number, the Save button and the saved banner; `#2f5d8f` for the count dot. The screen's own `#1b3f6e` / `#5987a8` / `#081F5C` are gone. Headings and values are Ink, body Text, labels Muted, hints Faint; borders `#dfe3e8`, dividers `#eceff3`; page `#F4F7FC`.
- [ ] Daily | Weekly is the standard pill switch (grey track, white active segment, navy text) instead of a filled navy segment. The back arrow has no circle.
- [ ] The card is radius 18; Save is radius 12; scale buttons and the note box radius 10. Labels use the one label recipe.
- [ ] The row and pill colour changes are off with reduced motion on.

Look: `/client` → Home → the check-in row.

## 55 · Client notifications on the design system — ✅ LIVE 16 Sep

- [ ] Archivo instead of Manrope and Newsreader; page `#F4F7FC`; Ink for unread text and the title, Muted for read text and labels, Faint for times; the unread icon circle is the tint with Navy; the unread dot and "Open" links are Accent. The old dark-theme back button (near-black ring, black on hover) is gone: the back arrow is bare, the title is centred and the "Activity" line above it is dropped.
- [ ] "Mark all as read" is a white secondary button with navy text, radius 12, instead of a filled accent pill.

Look: `/client` → the bell.

## 56 · Messages from the coach: a feed on the client side — ✅ LIVE 16 Sep

The coach's Messages tab already sent one-way notes that landed in the client's notifications as "Coach note". Now the client can read them together.

- [ ] **From {coach}**: a read-only screen listing every message the coach has sent, newest first, grouped by day, with the time on each. A line at the foot says you can't reply here. Same header as Notifications.
- [ ] **Home card**: the latest message under Up next ("From Finlay", the text, the date, "All 4 messages →"); the whole card opens the feed. Nothing on Home until the coach has sent one.
- [ ] **Notifications keep them apart**: the coach's messages are no longer mixed into the list. One row at the top, "From Finlay · 2 new messages", opens the feed; the list under it is everything else. Opening the feed marks the messages read, so the bell clears. "Mark all as read" still covers both.
- [ ] No data changes: messages are the existing `chat_messages` rows with `sender: "coach"`; the notification is still created when the message is sent.

Look: `/admin` → a client → Messages → send one; then `/client` → Home.

## 57 · Client Settings on the design system — ✅ LIVE 16 Sep

The last client tab, and the one that was still flat rows on Manrope.

- [ ] **Banner** like the other tabs: "Your account", the name (32 / 700), "Client since 7 Sep · 2 weeks in", and the profile photo row (tile, Tap to change, Remove) at the banner's foot. The top bar floats over it.
- [ ] **Every section is a card** (radius 18, hairline rows inside): Your details, Progress pictures, Progress reports, Preferences, Connected apps, Data. The first card overlaps the banner. The Coach row is out of Settings for now (nice to have, not yet); the coach profile screen itself stays.
- [ ] Archivo; page `#F4F7FC`; row titles Ink 15 / 600, details Muted, section labels the one label recipe. Toggles are navy when on with a white knob; kg · cm | lb · in is the standard pill switch; the "New" report pill is the tint with navy; Delete account is the destructive red; Log out is a white secondary button, 48px, radius 12.
- [ ] Nothing moved or renamed; the same rows and actions as before.
- [ ] **Honest rows.** Export my data, Privacy policy and the two Connect rows are not built, so they carry a "Soon" pill instead of an arrow that goes nowhere.
- [ ] **Delete account confirms first.** Tapping it opens a red panel: what deletion removes, that it can't be undone, and that the coach does it (ask on a call or by email) — nothing is deleted from the app itself. "Keep my account" closes it. Self-serve deletion is a future item.
- [ ] A line under Data says what the coach can see: check-ins, photos, logs and notes, and nobody else.
- [ ] The Weekly summary toggle (not built) and the kg · cm | lb · in row are gone from Preferences; units are chosen on the Kg | Lbs switch inside a session.
- [ ] **Your details**: a card under Coach with Email, Phone and Address as rows ("Add" where empty). Edit turns them into fields; Save posts all three. They are the same fields the coach sees on the member card, so a change reaches the coach's panel too. The contact email, not the login email. The photo is the banner's. Invoicing details are a later card. New `saveMyDetailsAction`.

Look: `/client` → Settings (the person icon).

## 58 · Progress pictures screen retouched — ✅ LIVE 16 Sep

- [ ] Archivo; page `#F4F7FC`; the header like the other pushed screens (bare back arrow, "Progress pictures" centred, the "Your progress" line above it dropped). Cards radius 18, buttons 48px radius 12, the picker sheet radius 18. Labels use the one label recipe; titles are 600 instead of 800. The purple stays — it is this screen's identity, as decided.

Look: `/client` → Settings → Progress pictures.

## 59 · The burger menu, and the Reserved box gone — ✅ LIVE 16 Sep

- [ ] **The burger opens a drawer** from the left: the wordmark with the coach's business under it ("Full Potential Coaching", hardcoded like the rail until the coach profile carries it), then three rows only: Messages from {coach}, Help (opens an email to the coach, subject "Ironline app"), and Log out at the foot with "Ironline · Full Potential Coaching" under it. Notifications has the bell and Settings has its tab, so neither is repeated here. Tapping the shaded page or a row closes it.
- [ ] The dashed "Reserved" slot at the bottom of Home is gone.
- [ ] The coach profile screen is parked: nothing opens it for now; its code and data stay.

Look: `/client` → the burger.

Commits `a3c0e90`, `c6a5e46` for groups 46–59.

## 60 · The coach's profile picture

- [ ] **A third photo slot, "Profile picture"**, on the coach's profile page (gear at the foot of the rail → Your profile): a round drop zone beside the hero and candid slots, uploaded and removed the same way. New `avatar_path` column on `coach_profiles` (migration `0003_coach_avatar`).
- [ ] **Framed before it uploads**: picking a photo opens a dialog with the picture under a round window; drag to move it, a slider to zoom (1–3×), Use photo cuts a 512 px square out as a JPEG and uploads that. Cancel or Esc drops the pick. New `AvatarCropDialog`.
- [ ] **It shows wherever the coach's initial used to**: the note on the client's Nutrition tab, the "From {coach}" row in Notifications, and the coach's own row at the foot of the admin rail. Without a picture, the initial stays.

- [ ] **And in front of everything else they wrote**: the message card on Home, each bubble in their feed (28 px, beside the bubble), the note on an exercise, and the instructions on a progress sheet, all carry the small picture before the "From …" line. New `CoachMark`, fed by a coach-identity context from the shell.

Look: `/admin/profile` → drop a photo on Profile picture; then `/client` → Nutrition (with a coach note) and the bell.

## 61 · Kg ⇄ lbs no longer drifts on every flip

- [ ] A weight typed in the box and flipped to the other unit used to be converted from the rounded figure each time, so it climbed a step per flip (60 → 132.5 → 60.25 → 133 …). The flip now remembers the exact kg behind the figure it put in the box; while the box is untouched, the next flip and the save both start from that kg. Edit the figure and what you typed wins again.

Look: `/client` → Training → an exercise with a weight → type 60, flip Kg/Lbs back and forth.

## 62 · The programme note, rebuilt — ✅ LIVE 21 Sep

- [ ] The one-line box under Days trained is gone. Nothing yet: one row, "Tell Finlay how the programme feels", with Write. Tap it and a box opens that grows with the text, Cancel and Send under it. Sent: the note in full under "Your note to Finlay · 12 Sep", with Edit; saving it empty removes it. No more bubble sitting there. Placeholder in the box: "How the programme feels, what is not working, what you want more of".

Look: `/client` → Training → under Days trained.

## 63 · Sessions and exercises fold shut, not vanish — ✅ LIVE 21 Sep

- [ ] A session body unfolds when opened and folds shut over 0.4 s when tapped closed or when the last set lands (after the "Workout complete" moment). An exercise card does the same: its body folds shut after the last set, then the next one unfolds in its place. Off with prefers-reduced-motion.

Look: `/client` → Training → log a whole exercise, then a whole session.

## 64 · Calories box: the figure sits right, the note placeholder is short — ✅ LIVE 21 Sep

- [ ] The calories figure is right-aligned against "kcal". The note under it says "Note for Finlay", no longer a sentence that cut off.

## 65 · Food diary — ✅ LIVE 21 Sep, first cut

- [ ] **Tap the ring on Nutrition** and the Food diary for today opens: what is left of the day's calories in big, eaten / target beside it, a bar, and the three macros with eaten / target and a bar each. Under it Breakfast, Lunch, Dinner, Snacks as cards, each row a food with its amount and kcal.
- [ ] **Add food** opens a sheet: search (the client's own foods first, then the catalog), pick one, choose a serving (chips with their grams, a − / + count) or type grams, see the kcal and macros for that amount, add. Recent foods show before typing. "Add your own food" takes a name, per-100 g figures and an optional serving. Tapping a row reopens the sheet to change the amount or remove it.
- [ ] **The catalog** is USDA FoodData Central (Foundation Foods + SR Legacy, public domain), 8,059 generic foods with household portions, built into `app/lib/foods/catalog.json` by `scripts/build-food-catalog.mjs`. Search is server-side (`searchFoodsAction`): every word must start a word of the name; names that start with the query first, baby / restaurant / fast foods last. English only for now; Open Food Facts for packaged foods and barcodes comes next.
- [ ] **The ring counts down**: with food logged today its centre shows kcal left instead of the target. **Logging is the client's call**: a strip attached under the rings says "1,846 kcal eaten today" with **Log calories**; pressing it writes the day's total into the calorie log (`source: "diary"`, with the day type), so the Calories card, Last 7 days and the coach's side read it as before. Once logged the strip turns green with a tick; add a yogurt later and it offers **Update log**. Works on any past day in the month, so a late entry can still be logged. Nothing is written silently.
- [ ] **Everyday foods first**: "white rice" shows "White rice, cooked" and "White rice, uncooked" at the top under plain names (172 such foods in `app/lib/foods/common.json`, built by `scripts/build-common-foods.mjs`), and the catalogue's 34 rice rows sit behind "Show 34 more from the catalogue".
- [ ] **A day at a time**: arrows under the title (and a sideways swipe on the summary) step back through the last 30 days; other days are read through `getFoodDiaryAction`, and the day is re-read after every change.
- [ ] **More meals**: "Add a meal" under the four standard ones ("Pre-workout"); an empty added meal has Remove. New table `food_meals` (migration `0005_food_meals`).
- [ ] **Copy a meal**: the add sheet has a second tab listing meals with food in them from the last two weeks ("Yesterday · Breakfast · 520 kcal, Oats, Banana, Milk"); one tap copies the same foods and amounts into the meal being filled.
- [ ] **The counter is a ring**: it fills as the day is eaten and the kcal left counts down inside it (turning warning-orange once over); eaten / target beside it and the three macros with bars. Figures run to their new values.
- [ ] **Retouched to the design reference (Food Diary v2)**: on the client page model — the top bar with a back arrow in place of the burger, a banner with "FOOD DIARY" and the day ("Today", "Monday, 14 Sep"), a Mon–Sun week strip with arrows (selected day white, a dot on days with food, future days locked), the targets card pulled up over the banner (ring 104 with kcal left, the three macros with bars, then "526 / 2,929 kcal eaten" and a standing pill: "2,403 to go" / "On target" from 90 % / "180 over"). The meals are one card with hairlines between them, "N items" or "Nothing logged yet" under each name, a kcal or EMPTY pill, and Add food as a text button with a plus circle. "Add a meal" is a secondary button that opens a dialog (name, suggestion chips, Cancel / Add meal). A swipe over 60 px on the page steps a day.
- [ ] **Second pass on the retouch**: a Training day / Rest day choice in the banner (saved per date in `food_days`, migration `0006_food_days`; the calorie log the coach reads says the same); the targets card is the Nutrition card's own rings and macro rows, one ring per macro filling as the day is eaten, kcal left in the centre, figures in Archivo — the footer line and the "to go" pill are gone. The week strip cells line up (the diary's classes are `fdi-` now; `fd-` belonged to the coach's feed and was pushing every day but Monday down). Add food happens inside the meal: a search box with the matches under it, then the amount as one number box and one unit box (g, oz, ml and l for liquids — the density comes from the catalogue's fluid-ounce or cup weight, your own foods count as water — and the food's own portions such as "cup (158 g)"; changing the unit keeps the weight; the entry stores grams), then Add; a row opens the same panel to change or remove. Meals can be rearranged: hold a meal's name and it lifts (a short buzz on phones that can), drag it up or down and the others slide out of the way, let go and the order is saved (kept on the client's row). A short tap on the name folds the meal to its name and figures, so six items don't fill the screen; the figures in the tiles run up as food is added, like the ring. The suggestion chips in the new-meal dialog are gone.
- [ ] **Search fallback**: when the exact match is thin ("roasted potatoes" hits two frozen rows), rows matching most of the words follow, best first, so the potatoes are still there under Show more. **The food's facts** in the amount panel are four tiles per 100 g: kcal, protein, carbs, fat in the macro colours.
- [ ] **Saved meals**: an empty meal has just a plus in its head; once it has food, **Add food** sits bottom left and **Save meal** bottom right (it reads "Saved as My breakfast" instead while the meal still matches one already saved); it asks for a name ("My breakfast") and keeps the foods and amounts (`saved_meals`, migration `0007_saved_meals`). Under "Copy a meal" the saved meals come first, then other days; one tap adds the whole meal, × forgets it. The "2 items" line is gone; under the meal name sit four tiles with the meal's calories, protein, carbs and fat.
- [ ] **Packaged products and barcodes (Open Food Facts)**: under the search results, **Search packaged products** asks Open Food Facts by name (their newer search service, the older one as fallback) and lists brand, pack size and the per-100 g figures; one tap adds it. A scan button on the right of the search bar opens the camera (the browser's own barcode reader on Android, ZXing on iPhones), reads an EAN / UPC, looks it up and lands on the amount panel; the barcode can be typed too. Every product fetched is kept in `off_foods` (migration `0008_off_foods`), shared by all clients, so it is instant next time, found by the normal search, and there when Open Food Facts is down. Our server makes the calls; the phone only talks to Ironline. New dependency `@zxing/browser`.
- [ ] **A meal added belongs to its day** (`food_meals.date`; a copied or saved day recreates a same-named meal on the target day). Food rows read name, then amount · kcal, with a bin on the right that asks Keep / Remove in place; the × on a saved day or meal asks Keep / Forget the same way.
- [ ] **Whole days**: on a day with nothing logged, a card offers "Same as yesterday?" (the last day with food) with Copy, and above it any days the client saved with Use (× forgets one). Under the meals on a day with food, **Save this day** asks for a name ("Training day") and keeps every meal (`saved_days`, migration `0009_saved_days`). Copy a meal lists saved meals only. An added meal that is still empty shows "Remove this meal" inside its fold rather than in its head, so every head reads the same.
- [ ] New tables `food_entries` and `custom_foods` (migration `0004_food_diary`). Entries keep a snapshot of the kcal and macros for the amount.

Look: `/client` → Nutrition → tap the ring.

## 66 · Home: the phases as swipeable frosted cards — ✅ LIVE 21 Sep

- [ ] The chevron beside the greeting is gone. Under the main goal sits a row of cards, one per track (Nutrition, Training, Lifestyle), swiped sideways with snapping and dots underneath. Each card is frosted glass tinted the track's colour (the banner shows through), with the track tag and time to go, the phase name, a bar that fills in as the card appears, Week x of y, Up next, and the coach's note on the phase when there is one (a nutrition phase's note today).

Look: `/client` → Home, under the goal line.

## 67 · Nutrition tab: the typed calorie log card is gone — ✅ LIVE 17 Sep

- [x] Calories are logged from the food diary now (the strip under the rings), so the card with the day stepper, the kcal box and the note is off the Nutrition tab. Last 7 days stays and reads the same log. The ring shows the coach's targets again; the countdown lives in the diary.

## 68 · The phase header: one band, on all three coach tabs — ✅ LIVE 21 Sep

- [ ] **The phase name is the switcher.** Training, Nutrition and Measurements were each two cards — a rail of chips, then an "EDITING …" band repeating the same name under it. They are one card now, and its top is one band: the eyebrow (PROGRAMME / NUTRITION PHASE / LIFESTYLE PHASE), the phase name at 21px as a button with a chevron tile, and under it a line built from what is true — `Aug 18 – Sep 28 · week 5 of 6 · 2 scheduled after this`, or `No dates yet · 4 weeks planned`.
- [ ] **The menu** opens under the name: Live now · Scheduled · Draft, each row a state dot, the name and its dates, with the past folded behind "3 earlier phases". ↑/↓ walk it, Enter picks, Esc closes back onto the switcher. **"+ New phase" lives only here** — it is off the tabs everywhere else.
- [ ] **On the right, three things and no sentence**: the state (a pulsing dot + LIVE, a dotted ring + SCHEDULED, a dashed ring + DRAFT), the one action that state has (a draft gets **Schedule it**, a scheduled phase **Make it live**, a live one none), and **Edit dates**. The "Live in Alex's app / changes save as you go" strip on Measurements is gone — the LIVE chip said it already.
- [ ] **The phase is in the address** (`?phase=`), so a coach can link one. Training and Nutrition swap in place; Measurements navigates, because the server decides which metrics the phase asks for.
- [ ] **Training**: the programme chips and the inline name field are gone. Naming a draft and picking when it goes out now happen in one dialog behind Schedule it / Edit dates (with **Deploy now** in it); once it has been sent, Edit dates opens its phase on the Plan tab. The client's gyms and the column menus moved down to the week toolbar, where the table they belong to is.
- [ ] **The state sits under the buttons, not in front of them.** LIVE / SCHEDULED / DRAFT was level with the eyebrow at the head of the action row, which put a word that never changes at the start of a row you read for its actions — and made the three tabs look unlike each other whenever one carried an extra control. Actions on the top line, what the phase IS on the line under, both hard right, the same on all three tabs.
- [ ] **The phase dialog's track is no longer locked to the tab you opened it from.** "+ New phase" on Nutrition can make a lifestyle phase. Still locked for a phase that IS a training programme: switching its track would leave the programme with nothing pointing at it.
- [ ] One component, one prop set: `PhaseHeader` + `usePhases`. `ProgramDeployControls` and `ProgramNameForm` are gone, and with them `.pb-editing*`, `.pb-live-*`, `.nw-phase*`, `.mx-rail*` and `.ms-topbar` in the stylesheet.

Look: `/admin` → any client → Training, Nutrition, Measurements.

## 69 · The client card: edited in a dialog, and the header stops repeating it — ✅ LIVE 21 Sep

- [ ] **The chevron beside the client's name is gone.** It unfolded age, client since, address and email — a read-only copy of four of Member info's fields, with Member info sitting on the same screen with an Edit on it. The header is the face, the name and Message.
- [ ] **Member info, Coaching info and Coach note wear the page's banner** — the accent tint with navy letters, the same one the dialog that edits them has. A grey strip made them read as a footnote beside the tinted cards next to them.
- [ ] **Member info and Coaching info open in a dialog.** In the narrow card on Home, Edit used to stack seven inputs boxed at 148px inside a 180px column. The dialog keeps the rows exactly as they read — label left, value right, a hairline between — and the input **is** the value: transparent at rest, outlined on hover, white with a navy border on focus. No boxes sitting there doing nothing. Esc and the scrim close it, and "Add" on an empty row still opens the dialog with the cursor in that field.
- [ ] **Save is navy, everywhere.** `.ad-btn-primary` was green `#3f6e46`; green is a status colour (on target, done) and a Save button is not a status — UI-GUIDELINES §3 and §10 both call for this. It changes every admin dialog's confirm button, which is the point.
- [ ] Fixed while in there: the card's `Section` wrapper was built during render, so it was a new component type on every keystroke — which remounted `PanelSection` and threw away whether the coach had it open.

Look: `/admin` → any client → Home, the two cards on the right.

## 70 · Keeping up, rebuilt as a scoreboard — ✅ LIVE 21 Sep

- [ ] **Three behaviours, and one score.** *Sets logged* is gone: the client's app will not complete a session without every set in it, so it could never disagree with *Sessions done* — the same fact drawn twice. *Measurements* is gone: those are fields inside the weekly check-in, so counting them separately counted one Sunday evening as two things. *Daily* and *Weekly check-ins* are now one **Check-ins** figure. *Progress pictures* is gone too: a sheet is something the coach asks for now and then, not a habit, and one missed sheet swung the whole figure by a quarter. What is left is the three things a client does or does not do: **train · answer · write down what they ate**.
- [ ] **How a daily thing and a weekly thing sit in one score.** Each behaviour is scored as `done ÷ asked` **before** anything is averaged, and the overall is the mean of those three rates — so each is an equal third whatever its rhythm. Pooling the events instead would have made training an eighth of the score (58 daily slots against 8 sessions), and a client could have stopped training altogether while the number barely moved.
- [ ] **One window, and it moves**: the thirty days ending today, so tomorrow it is the thirty ending tomorrow. The 7 / 30 switch is gone — a card with a switch on it asks the coach a question before it answers one. Each row is just the count over those days: `4 of 9 sessions`, `13 of 33 check-ins`, `6 of 29 days` (29, not 30: today is not missed until it is over).
- [ ] **A trend**, which is what makes it a scoreboard rather than a snapshot: the same calculation over the thirty days before those thirty. "▼ 3 on the 30 days before", and "nothing to compare yet" until there is a month behind it.
- [ ] **A skipped session counts against the total now.** It used to drop out of the denominator — telling the coach is the behaviour you want — but then the figure did not match the sessions a coach can count on the builder, and "4 of 9" has to be checkable against what is on screen there. The daily rows still carry their streak.
- [ ] **Linked to what the client is actually asked for.** Check-ins count against `listMetricDefinitions` — the same query `getCheckInSections` builds the client's own check-in screen from — so adherence is never measured against a set they were never shown. Food logged counts over the same days the daily check-in does (today is not missed until it is over).
- [ ] **A real bug in the count-up, fixed at the source** (`components/useTween`, shared with the client's calorie rings): with no animation frames — a window behind another window, a background tab — the figure sat on its OLD value while the label beside it said the new thing. A wrong number, not a missing animation. A timer now lands it whatever the compositor is doing.
- [ ] **Figures on the coach side are Archivo**, 700, tabular — not Newsreader. See UI-GUIDELINES §1; the rules are one block at the foot of `globals.css`. Titles keep the serif.

Look: `/admin` → any client → Home, the Keeping up card.

## 72 · The stat strip, built like a date chip — ✅ LIVE 21 Sep

- [ ] **Each fact is a chip**: its name on a tinted band with navy letters, a line under it, then the figure on white — the shape the date already has on a meeting card. Six across, and the eye reads a row rather than pairing six labels with six numbers.
- [ ] **Training is black.** "0 of 3" was amber whenever nothing had been logged yet, which coloured Monday morning as a problem. "Done this week" under it reads "sessions this week", since the label above already says Training.
- [ ] **Kcal goal → Nutrition goal**: `2,929 kcal` with `P 235 · C 315 · F 81` under it. A coach reading 2,929 wants to know whether that is 235g of protein or 120.
- [ ] **Weight carries its unit** — `90 kg` — and the line under it is the move **in the phase the client is in now**, not since they signed up: inside a cut, "−0.8 kg this phase" is what a coach acts on. The baseline is whichever reading sits nearest the day the phase began, either side of it, and falls back to the coaching figure when the nearest is more than a month away.
- [ ] **Metrics tracked breaks down**: `13` over `7 daily · 6 weekly`.

Look: `/admin` → any client → Home, the top card.

## 73 · Plan: Main goal wears the same head as Phases and Goals — ✅ LIVE 21 Sep

- [ ] The tinted band with the name in navy and the helper under it, and "Saved 16 Sep, 11:37" on the right where the other two keep their controls. It was the one card on the tab in a plain white strip, which made it read as a caption above the page rather than the first of three cards.

Look: `/admin` → any client → Plan.

## 71 · Activity and Feed: four categories, fifteen to a page — ✅ LIVE 21 Sep

- [ ] **"Needs you" is off for now** (`SHOW_NEEDS_YOU` in `ClientHomeFeed.tsx`, one line to bring back). It was three rows of "they have not filled it in yet" sitting between the score that already says so and the activity that shows it. Nothing about how the actions are worked out has changed, and the rail's amber dot and the tab counts still read the same list.
- [ ] **No "All".** Both the Activity card on a client's Home and the rail's Feed read one kind at a time: **Training · Nutrition · Measurements · Invoices**. Every source category still has a home, so nothing is unreachable — a note the client wrote on their programme is training, an invoice is billing. The chips carry what is new inside each kind.
- [ ] **Fifteen rows to a page**, with pages rather than a Show more that grows forever. One pager (`.pg-*`) for both: links on the Feed, because its page is in the address (`?cat=&page=`), buttons on Home, because every event is already loaded there. Home's "Full history →" carries the category across.

Look: `/admin` → any client → Home, the Activity card. And the rail's Feed.

## 74 · Popups that go where they fit — ✅ LIVE 21 Sep, fixes a LIVE bug

Finlay could not add an exercise: the picker opened downward at a flat 420px from the last row of a day's table, which put the list, “+ Add new exercise” and the save form under the bottom of the window, where nothing scrolls them back. Two more of the same family turned up with it.

- [ ] **One helper, `app/components/popover.ts`.** Position fixed, so a scrolling ancestor cannot clip it — `.ad-main` sets `overflow-y: auto`, and CSS will not let one axis scroll while the other stays visible, so the whole working column clips sideways too. Then measured against the window: drop below when there is room, flip above when there is more room up there, and cap the height to what is actually there so the list scrolls inside itself.
- [ ] **The exercise picker** (the live bug) and **Client gyms**, which was losing its left half to that same column clip, both go through it. Both also re-place on scroll and resize, since fixed does not follow the row it hangs off.
- [ ] **“+ Add week” opens under the button you clicked.** It was `position: absolute; top: 66px; left: 0` — pinned to the left edge of the rail, so on a five-week programme it appeared a whole rail away from the “+ Add week” you pressed.

Checked at 1440×760: a trigger 87px from the bottom now flips above and sits fully on screen where it used to overflow by 337px. At 900×300, where nothing fits either way, all three stay on screen and scroll internally.

Look: `/admin` → a client → Training → a day's “Add exercise…”, the Client gyms pill, and “+ Add week”.

## 75 · The phase band and the gyms list, tidied — ✅ LIVE 21 Sep

- [ ] **LIVE / SCHEDULED / DRAFT sits at the foot of the band**, not hanging just under the buttons with empty space below it, and it is bigger: 13px with a 10px dot.
- [ ] **The line under a phase name is the span and its length, full stop** — `Aug 17 – Sep 20 · week 5 of 5`. “2 scheduled after this” is gone: it came and went with the data rather than with the phase, so the same line read differently on Training and on Nutrition for no reason a coach could see, and what is queued behind is one click away in the menu.
- [ ] **A gym row is the name, a bare house, Delete.** The house has lost its pill and its tick and moved next to Delete; the main gym is simply lit navy. The word “Main” beside the name is gone — the circle, the tick and the label were three ways of saying one thing.


## 76 · Fixing the class instead of the instance — ✅ LIVE 21 Sep

Three notes kept coming back — a serif number, a header not on the tint, a clipped menu — because each was fixed where it was spotted rather than everywhere it existed.

- [ ] **Serif figures are swept at the token.** `body:has(.ad-shell)` now resolves `--font-serif` to the body face, so nothing in the admin can render a figure in Newsreader — including the screens nobody has opened yet. Dialog titles opt back in by name. This replaces the list of selectors, which guaranteed a fresh report on every unvisited screen. Checked: 17 of 19 admin figure classes are Archivo, the two left are the dialog titles.
- [ ] **A fourth clipped popover, found by grep rather than by Finlay**: the Exercise / Cardio columns menus were `position: absolute` in the same scrolling column as the gyms pill. Now on `placePopover()` with the other three.
- [ ] **`npm run audit:ui`** greps for all of it — retired colours, faces set directly, absolute menus, card labels outside a header band. Heuristic, not a linter. It currently reports 166 things, nearly all retired colours in screens that have not been converted yet, which is the honest backlog rather than a clean bill.
- [ ] **UI-GUIDELINES §12** records the mechanism behind each rule, so the next fix is the class.

## 77 · Nutrition: the macro bar says what the label says — ✅ LIVE 21 Sep

- [ ] The bar under each macro was `grams ÷ the heaviest macro`, so carbs sat at 100% whatever the split — they are almost always heaviest by weight — while the line above it said 43% kcal. Two scales on one row, with the label inviting you to read the bar as that percentage. Fat agreeing with its label was a coincidence of 9 kcal/g against 81g of 315g. It is the calorie share now.

## 78 · The system, settled — ✅ LIVE 21 Sep

Four decisions taken once and applied everywhere, instead of screen by screen.

- [ ] **The executing button.** One question decides it: does this commit something? Add, Save, Apply, Deploy, Schedule, Make it live — navy fill, white letters, radius 8, one per card. Defined once in `globals.css` for every class that plays the role, so a new screen joins the list rather than inventing a fill. It caught “Deploy now” in green, “Save to library” in accent blue, “Copy week split” in a third blue and “+ Add” as bare text. A primary on the navy pending bar inverts.
- [ ] **Two levels of heading, and only two.** A card’s header is the tinted band with navy letters. A section inside it is **white with navy letters** — same voice, no fill, so the header still sits above its sections. Grey-on-grey read as a caption nobody had finished.
- [ ] **Adding a row is never filled**: dashed or bare, navy letters. It opens something; it does not write anything.
- [ ] **A figure is black** unless it needs the coach to act. A colour on a number always means “this one”.
- [ ] **The retired colours are swept** — 84 replacements at the token and in literals. The macro and category hues stay (§3 keeps them), and `#f8f9fb` stays as a surface since it is retired only as a page colour.
- [ ] **`npm run audit:ui` reads zero.** Getting it there found a fifth clipped popover the first version of the check had missed, because its rule spanned several lines; it reads whole rule blocks now. Every exception it allows carries the reason it was allowed.

## 79 · A style page you can look at — ✅ LIVE 21 Sep

- [ ] **Style, in the rail** (`?view=style`). The house style rendered from the REAL classes — it imports the same `PhaseHeader` and the same `globals.css` the product does, so it cannot drift from what ships. Buttons in every role, both heading levels, the phase band in each state, the figure strip, thirteen swatches with what each is for, the pager. A written guide cannot be checked against a screen; this can.
- [ ] **Supplements: “+ Add item” moved inside the block.** On the strip it sat beside a folded section, offering to add a row to something not on screen — and it was filled navy, which says “this writes”, when adding a row only stages one for the bar at the foot. It is at the foot of the list now, dashed with navy letters.
- [ ] **The exercise table’s last column lost its rule.** The pinned bin column drew a hard edge beside “What the client did” — the widest, most-read column — for the sake of a 22px icon. The barrier is still there and Add is still pinned; it just cannot be seen, and the 40px went to the logged column (290 → 330).

## 80 · One bin, and the line that was never the bin’s — ✅ LIVE 21 Sep

- [ ] **The line beside “What the client did” is gone — properly this time.** The first attempt removed `border-left` from the pinned bin column and changed nothing on screen, because the rule that draws it is the LOGGED column’s own `border-right`, inherited from the generic `td` rule since logged-col is second to last, not last. Measured after: logged-col right border `0px`, bin column 37px, and the logged column went 290 → 330px.
- [ ] **The bin is the same everywhere.** Bare and grey where it sits, red on a soft tint when you reach for it — the Supplements one. Training had a bordered white box: a small icon in a visible container, taking the width of a real control for something almost never pressed. Every delete in the coach app renders as `.row-icon-danger` or `.nw-remove-btn`, so two selectors covered all of them — exercise rows, sessions, weeks, supplements, metrics. Checked with a real pointer: hover gives `#fbeaea` and `#a32d2d` on both.
- [ ] It is on the style page now, so “is this the right bin” has somewhere to be answered.

## 81 · One bin, and the dropdown stops jumping — ✅ LIVE 21 Sep

- [ ] **One bin icon.** There were two trash drawings: the shared one in `icons.tsx` and a heavier copy defined inside `NutritionWorkspace`. The Supplements bin was the heavier one — which is the one that reads at 14px — so that is now the shared icon, the copy is gone, and every bin in the app draws the same glyph.
- [ ] **One bin style, in the real markup.** `.nw-remove button` was styling the Supplements bin as a descendant selector, which out-specified `.nw-remove-btn` — so the shared rule was silently losing in the one place it mattered. My first check missed it because I measured a button that was NOT inside `.nw-remove`. Removed; one selector owns the bin. Both now measure 30×30, transparent, `#8b93a1`, red `#a32d2d` on `#fbeaea` when hovered.
- [ ] **The client’s food diary bin** joins it — same grey, same red, 40px target instead of 30 because a phone needs the tap area, and on `:active` as well as `:hover` because phones do not hover.
- [ ] **The picker no longer jumps to the top of the screen.** When it flipped above the trigger it subtracted the MAXIMUM height (420px), but a popup is only as tall as its contents — a search box and one group is about 115px — so a short list landed 300px above where it belonged. Opening upward now pins the popup’s BOTTOM edge just over the trigger, so its height never has to be known in advance. Measured: 4px between the two, exactly the configured gap.

## 82 · Goals: the goal is the button — ✅ LIVE 21 Sep

- [ ] **Edit is gone; clicking the goal opens it.** A row whose whole subject is one goal does not need a word beside it saying so. The name and its rule are the button now — it underlines and goes navy on hover, and takes a focus ring.
- [ ] **Remove is the standard bin**, not a red word. Same glyph, same grey, same red on hover as every other bin in the app. The actions column went 84px → 44px and the width went to the goal.

## 83 · The track chips only where the track is a question — ✅ LIVE 21 Sep

- [ ] **The phase dialog shows the Track chips in exactly one place**: the Plan screen’s “Add phase”, which is the only way in that is not already about one track. Editing never changes a track — a training phase is a training phase — and adding from Training, Nutrition, Measurements or a row of the Plan grid already said which track you meant by where you clicked.
- [ ] The value still posts either way (it always came from a hidden input, not the chips), and the header keeps its track tag, so nothing is lost by hiding the choice. The prop is `chooseTrack`, opt-IN — a new call site gets no chips unless it asks, which is the safer default than the old `lockTrack`.

## 84 · Training: the week chips start where the current week is — ✅ LIVE 21 Sep

- [ ] **The row always opens in the same place.** The week strip scrolls the current week to a fixed spot — just in from the left, with a 20px sliver of last week behind it so the row reads as scrollable. It used to put the PREVIOUS week flush left, which pushed the current week to the middle of the row. Week 1 has nothing to peek at and sits flush left; the last weeks cannot scroll that far, so the current week drifts right on its own.
- [ ] **It stays inside the page.** The strip was bleeding 22px past the right gutter, so the last chip ran off the screen edge. It now starts and ends on the same line as the cards below it (16px), pulling 6px out of the banner's own 22px gutter to get there.

## 85 · The working area stops resizing itself — ✅ LIVE 21 Sep

- [ ] **The scrollbar no longer squeezes the page.** `.ad-main` reserves the scrollbar's width whether or not the tab is long enough to need one, so going from a short tab (Measurements) to a long one (Nutrition) doesn't narrow everything by 15px. Nothing moves when you switch tabs any more.

## 86 · One set of macro colours — ✅ LIVE 21 Sep

- [ ] **Protein blue, carbs amber, fat green — everywhere.** The coach's day targets had their own palette (protein steel blue, carbs GREEN, fat brown) while the logged-days table and the client's food diary used another, so carbs changed colour halfway down the same screen. The targets now use the log's palette.
- [ ] **They are tokens now**, `--macro-protein` / `--macro-carbs` / `--macro-fat` in `globals.css`, so the next thing that draws a macro cannot pick its own. The food diary's rings still spell the hex out — they are SVG presentation attributes, where `var()` does not resolve — with a comment saying why.

## 87 · Nutrition log: the meal is its name — ✅ LIVE 21 Sep

- [ ] **No more clock times.** An opened day listed "Breakfast 08:36", stamped from whenever the first food went in — which is when it was TYPED, not when it was eaten, so it was a fact about the phone rather than the meal. The row is the meal's name now, and the query has stopped working the time out.

## 88 · Photograph the meal — ✅ LIVE 21 Sep (client side first, coach side with the rest)
Commit `86a3313` (the client camera, storage, `/uploads/meals`, and the `meal_photos` Postgres table, migration 0010). The coach's camera lives in the logged-days table (group 87 and before), which is not live yet, so Finlay sees the pictures once that ships.


- [ ] **A camera on every meal row in the food diary**, at the far right, with the + moved in beside it. The + goes when the meal is open and the camera does not, so it is always the last thing on the row rather than something that slides to the edge. Tapping it opens the phone's camera or library; the picture replaces whatever was there before, one per meal.
- [ ] **The client can see and undo it**: the camera turns green once there is a picture, and tapping it opens the shot full width with Replace and Remove, and a line saying only the coach sees it.
- [ ] **The coach sees a camera on that meal's row** in Nutrition → logged days, past the macros, only where there is a picture; clicking it opens the shot. Rows without one keep an empty cell so the macro columns stay in line.
- [ ] **Stored like the progress pictures**: `/uploads/meals/<client>/<date>/<meal>.jpg` on the volume, copied into the bucket, served through the `/uploads` route behind the same per-client access check — a guessed URL gets a 404. Taking a new picture deletes the old file rather than orphaning it, and the workspace reset clears them with the rest of a client's data.

## 89 · Saved days: the Forget question lets go — ✅ LIVE 21 Sep

- [ ] **A tap anywhere else drops it.** Holding a saved day asks Keep / Forget in red; before, only Keep undid that, and folding Saved days and opening it again brought the red row straight back. Now any tap outside the two buttons drops the question, and folding the list drops it too.
- [ ] **Same for the other two questions** built the same way — removing a logged food and forgetting a saved meal — so none of the three can be left hanging.

## 90 · Training builder: one table at a time, and the bins tidied away — ✅ LIVE 21 Sep

- [ ] **Dumbbell / heart toggle on every session row.** A session shows its exercises OR its cardio, never one under the other. Icons only, the picked one filled navy; picking one on a folded session opens it on that table. A session with cardio and no exercises opens on cardio. Both tables stay mounted underneath, so a half-typed add row survives a look at the other.
- [ ] **Cardio has its own columns now.** It used to be squeezed into the exercise table's grid — its fields in the exercise columns' slots, blanks between, notes in the last slot, an empty "logged" column. Now it is Activity, each cardio column the coach has on, then Notes taking the rest. The "Exercises" / "Cardio" bands inside the session are gone; the toggle names what is on screen.
- [ ] **⋯ replaces the bin on the session row.** It opens Duplicate session (the same dialog Copy opened: a new session, or over another one, optionally in the later weeks) and Delete session in red (the same confirm as before). Duplicate now shows for cardio-only sessions too — the copy always carried cardio; the button just was not offered.
- [ ] **Toggling keeps the table's shape.** The grip column and the Exercise / Activity column are exactly 22 + 210px in both tables, so the add pill is the same length on both sides. The cause: every exercise column had a fixed width, so on a wide screen the browser shared the spare width across all of them and Exercise grew past 210, while cardio gave its spare width to Notes. Now the exercise table's spare width goes to "What the client did" (290px at least) and cardio's to Notes (220px at least).
- [ ] **Cardio rows drag into order** by the same grip as exercises (one shared drag, `useRowDrag`). The new order waits on the session's Apply bar ("Walk moved to #1") like every other change, and "also in the remaining weeks" carries it by name.
- [ ] **Distance and Time are no longer exercise columns.** They belong to cardio, which has its own. The exercise menu offers the six it should (Sets, Reps, Weight, RPE, Tempo, Rest) plus your own; a client who had Distance or Time switched on for exercises just stops seeing it, and what was typed there stays on the exercise.
- [ ] **No empty column at the end of the tables.** The 58px column that held the bins and "+ Add" is gone: "What the client did" runs to the edge (its legend with it), and each exercise's bin sits at the right end of that cell, pinned while the sets scroll; "+ Add" sits there on the add row. Cardio the same, at the end of Notes.
- [ ] **The week bin left the week pill.** It sits at the far right of the selected week's heading ("Week 1 · 0 of 0 sessions"). Same rule as before: live and past weeks, and the only week left, have none.

## 91 · The phase dialog, one for every track, and the colour rule — ✅ LIVE 21 Sep

- [ ] **The state picks the colour, the track picks the tag.** One helper, `app/admin/phaseChrome.ts`, decides every phase colour: a LIVE phase wears its track's colours (nutrition green, training purple, lifestyle beige), every SCHEDULED phase on every track is the same blue (`#eef3f9` / `#1e3a6e`), a DRAFT is peach (`#fdf3ee` / `#b3471d`) with a dashed edge. Dashed now means draft and nothing else. The state is worked out from the dates on every render, never stored.
- [ ] **Everything that draws a phase uses it**: the dialog, the Plan timeline's bars (scheduled bars are blue now, drafts peach; the legend gained "scheduled"), the all-clients Phases view, and the phase header strip on Training / Nutrition / Measurements. The strip's band is the one exception, on request: it is always its TAB's colour (Nutrition green, Training purple, Measurements beige) whatever the state, and the state is the chip beside it, in the state's colours (white when live, so it doesn't vanish into the band). A draft band keeps its dashed edge.
- [ ] **One dialog to schedule or edit a phase** on Plan, Training, Nutrition and Measurements. The old "Schedule this phase" pop-up is the same component in its schedule mode. 520px, header with the track tag and a state chip, name, then **Start / End as two fields with exactly one armed** (its ring says which end the next click sets; picking a start arms End, picking an end arms Start, a click before the start moves the start). The "Click the start" line is gone.
- [ ] **The calendar never changes height.** Always 42 days / six 38px rows, whatever the month (it used to be five or six rows, so the dialog jumped as you paged); neighbouring months' days in grey and still clickable. A week-number column leads each row and numbers the selected weeks in the state colour. The selection is a band with a solid pill at each end, one bar per week; for a draft, a dashed edge too. Other phases on the track are a short grey bar under the date, red where they fall inside the selection. Measured: 238px grid and the same body height across eight months.
- [ ] **Length row**: "8 weeks" over "W37 → W44 · 56 days", or "Overlaps a phase already on this track" in red (a warning, not a block). **4 / 6 / 8 / 12 wk** pills set the end from the start, never moving the start; the matching one fills in the state colour.
- [ ] **Footer never scrolls**: Delete as red text far left (still asks first), Cancel, Save. Save is off until there is a name and dates.
- [ ] Kept from before: the training phase's programme choices (link a programme, add or delete programme weeks with the phase), a live programme's locked start, a scheduled training phase's length following its programme, the "this phase is live" confirm.
- [ ] Not changed: a draft programme with no phase yet still opens its own "name it and when it goes out" dialog on Training (date + time), since there is no phase to edit until it is sent. The reference file `Ironline Phase Dialog.dc.html` was not on this machine, so this was built from the written spec. Two deliberate readings: the calendar's columns have no gap (rows keep 2px) so a selected week reads as one bar, and a PAST phase keeps its track's colours.

## 92 · Every phase tab opens on the live phase — ✅ LIVE 21 Sep (fixes a live bug in the Training half)

- [ ] **Training showed a scheduled programme as live and hid the running one under Past.** Moving a deployed programme's phase to a later week (allowed while nothing is logged in it) moved its deploy date forward but left it "deployed", and the live programme was picked as the deployed one with the LATEST start — so the future one won. Client 1: Calistenia (running, week 5) was listed as past; "yeyeyeyyeyey" (starts Oct 5) as live. The client app reads the same function, so it would have shown the client the wrong programme too.
- [ ] **Fixed three ways**: the live programme is now the latest deployed one that has STARTED; moving a deployed programme's start into a later week turns it back into a schedule (it goes live on that week by itself, like any other); and the ones already in that state are mended on the next page load (checked on a copy of the local data: Calistenia live, yeyeyeyyeyey scheduled for Oct 5).
- [ ] **Nutrition opened on a scheduled phase.** The phase in the address (`?phase=`) was shared by all three tabs, but Training writes a programme id there and the others a phase id — Training's "18" opened Nutrition on nutrition phase 18 ("fgh", scheduled). Now the address's phase only applies to the tab it came with, and switching tabs drops it, so each tab opens on its live phase.

## 93 · New client: a two-step dialog that makes the login too — ✅ LIVE 21 Sep

- [ ] **New client opens a dialog instead of making a blank "New client" and a half-open card.** Step 1, Member info: first and last name, birthdate with the age beside it ("31 years old", worked out by month and day, never stored), Male / Female / Other pills, height in cm, starting weight in kg, email (full width, it is also the login), phone as a dial code (NL +31 first, twenty in the order this business meets them) plus the number, address. Step 2, App access: the login email mirrored from step 1 ("Same as above"), a temporary password `Iron-XXXXXX` from letters that survive being read aloud (no O/0, I/1/l) with New and Copy, and "Email the invite now".
- [ ] **Nothing is written until the last button**; Cancel, Escape or × drop it all. The last button makes the member record and the login together (flagged to change password at first sign-in); if the login cannot be made the record is removed again. The email is checked for an existing account as the coach leaves the field (red hairline, and the footer says so), not at save. Next and Create are genuinely disabled until first name, last name and a valid email are there. On success the dialog closes onto the new client's Home.
- [ ] **Phone is two fields now**: the dial code and the national number are stored apart and joined only for show ("+31 6 45787628"). Phones typed before this keep exactly what was typed, with no code picked — no country is guessed out of them.
- [ ] **The Member info / Coaching info editor uses the same rows** (`InfoRow`, shared with the dialog): label over value, a hairline under it, the input is the value; two columns; Birthdate shows the age, Gender is the pills, Phone the dial code + number. Change the row once and both change. The old label-left row styles are gone.
- [ ] ⚠ **The invite email is not live yet**: the app had no way to send email. It is built (`app/lib/mail.ts`, through Resend) but stays off until `RESEND_API_KEY` and `MAIL_FROM` (a sender on a domain verified in Resend) are set on Railway. Until then the box is greyed with "Email isn't set up on this app yet, so give them the login yourself" and the button reads "Create client". If an invite fails once it is on, the client is still made and the dialog stays open to copy the login from.

## 94 · Keeping up counts from the client's first day — ✅ LIVE 21 Sep

- [ ] **A new client was scored against days before they started.** The window is the last 30 days, and every one of them counted: a client 18 days in with every check-in done read "18 of 33 check-ins", 55%, and food "13 of 29 days". Now counting starts on the client's first day (the first day they logged anything, or the day their login was made if nothing yet), the sub-line says "since 3 Sep" instead of "last 30 days", and the trend against the 30 days before stays quiet when there were none. Checked: 18 of 18 reads 100%; a client who stopped after 5 days reads 5 of 18.

## 95 · Activity is a history, the rows line up, and the Move dialog matches — ✅ LIVE 21 Sep

- [ ] **Activity is not a notifications list any more**: no "12 new since you last looked", no orange dots or tinted rows, no counts on the filters, no Mark all seen. The dots on the tabs are what say something new came in. A row still opens its tab.
- [ ] **Nothing overlaps in Activity or the Feed**: the tag column fits the longest tag ("MEASUREMENTS" needs 114px; it had 92, so it ran into the text on every row). The Feed's column went 112 → 124 for the same reason.
- [ ] **The pager's ends are two chevrons**, on Home's Activity, the Feed and the style page; "Full history →" is gone from Activity.
- [ ] **Phases → Ending soon lines up**: the track pill sits in a column of its own, one width for all three tracks, text centred and centred in the row, so every name starts on the same line. The "Plan →" buttons are gone; the row still opens the client's Plan.
- [ ] **The Move dialog (dragging a bar on the Plan timeline) uses the phase dialog's look**: title, track tag, the state the new dates put it in, Start / End / Length as before → after with the new value in the state's colour, the programme and live notes in boxes, Cancel / Save new dates.

## 96 · The exercise table fixed, and scheduling from the Plan tab — ✅ LIVE 21 Sep

- [ ] **"What the client did" was crushed to 30px and could not be scrolled to** (live for about an hour after group 95's push). Three old rules styled the table's LAST cell as the pinned 30px bin column; when that column went (group 90), "What the client did" became the last cell and got them. Removed, and its own 330px width too, so it now takes all the spare room and every other column keeps its size: grip 22, Exercise 210 — the same as the cardio table. Checked on the real builder with local data: Exercise 210, "What the client did" 652, no sideways scroll, the bin 12px in from the row's end.
- [ ] **Drafts go out on their own dates from the Plan tab, on every track.** A start in a later week schedules it ("draft · schedule" on the bar, "Schedule for Mon 5 Oct"), and it goes live on that week by itself; a start that has come puts it live now. Training used to go live immediately whatever its dates. The confirmation uses the phase dialog's look and says which it will be, with the right words per track (it said "nutrition targets" for a lifestyle phase).

## 97 · Names in full, verdicts in a column — ✅ LIVE 21 Sep

- [ ] **Exercise names are never cut.** The Exercise column is a fixed 280px (Activity on the cardio view too, so the toggle still lines up): room for the trend, a name on one or two lines and "Add demo". The two-line clamp with "…" is gone; a rare very long name takes a third line.
- [ ] **"On target", "+5 kg over" and "▲ 5 kg vs W2" sit in one column down the table.** The verdict used to follow the last set, so it moved with every row's set count. Now each row is week tags | sets | verdicts, with the tags and verdicts in fixed places and only the sets scrolling sideways (both weeks together) when a week has more than fit — the table itself no longer grows for it. Checked on the real builder: every verdict ends on the same line; thirteen sets in one row scroll inside their area and nothing else moves.

## 98 · Every delete confirmation, and Training's schedule dialog, in the new look — ✅ LIVE 21 Sep

- [ ] **The shared "Delete …?" dialog** (a week, a session, and every other delete in the coach app) uses the phase dialog's chrome: the question in the header, what goes with it in the body, "This can't be undone" in a red note, Cancel and a red Delete in the footer. Focus still starts on Cancel.
- [ ] **Training's "This programme" dialog** (name a draft programme, deploy it now or schedule it) and **Duplicate session** (the other item in the ⋯ menu) match it.
- [ ] Note on "the delete button does not work": the live logs show the delete at 05:08:28 hit the ~15 seconds in which the server was restarting for a push (502, timed out), so nothing was deleted; requests after it went through. Every push restarts the live server for about that long.

## 99 · Room for the other columns — ✅ LIVE 21 Sep

- [ ] **Weight gets 100px per gym** (was 64) so a gym name like "Muscle Factory" reads in full, and **Notes 180px** (was 90) so a note's first words do. "What the client did" gives up that room; its sets scroll inside the cell when they don't fit, and its verdict column went 118 → 104px (the longest verdict fits). Checked on the real builder: both gym names fit, nothing else moved.

## 101 · A new lifestyle phase starts blank; the coach's name in the rail; Next meeting lined up — ✅ LIVE 21 Sep

- [ ] **A draft or scheduled lifestyle phase is a blank canvas** on Measurements: no metrics, and the Logged data block reads "Nothing logged yet. This phase is a draft." (or "…starts Nov 2."), with no client notes under it. It used to show every metric and check-in of the running phase, because the table and feed read all the client's metrics and all their history whatever phase was on screen. The running phase shows only its own metrics now; an ended one reads back from its last day. "Start from <running phase>" still copies them on purpose.
- [ ] **The old standing metrics now belong to the running phase**, so when the next phase starts they don't come back with it. Happens by itself the first time a client with a running lifestyle phase is opened. A client with no running phase keeps them as before.
- [ ] **The client is only asked the running phase's metrics.** Before, ticking metrics on a draft put them in the client's check-in straight away. Also the metric library's "Add to check-in" button now adds to the phase on screen (it always added to the running one, whatever phase was open).
- [ ] **The rail's foot shows your display name** from your profile ("Finlay Chedd") instead of a name read off the login email. Falls back to the email when no display name is set.
- [ ] **"None booked" sits on the same line** as the other figures in the client Home strip (it was centred in its box, so it dropped below "0 of 5", "3,180 kcal").
- [ ] Checked on local data: draft "hyper" shows a blank board and empty feed; live "cock" keeps its 13 metrics and history; client 1's 13 metrics moved onto "cock"; the rail reads "Finlay Chedd"; all six figures share one top edge with "None booked".

## 102 · Scheduling a training programme actually schedules it — ✅ LIVE 21 Sep

- [ ] **Training → "Schedule it" opens the phase dialog in its scheduling mode** (blue span, "Scheduled" chip, a "Schedule it" button; "Make it live" when its first week has come). It used to open the plain phase editor, whose Save only moved the dates, so the programme stayed a draft. "Edit dates" still opens the editor.
- [ ] **Scheduling a training phase schedules its programme**: from the start of its first Monday when that is a later week, live now when it has come. The name typed in the dialog becomes the programme's name. Before, only the phase was marked scheduled, which left programmes like client 5's "Bulk block" with a scheduled phase and a draft programme; pressing Schedule it on those again fixes them.
- [ ] **Programmes going live just after midnight count from the right week.** Deploy and schedule times are stored in UTC, and the date was read off the UTC time, which is the Sunday before for anything in the first hour or two of a Monday in Amsterdam. A programme scheduled from the Plan tab (which goes live at 00:00 Monday) and picked up before about 01:00–02:00 would have started the client on week 2. The date is now read in local time everywhere a programme's start is worked out. Moving a scheduled programme also keeps its local time on the new Monday (it could slide to the Tuesday).
- [ ] Checked: a dry run on client 1's draft "addasasdasd" (Nov 9–29) scheduled it for 00:00 on Nov 9 with the phase on the same weeks and the new name, then was undone. The dialog renders blue with "Schedule it". Not clicked through on the real Training tab (needs a signed-in coach).

## 104 · Bug sweep before Finlay starts: drafts, the address bar, new programmes — ✅ LIVE 21 Sep

- [ ] **A training phase is a draft exactly when its programme is.** Nothing kept them in step: a phase made on the Plan tab stayed flagged draft after its programme went live or was scheduled (so the client's plan and "the phase they are in" skipped it), and older phases had no flag while their programme was still a draft (so the client's plan could show a block Finlay hadn't built yet, and the client card could name a draft as the current training phase). Now it follows the programme both ways, and existing phases are put right on the next page load. Locally that re-flagged five unbuilt drafts (client 5's Hypertrophy, Focus legs, Bulk block, Peak block; client 1's addasasdasd).
- [ ] **The address bar keeps the tab and phase you are on.** Clicking a tab or picking a phase wrote them into the address in a way Next ignored, so the next save put the address back to how the page was opened: a refresh (or a deploy restarting) then landed on another tab or programme, and the server rendered with a stale tab. Tested in a harness with the real tab bar: click a tab, change something, save: the address, the tab and its state all stay.
- [ ] **The tabs never rebuild on a save.** They followed the server's idea of the tab; with the address fixed that would have rebuilt the tab on the first save after a tab switch (builder back to the live week, sessions folded). They follow the address now; links to another tab (the feed's "See the week") still switch.
- [ ] **"+ New programme" opens the new programme.** It stayed on the live one, so it looked like nothing happened.
- [ ] **The live programme's past weeks can't be deleted.** Removing one (a week the client skipped, so nothing logged) moved every later week up one, so the week the client is on turned into next week's sessions under them. Trained weeks and past programmes were already locked.
- [ ] Checked in a dry run, then undone: extending a live programme's phase adds the weeks (7 → 9) and the phase ends on the right Monday; shortening stops at logged weeks; moving a live start earlier keeps it where the client trained; moving a scheduled one keeps its time of day; moving a draft keeps it a draft. Railway's logs for the last three days: no errors, no failed requests.

## 105 · Nutrition's logged days in pages of 20 — ✅ LIVE 21 Sep

- [ ] **Every logged day in the phase, twenty to a page**, newest first, instead of the first six and "Show all". The foot reads "1–20 of 45 logged days in this phase" with Activity's chevron pager (numbers between). Changing page closes an open day. Checked with 45 days: 20, 20, then 5.

## 106 · Type a phase's dates — ✅ LIVE 21 Sep

- [ ] **Start and End in the phase dialog are typed as well as picked**, on every track (Plan, Nutrition, Training, Lifestyle, and Schedule it). dd/mm/yyyy; 21-09-2026, 21.09.2026, 21092026 and 2026-09-21 work too. Clicking a field selects its date, so typing replaces it. Once the date is whole, the calendar turns to its month and selects it, the same as clicking that day: phases are whole weeks, so a Wednesday selects its week, and a start after the end moves the end along. An impossible date ("not a date") or an end before the start ("before the start") turns the field red and changes nothing; leaving the field puts back the date it holds. Enter settles the date instead of saving. A locked end (a live programme's start, a programme's length) stays read-only; typing the start of a fixed-length programme moves the whole block.
- [ ] Checked by typing in the real dialog: a lifestyle draft 16/12/2026 → December, week 51 selected; end 31.01.2027 → January, 7 weeks; 31/02/2027 and an end before the start refused in red; a 3-week training schedule typed 04/01/2027 → 4–24 Jan.

## ⚠ Known issue, live since 16 Sep: Start on Home no longer scrolls to the session

Live: Home → Start opens the Training tab with the session open and scrolled to the top of the screen. Local: the session opens but the tab sits at its top, so the client scrolls to find it. Started somewhere in groups 50–53 (the floating top bar, the Home rebuild); the deep link itself (`focusRef` → `TrainingDayList`) still fires, only the scroll is lost. The scroll code was rewritten twice today (explicit `scrollTo` on `.app-content`, repeated at 60 / 300 / 700ms) without effect — needs a signed-in session to watch what moves. Shipped as a known issue on 16 Sep (commits a3c0e90, c6a5e46).

## Still to build

2. **Short-term goals set from the Plan tab.** The Goals list on the client's Home is the coach's list; the intent is that these are the micro goals, set alongside the main goal.
3. **What else belongs beside "Days trained"** on the client's Training tab, if anything. Left as the single figure for now.
4. **Payments in the app.** Stripe (iDEAL, SEPA, cards; Billing for subscriptions; Checkout and the Customer Portal), or Mollie if Finlay prefers a Dutch provider. Money goes straight to the coach's own account, never through Ironline: start with Finlay's account, and move to Stripe Connect once there are several coaches. A payment webhook marks the invoice paid. Before building: Finlay's business account (KvK, bank, ID), what he sells (one-off packages, subscriptions), and BTW from his accountant. Checkout needs his terms and the EU 14-day cancellation consent.
5. **Financial report for coaches.** Income this month vs last, outstanding and overdue, recurring monthly revenue from subscriptions, per-client payments and lifetime value, a 12-month trend, and a CSV export for the accountant with BTW split out. Phase 1 on the existing invoices; phase 2 fed by Stripe (payments, refunds, fees, payouts); with several coaches each sees only their own, and the owner only platform totals.

## Not in this push
The `next` branch is separate and unmerged: branding, packages, progress pictures, and the check-in rebuild that drops the Measure tab. See `WHATS-NEW-ON-NEXT.md` on that branch. Merging it now conflicts in ten files, including the check-in screen, because live has moved a long way since it was cut.
