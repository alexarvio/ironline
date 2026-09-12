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

## 5 · Client notes to the coach — already live
Commit `fea5a08`, pushed live on its own as `7566593`. Nothing left to decide here.

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

## 8 · Client Home reordered around one main goal
Commit `f0b6a02` (12 Sep)

- [ ] Keep  [ ] Drop — **Main goal under the name** replaces the nutrition phase. New `main_goal` on the client profile, written by the coach from the Plan tab. The Plan-tab control is still to be designed; the store, the action and the client side are in. Until one is set the line reads "Your coach hasn't set your main goal yet", quietly.
- [ ] Keep  [ ] Drop — **New order**: name and main goal, plan rows, next meeting, Check-ins, then Goals. Goals are the coach's short-term ones, also to be set from the Plan tab.
- [ ] Keep  [ ] Drop — **Data card off Home** for now.
- [ ] Keep  [ ] Drop — **Training tab**: "Days trained" only. "Sets logged" is gone, it told the client nothing they could act on.

Look: `/client` Home and Training tabs.

---

## Already live (for reference, nothing to decide)
`ee73997` tapping a prefilled kg / RPE selects it · `ad6fd95` logging the same set twice no longer counts as two · `7566593` client notes on calories and check-ins · `ba42d54` the client's own note per exercise · group 5 below, pushed as its own hotfix.

Pushed live 12 Sep as `hotfix-training`: one training day open at a time, the open exercise card carries its number, and the centred set rows from `d36a12f` (so group 7's first line is live; its second line is not).

## How dropping works
Each group is a run of commits, so a whole group can be reverted cleanly. Dropping a single line inside a group is usually possible too, but groups 1–4 share the goals data model, so dropping "Goals are one list" would also take the Meetings and Plan goal work with it.
