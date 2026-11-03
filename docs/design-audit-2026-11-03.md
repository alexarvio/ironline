# Design consistency audit, 3 Nov 2026

Read-only check of the client app and the coach admin against docs/DESIGN-RULES.md and docs/DESIGN-RULES-ADMIN.md. Nothing was changed. (Two findings about the rules being out of date for the blue weight line and the icon-only Needs you actions were dropped: both rules were updated today.)

## Old pre-hairline pieces still showing (checked in the code, all confirmed)
- **Client Home, Today with nothing due**: this state is a different component, a white bordered card. Its "Today" label is grey 10.5px instead of the ink 11.5px head the list uses, and "Nothing to do today" is 700 in `#333`. (HomeHub.tsx:252, globals.css:18214)
- **Training, the "saved" toast after a workout**: a white card with a drop shadow, a typed ✓ on a filled light-green disc, a 700 title in `#333`, and an explanation line under it. (TrainingDayList.tsx:386, globals.css:15933)
- **Food diary, meal photo sheet**: Replace is a navy filled block and Remove a pink filled block, both 700. It also has the hint "Only your coach sees this." (FoodDiaryScreen.tsx:1299, globals.css:14690)
- **Coach Training, exercise ⋯ › Variation pop-up**: the only admin pop-up left in the old style. It has a glow and a wash, a big header icon, a 21px/800 title, a navy capsule and a navy + New. (VariationDialog.tsx, draft.css:1212)
- **Coach Training header, "Note from {First}"**: a 34px rounded rectangle at 700, beside the round white pills. Its unread dot is 9px, not the shared 6px rust `.rd-due`. (TrainingDraft.tsx:937, draft.css:364)

## Folds and motion
- **Session overview, exercise and cardio rows**: they open in one frame with no easing, and the chevron is a CSS triangle on 0.2s. Every other client fold uses the shared Meeting-summary motion. (SessionOverview.tsx:364, 402, 453)
- **Chevrons on check-in days, Shape update's earlier sheets, Events, Meetings and Notifications**: each screen turns its chevron its own way (down and flip, or right and turn) with its own timing. None of them is in the shared fold block. (globals.css:17196, 13276, 19220, 19444, 19489)
- **Check-in Calendar, a day opening**: it uses its own 0.25s keyframe instead of the shared fold. (globals.css:17747)
- **Settings switches**: the knob moves in 150ms. Capsules use 250ms on the shared curve. (globals.css:14391)

## Toggles and capsules
- **Nutrition and Food diary, Training day | Rest day**: drawn as underline tabs with navy, not a capsule, so it does not slide. They also show position dots under the macro rings, which the rules allow only under Home's phase cards. (NutritionTargetsCard.tsx:103, 195; FoodDiaryScreen.tsx:671, 1383)
- **Client capsules in general**: each one has its own height, air and type. Progress's range is 32px and its picked word gets bolder, so its width shifts. Add an event's is 30px, Media and files 40px, Compare 42px and Subscribe 36px. (globals.css:17832, 18130, 17961, 17056, 21011)
- **Food diary week strip**: the picked day is a white tile with a shadow and 800/700 type. That is a third way to mark a chosen day; elsewhere it is an ink ring, or an ink disc for today. (globals.css:14516)

## Lines between rows (the rule is space alone)
- **Food diary meals, Settings sections and rows, the burger menu's items, the Invoices list, check-in Last 7 days**: all still have hairlines between rows. (globals.css:19878, 19770, 14474, 19946, 19819)
- **Check-in and Shape update, sticky top bar**: once it sticks, a line appears under it, and its background is a different tone from the page. (globals.css:16961)
- **Settings top bar**: `#F5F5F5` over a `#F5F6F8` page, so there are two tones on one screen. (globals.css:2467)

## Type weights (700 and 800 are not allowed on client screens)
- **Every photo banner** (Training, Nutrition, check-in, food diary, session overview): titles and eyebrows are 700, and the title sizes vary from 22 to 32px. (globals.css:13942, 4112, 14502, 15947)
- **Session overview header**: the status is a filled chip at 700, while the Training list shows the same status as words alone. The stats strip is also 700. (globals.css:15950, 16280)
- **Check-in count pill (3 / 10)**: 700 with old greys, amber and mint dots, and a navy base. (globals.css:3927, 16963)
- **Nutrition ring and macro labels**: 800 at .1em in `#757575`. (globals.css:4143, 4151)

## Pills and buttons
- **Coach header pills on Invoices, Library and Coaches**: the shared pill is see-through, so these show the page grey. Home's, Meetings', Calendar's and Feed's are set to white. Shape update's Sheet setup is a separate button of its own. (trn.css:90; home.css:22; meetings.css:6)
- **Row actions as pills**: an opened event's Edit and Delete, and an opened check-in day's Edit, are pills. The rule is words alone inside a row. (globals.css:20556, 19837)
- **Underlined text actions**: the cardio's "Substitute today", and the food diary's Edit, which is also green. (globals.css:20735, 14570)
- **Join**: Home says "Open meeting link" and "Join call" on a full-width button. Meetings says "Join". (HomeHub.tsx:593, MeetingsScreen.tsx:359)
- **Sign-in with Apple on**: two ink pills on one card. (globals.css:20843)
- **Small ones**: the Weight goal pop-up's verdict pill is 22px; every other state pill is 24px (draft.css:1559). Some client pills use the admin hairline `#DCE1E8` instead of `#E1E5EB`.

## Same thing drawn several ways
- **Workout targets**: shown three ways. The exercise page has the new table. The session overview uses another table in a different order, with no Rest column and other sizes. The cardio page still uses the old one-line bars. (ExercisePage.tsx:669, workoutShared.tsx:451, 337)
- **The done check**: four sizes and colours across Training rows, the session overview, workout sets and the food diary. The food diary uses a typed ✓. The session overview's 26px ring with a 13px check also breaks the whole-pixel rule. (globals.css:19677, 19653, 20322, 14552)
- **The coach's message on Home**: its own layout, with a 40px face and 13px grey words. Everywhere else uses `CoachSays`: a 36px face and 15px ink words. (HomeHub.tsx:466)
- **Meetings notes**: each point gets a square checkbox. Home shows the same notes as plain text. (MeetingsScreen.tsx:455)
- **Facts parted by a bar**: Notifications, the Calendar and sign-in each draw their own bar instead of `Bars`. Settings types " | " as text. The Timezone picker uses a middle dot. Shape update's status has no bar between Not saved and Retry. (NotificationsScreen.tsx:254, settings/page.tsx:107, TimezonePicker.tsx:46, PicturesDraft.tsx:240)
- **Time fields in coach pop-ups**: three kinds. Schedule a programme uses the browser's own time box, Meetings a typed box, and Calendar a typed box with a list. (ScheduleDialog.tsx:99, MeetingsDraft.tsx:1203, EntryDialog.tsx)
- **Save status**: Plan never shows a failed save. Calendar uses the old note, with no ✓ and no Retry. (PlanDraft.tsx:307, calendar/page.tsx:123)
- **Shape update (coach)**: radius-20 cards with a shadow edge instead of radius-18 cards with a border, and "No sheets yet" instead of "None yet". Nutrition's five figures use their own grid in red, not the shared figures card in rust. (pictures.css:33, NutritionDraft.tsx:825)
- **Leaving Shape update with unsent photos**: the browser's own confirm box, not an in-app question. (ProgressPicturesScreen.tsx:69)

## Dates and times
- **Check-in screen**: one screen shows three formats: "Mon, Nov 2", "Mon 2 Nov" and "Monday, November 2". (CheckInDialog.tsx:74, ActivityCalendar.tsx:175)
- **Client dates in general**: each screen formats its own dates. Chat day headings are US style ("Wednesday, October 21"), while Notifications say "Wed 21 Oct". (HomeHub.tsx:253, FoodDiaryScreen.tsx:581, queries.ts:6315)
- **Times**: on a 12-hour phone, Notifications and Meetings show "06:00 PM", while chat and Home show "18:00". (notificationDates.ts:29, meetingDates.ts:46)
- **Coach, Schedule a meeting's day list**: "Monday 9 Nov" and "Nothing booked." The rule is d/m and a word or two. (MeetingsDraft.tsx:122)
- **Small ones**: Invoices' day numeral is not zero-padded and is 24px, against Events' "05" at 22px.

## Colours
- **Two rusts for "needs you"**: the rail, the dots and the chat use `#b3471d`. The Feed, the to-do strip and the pills use `#b8471f`.
- **Two greens**: the check-in pop-up uses `#2E7D32`, the check-in screen `#2f7a3f`.
- **Small ones**: session overview numbers are navy while Training's are ink. Sign-in errors use admin red, while other client errors are rust.
- **Burger icons**: line thickness ranges from 1.3 to 2 across items. The rule is 1.6.

## Words and empty states
- **Explanation sentences**: still in Settings (under every switch), the skip sheet, the Rogue session row, and the Nutrition, Notifications, Meetings, Events, Shape update and check-in empty states. Some say "your coach" and some use the coach's name.
- **"No match" worded five ways in coach search lists**: "No match", "No matches", "None", and "No timezone called that."
- **Same thing, different words**: a swap is worded three ways ("Substitute for", "Instead of… today only", "Substituted with"). The video ask is worded two ways. Event delete says "Yes, remove it" while chat says "Delete". Meetings says "+1 more booked" where the rule says "+1 more", and "Past meetings" where Events says "Past".
- **Home Meetings with nothing ever booked**: the heading changes to "Meetings with {Coach}" and it adds "No meetings yet." The rule keeps one shape. (HomeHub.tsx:617)
- **Coach Training**: its eyebrow says "Programme" where the other tabs give the track's name. Coaches and Support's empty word sits 6px high.

## Biggest wins
- **Fix the five leftovers in the old style** (Today's empty card, the Training toast, the food photo sheet, the Variation pop-up, the "Note from" button). They are the most visible breaks, and each is small.
- **Put every client fold and chevron on the shared Meeting-summary motion**, starting with the session overview's rows.
- **One shared client date and time helper** (d/m wording, 24-hour times). That fixes the check-in's three formats, the chat headings and the 12-hour times in one go.
- **One capsule size and one done check across the client app**, and make Training day | Rest day a sliding capsule.
