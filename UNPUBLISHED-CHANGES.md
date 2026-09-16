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
- [ ] **It shows wherever the coach's initial used to**: the note on the client's Nutrition tab, the "From {coach}" row in Notifications, and the coach's own row at the foot of the admin rail. Without a picture, the initial stays.

Look: `/admin/profile` → drop a photo on Profile picture; then `/client` → Nutrition (with a coach note) and the bell.

## ⚠ Known issue, live since 16 Sep: Start on Home no longer scrolls to the session

Live: Home → Start opens the Training tab with the session open and scrolled to the top of the screen. Local: the session opens but the tab sits at its top, so the client scrolls to find it. Started somewhere in groups 50–53 (the floating top bar, the Home rebuild); the deep link itself (`focusRef` → `TrainingDayList`) still fires, only the scroll is lost. The scroll code was rewritten twice today (explicit `scrollTo` on `.app-content`, repeated at 60 / 300 / 700ms) without effect — needs a signed-in session to watch what moves. Shipped as a known issue on 16 Sep (commits a3c0e90, c6a5e46).

## Still to build

2. **Short-term goals set from the Plan tab.** The Goals list on the client's Home is the coach's list; the intent is that these are the micro goals, set alongside the main goal.
3. **What else belongs beside "Days trained"** on the client's Training tab, if anything. Left as the single figure for now.
4. **Payments in the app.** Stripe (iDEAL, SEPA, cards; Billing for subscriptions; Checkout and the Customer Portal), or Mollie if Finlay prefers a Dutch provider. Money goes straight to the coach's own account, never through Ironline: start with Finlay's account, and move to Stripe Connect once there are several coaches. A payment webhook marks the invoice paid. Before building: Finlay's business account (KvK, bank, ID), what he sells (one-off packages, subscriptions), and BTW from his accountant. Checkout needs his terms and the EU 14-day cancellation consent.
5. **Financial report for coaches.** Income this month vs last, outstanding and overdue, recurring monthly revenue from subscriptions, per-client payments and lifetime value, a 12-month trend, and a CSV export for the accountant with BTW split out. Phase 1 on the existing invoices; phase 2 fed by Stripe (payments, refunds, fees, payouts); with several coaches each sees only their own, and the owner only platform totals.

## Not in this push
The `next` branch is separate and unmerged: branding, packages, progress pictures, and the check-in rebuild that drops the Measure tab. See `WHATS-NEW-ON-NEXT.md` on that branch. Merging it now conflicts in ten files, including the check-in screen, because live has moved a long way since it was cut.
