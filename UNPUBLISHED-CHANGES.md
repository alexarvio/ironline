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

## Still to build

1. **The Plan-tab control that writes the main goal.** The field, the server action and the client side are in. There is no way for the coach to set it yet, so every client currently reads "Your coach hasn't set your main goal yet". This is the first thing to do.
2. **Short-term goals set from the Plan tab.** The Goals list on the client's Home is the coach's list; the intent is that these are the micro goals, set alongside the main goal.
3. **What else belongs beside "Days trained"** on the client's Training tab, if anything. Left as the single figure for now.

## Not in this push
The `next` branch is separate and unmerged: branding, packages, progress pictures, and the check-in rebuild that drops the Measure tab. See `WHATS-NEW-ON-NEXT.md` on that branch. Merging it now conflicts in ten files, including the check-in screen, because live has moved a long way since it was cut.
