# Unpublished changes — review list

Everything below is on localhost only. Live (Railway) is at commit `ecd69ca` (the client-notes and exercise-note hotfixes went live on their own); localhost is 34 commits ahead.
Tick **Keep** or **Drop** per item. Items in the same group lean on each other, so dropping one usually means dropping the group.

Where to look: coach side at `localhost:3000/admin`, client side at `localhost:3000/client` (Sam Rivera, client 5, has the most data).

---

## 1 · Client Home restructure
Commits `3591086`, `9d4c581`, `678dea8`, `f25a211`

- [ ] Keep  [ ] Drop — **Home tab rebuilt**: name, plan rows (phase + programme with time left), next meeting card with a Join button ("Starting now" when it's time), goals list, then the Data card. Weekly training stats moved to the Training tab.
- [ ] Keep  [ ] Drop — **Data card**: one card with a stat strip over the graph, four pinned figures at most.
- [ ] Keep  [ ] Drop — **Goals never close themselves**: a met target stays until the coach ticks it off; if it slips again it reads "Reached Sep 8 · slipped, X to go" in orange.

Look: `/client` Home tab.

## 2 · Goals are one list
Commits `afaacd0`, `a69cda6`, `e71ce15`, `a27588e`, `9363cc9`

- [ ] Keep  [ ] Drop — **No more short-term / long-term**: one list per client, shared by Home, Meetings and Plan.
- [ ] Keep  [ ] Drop — **Goal editor**: type-to-search pickers for metrics, exercises and check-in habits; nothing preselected; calories logged is a trackable figure; start date; pace verdict line.
- [ ] Keep  [ ] Drop — **Drag to reorder** goals; untracked goals show no status word.

Look: `/admin?client=5&tab=plan` → + Add goal.

## 3 · Meetings tab (new)
Commits `5b17f23`, `70049c7`, `89f743a`, `55bfae5`, `7bb62ac`, `e46503b`, `8a9f4e3`, `e3536eb`

- [ ] Keep  [ ] Drop — **Meetings tab** on the client page: upcoming meeting card (topic, join link set in a dialog, prep notes that autosave, Cancel / Reschedule / Mark completed), goals to review beside it (editable, deletable, draggable).
- [ ] Keep  [ ] Drop — **Mini calendar** with a day agenda listing what's booked; schedule form with a 24-hour text time field (no AM/PM, no seconds).
- [ ] Keep  [ ] Drop — **Past meetings**: "2 weeks ago · 1 goal set" beside the title, status pill on the far right, no dropdown.
- [ ] Keep  [ ] Drop — **Client side**: the join link reaches the client's Home meeting card.

Look: `/admin?client=5&tab=meetings`.

## 4 · Plan tab redesign
Commits `3c42851`, `3213446`, `70667f7`, `c8fd5d7`, `dd09703` (part)

- [ ] Keep  [ ] Drop — **Phases grid**: 13 / 26 / All weeks, months and ISO weeks, nutrition / training / lifestyle lanes, Now marker, bars with badges and progress, "+ add" on empty tracks.
- [ ] Keep  [ ] Drop — **Drag**: edges change length, the whole bar moves; a "Move X?" dialog confirms before saving; a programme the client already trained in keeps its start.
- [ ] Keep  [ ] Drop — **Goals table** under the grid: Open / Done / All, columns for tracks, live standing, progress, set in, by; done-ticks queue on a blue pending bar with Apply.
- [ ] Keep  [ ] Drop — **Band subheadings removed** under Phases and Goals (just done).
- [ ] Keep  [ ] Drop — Side panel no longer shows goals (they live on the Plan tab).

Look: `/admin?client=5&tab=plan`.

## 5 · Client notes to the coach
Commit `fea5a08`

- [ ] Keep  [ ] Drop — Client can add a note when logging kcal ("+ Add a note for your coach") and on daily / weekly / measurement check-ins.
- [ ] Keep  [ ] Drop — Coach sees the notes on the Nutrition calorie table, the metric history table, Measurements ("Notes from the client") and the Feed.

Look: `/client` Nutrition and Check-in; `/admin?client=5&tab=measurements`.

## 6 · Admin Nutrition tab redesign
Commit `dd09703`

- [ ] Keep  [ ] Drop — **Daily targets card**: phase switch, Training / Rest toggle, "Same macros on both", big derived kcal with share bar, macro cells (% kcal, g/kg), water goal, note beside.
- [ ] Keep  [ ] Drop — **Supplements card**: inline-editable sheet, timing pills, "Show in app" switch (hides the list on the client's app), add row in the footer.
- [ ] Keep  [ ] Drop — **Calories logged card**: 7 / 30-day bar strip and table judged against that weekday's target, client note column.

Look: `/admin?client=5&tab=nutrition`.

## 7 · Small Training-tab tidies
Commits `d36a12f`, `c39e672`

- [ ] Keep  [ ] Drop — Set rows centred; the Edit column no longer leaves a gap on the right.
- [ ] Keep  [ ] Drop — The week-over-week volume percentage beside "Sets logged" is gone.

Look: `/client` Training tab.

---

## Already live (for reference, nothing to decide)
`ee73997` tapping a prefilled kg / RPE selects it · `ad6fd95` logging the same set twice no longer counts as two.

## How dropping works
Each group is a run of commits, so a whole group can be reverted cleanly. Dropping a single line inside a group is usually possible too, but groups 1–4 share the goals data model, so dropping "Goals are one list" would also take the Meetings and Plan goal work with it.
