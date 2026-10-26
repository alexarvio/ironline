# NorCoach · Market research (step 1)

Research for the copy method's step 1, adapted from e-commerce to B2B software: the buyer is the coach, a small-business owner buying a coaching platform. Done 26 Oct 2026 from public web sources.

**How to read this file**
- Every quote is verbatim, in quotation marks, with its source URL right after it. Quotes from review sites carry the reviewer's name or handle and date where the page showed them.
- **[Inference]** marks anything I concluded rather than found.
- **(search snippet)** marks a quote taken from a search-engine extract of a page that blocks direct reading (Capterra, G2, GetApp, Software Advice and Quora all returned 403 to direct fetches). The words are the page's own, but I could not open the page to check the context.
- **Reddit, Facebook groups and YouTube comments could not be read** by this tool (Reddit refuses the crawler; Facebook and YouTube comments need a login). The few Reddit lines below are ones quoted, with links, in an article. These are the market's main watering holes, so a manual pass on them is the first follow-up (see the last section).
- Many web results for this topic are blog posts by coaching-software vendors. I used their figures only when they report their own first-party data, and say so. Their sheer number is itself a finding (section 6).

---

## Summary

1. **The buyer is a solo operator with a thin, leaky business.** In the largest first-party dataset found (one platform, 201 Nordic coaches), the median coach has 5 active clients and charges €181 a month per client; 81% have fewer than 20 clients. Median client tenure is 3.2 months and only 45% of clients are still there at 12 months. A coach with 10 to 60 clients (our target) is already in the top fifth.
2. **Online pays better than the gym floor**, and that is why trainers move online: PTDC's survey found trainers who coach virtually average $52,518 a year against $34,585 for in-person only, and online trainers with 100+ clients average $127,613.
3. **The spreadsheet works until it doesn't.** The recurring story is "it worked at five clients, it worked at ten, somewhere between ten and twenty it stopped". The breaking points are always the same: check-in day becomes a marathon, data lives in five places (Sheet, Drive, Docs, WhatsApp, MyFitnessPal), trends have to be built by hand, and clients hate logging into a sheet on a phone.
4. **The apps they switch to are disliked for a consistent set of reasons:** bugs that lose a client's logged sets, canned support since the private-equity acquisitions, add-ons that turn a $23 plan into a much bigger bill, price cliffs at client tiers (TrueCoach jumps from about $70 to $165 a month going from 20 to 21 clients), weak coach phone apps (TrueCoach Connect: 1.8 stars), and client apps that take too many taps to log a set.
5. **The real fear underneath is losing clients.** The horror stories are not about software; they are about a paying client walking away because the app broke ("I lost a paying client—$2,200 AUD gone"), or a client feeling the coach isn't looking.
6. **Clients of online coaches complain about one thing above all: not being seen.** "Feels like they say the same thing every week during check in." "No one there even knows who I am." Replies that "felt automated and AI-generated" are now a named complaint. That makes "you'll see every client properly" a coach's emotional need, not just an efficiency one.
7. **Video form review is the moment coaches say online coaching feels real.** Coach's Eye, the app coaches used to draw on a lift and talk over it, was retired in 2022 and its cloud deleted; coaches now patch with Loom, screen recordings or typed notes. [Inference] A lost tool, a real gap.
8. **The market is highly sophisticated (stage 4 to 5).** At least 15 vendors publish near-identical "ditch the spreadsheets / all-in-one coaching platform" pitches. "All-in-one" and "save hours" are spent claims; coaches have heard them and many have been burned by switching.
9. **Trust beats features.** One commenter put the switching question as: "do i trust a one-week-old tool from someone i've never met with my clients' payment details and session notes" (Indie Hackers, search snippet). Support quality is the most-praised thing in the positive reviews of every platform.
10. **Market and trend:** the coaching-software category is growing roughly 10 to 12% a year (estimates USD 1.8 to 3.7 billion), consolidating under private equity, and now adding "AI". Trainers use AI for admin, but most believe it can't replace the human side, and clients are starting to spot and resent automated replies.

---

## 1. Who the customer is (demographics)

### 1.1 Age
- PTDC's August 2020 survey (1,169 trainers worldwide): "Most, fifty-eight percent, were between the ages of 25 and 34," and "none were older than 55." https://athletechnews.com/personal-trainer-salary-survey-2020-results-revealed/
- PTDC's 2021 salary survey (837 respondents): the highest-earning age group was 35–44 ($62,198 a year), the lowest 55–64 ($36,836). https://www.theptdc.com/articles/personal-trainer-salary-survey
- Across all personal trainers (not only online): "The average age of working personal trainers is 37 years old" (RunRepeat) and "40% of personal trainers are aged 40 years or older" (Zippia), both as cited by My PT Hub. https://www.mypthub.net/?p=16319
- **[Inference]** The buyer we want (10–60 paying clients, running it as a business) skews to the 28–45 band: old enough to have a client base and reputation, young enough to live on their phone. Online-first coaches skew younger than gym trainers.

### 1.2 Gender
- PTDC 2020: "Three quarters of personal trainers identified as male." https://athletechnews.com/personal-trainer-salary-survey-2020-results-revealed/
- Zippia (via My PT Hub): "63.3% of personal trainers are men, while 36.7% are women." https://www.mypthub.net/?p=16319
- CareerExplorer reports near parity: 51% male, 49% female. https://www.careerexplorer.com/careers/personal-trainer/demographics/
- PTDC 2021: male respondents averaged $54,514, female $35,945. https://www.theptdc.com/articles/personal-trainer-salary-survey
- **[Inference]** Business-minded online coaches lean male (the PTDC audience is the best proxy for "business-minded trainer"), but women's fat-loss, nutrition and post-natal coaching is a large female-led segment; copy and imagery should not assume a male bodybuilder.

### 1.3 Location
- PTDC's 2020 survey: 55% of respondents lived in the United States (as reported by American Spa; search summary). https://www.americanspa.com/fitness-studies/online-only-trainers-earned-more-than-46-000-average-trainer-salary-2019-survey
- The main platforms cluster in the US (TrueCoach, Trainerize, Exercise.com), UK and Ireland (Kahunas, PT Distinction, My PT Hub) and Australia (several of the harshest Kahunas and Everfit reviews are from Australian coaches). Coachway's dataset is Denmark, Norway, Sweden and Finland. https://coachway.io/articles/online-fitness-coaching-statistics/
- Non-US coaches complain about payments and currency: "the fees being in GBP and not USD or local currency mean the cost is different each month" (My PT Hub, 3★, 7 Mar 2026) https://www.trustpilot.com/review/mypthub.net ; "It's so expensive (as an Australian customer)" (Exercise.com, 1★, 18 Jan 2026) https://www.trustpilot.com/review/exercise.com ; TrueCoach reviewers say "you can't take payments in UK" (search snippet, Capterra) https://www.capterra.com/p/155784/truecoach/reviews/
- **[Inference]** English-speaking markets first: US, UK, Ireland, Australia, Canada, then the Nordics and Netherlands (high English, high coaching prices). Euro and pound pricing matters.

### 1.4 Client numbers, pricing and monthly revenue
The best first-party data is Coachway's August 2026 snapshot (one platform, Nordic, 201 coaches, 5,666 clients, 1,563 price records). https://coachway.io/articles/online-fitness-coaching-statistics/

| Measure | Figure |
|---|---|
| Active clients per coach | median 5, average 17.2, largest 295 |
| Coaches under 20 clients | 81% (20–49: 11%; 50–99: 4%; 100+: 4%) |
| Price per client per month | median €181 (quartiles €134–€255) |
| One-time start fee | 37% have charged one |
| Check-in rhythm (default) | weekly for 99% of accounts |
| Client tenure | median 3.2 months, average 4.3 |
| Clients still active | 94% at month 1, 82% at 3, 65% at 6, 45% at 12 |

Other price points:
- A pricing guide citing PTDC: "basic $50-100/mo, standard $100-200/mo, premium $200-400+/mo" (search snippet). https://keedia.com/pro-coach/online-coaching-pricing-2026-market-data-frameworks/
- Exercise.com estimates $125 a month for individual training plans and $200 for combined fitness and nutrition (search summary). https://exercise.com/grow/how-much-should-you-charge-as-an-online-fitness-coach
- Barbell Logic, a large online strength-coaching company, lists $199 a month (two check-ins a week) and $319 (Unlimited), both with video form review. https://barbell-logic.com/video-feedback-for-online-coaching/

Income:
- "Trainers who train clients virtually: $52,518" against "$34,585" in-person only; "86% of trainers earning six-figure incomes train clients online"; "Online trainers with over 100 clients averaged $127,613." https://www.theptdc.com/articles/personal-trainer-salary-survey
- PTDC 2020: before the pandemic only 7% worked online-only and averaged $54,000; after it, 56% were online-only and 23% hybrid; 58% lost some or all income in 2020, an average of $3,000 a month. https://athletechnews.com/personal-trainer-salary-survey-2020-results-revealed/

**[Inference] Monthly revenue of our buyer:** at €134–€255 a client, 10 clients is about €1,300–€2,500 a month gross, 30 clients €4,000–€7,600, 60 clients €8,000–€15,300. So the avatar sheet's "monthly revenue" is roughly **€2,000–€12,000 / $2,000–$13,000 a month**, with a typical middle around €4,000–€6,000. Software at €30–€170 a month is 1–4% of revenue; it is the time and the churn that cost them.

### 1.5 Professional backgrounds
- PTDC 2020: an average of four certifications each; Precision Nutrition and Online Trainer Academy each held by 40%; 63% held a bachelor's or master's degree. https://athletechnews.com/personal-trainer-salary-survey-2020-results-revealed/
- Higher-earning specialties (PTDC 2021): nutrition coaches $76,579, physical therapists $61,703, strength coaches $45,692, general fitness $43,090. https://www.theptdc.com/articles/personal-trainer-salary-survey
- Career changers are common. A coach's own review title: "I used to do flooring for a living…", and: "Now I have the time, money, and freedom to be with my family and to do what I truly love to do." (Fit Game, Trainerize, 5★, 12 Aug 2021) https://uk.trustpilot.com/review/trainerize.com?page=5
- NASM found a 7% rise in certified trainers aged 40+ from 2012 to 2013 (search summary). https://www.athleticbusiness.com/operations/programming/news/15145520/personal-training-a-second-career-for-40-somethings
- Clients becoming coaches: "Moving from client to coach - big difference!" (Sharon Bickerton, Kahunas, 5★, 6 Jun 2026) https://www.trustpilot.com/review/kahunas.io
- Forum advice to aspiring online coaches: you still need face-to-face experience first, and NSCA or ACSM certification for credibility (search summary). https://forum.bodybuilding.com/showthread.php?t=168996283
- **[Inference]** Typical routes in: (a) gym floor PT who moved online in or after 2020; (b) former athlete, bodybuilder or physique competitor coaching their sport; (c) someone transformed by their own coach, now coaching (exactly the founder's coach's lineage); (d) nutritionist or physio adding training. Many are hybrid: a few in-person sessions plus online clients.

### 1.6 Typical identities
- **[Inference]** Self-employed, often a one-person brand on Instagram; trains hard themselves; reads evidence-based content (Stronger by Science, Barbell Medicine, Menno Henselmans style); proud of individualised programming; sees themselves as a coach, not a salesperson or admin. Hybrid coaches split their day between a gym and a phone.
- Burnout research gives a picture of the job: Snarr & Beasley (2022, J. Strength Cond. Res., 256 fitness professionals) found 33.0% personal burnout among personal trainers, 29.6% work-related and 17.4% client-related; 84% would choose the career again; average 34.64 hours a week (as summarised by FitBudd). https://www.fitbudd.com/fitness-burnout-2026-27
- UK fitness workforce: "more than half (53 per cent)" had experienced a mental health issue in the previous 12 months (Workforce State of Mind, 2021). https://www.leisureopportunities.co.uk/news/Fitness-employers-need-to-take-action-to-improve-workplace-mental-health/351024

---

## 2. Attitudes and beliefs

Religious and political attitudes did not surface in any source and do not seem relevant to the buying decision. What matters here is their attitude to business, tech, admin, results and their own time.

**About business and money**
- They see online as the way to earn more without more hours. "Online trainers earn 52% more than in-person-only coaches" is repeated across the industry (PTDC via Gymkee). https://gymkee.com/blog/online-personal-trainer-salary/
- They are price-sensitive about software because revenue is small and uneven: one TrueCoach reviewer was weighing learning Excel "to save on the cost of the software" (search summary, Capterra) https://www.capterra.com/p/155784/truecoach/reviews/?page=3 ; "I don't like the cost or the added subscriptions for features." (Brad, Trainerize, 4★, 20 Nov 2024) https://uk.trustpilot.com/review/trainerize.com?page=3
- A common dilemma, in their words: "Do I charge crazy high prices, do I take on more clients and burn myself out." (r/personaltraining, as quoted by FitBudd) https://www.reddit.com/r/personaltraining/comments/1subxf1/being_a_pt_goes_brutal_dope_brutal_too_many/ via https://www.fitbudd.com/fitness-burnout-2026-27
- "And if people love what you do, they will pay more." (trainer, The Warm Up podcast) https://thewarmup.transistor.fm/episodes/the-3-b-s-of-avoiding-pt-burnout-what-s-actually-worked-for-me/transcript

**About tech**
- Pragmatic, impatient with friction, not technical. Praise in reviews is about ease: "Finally found an app that doesn't make my brain hurt." (Ron Diep, Hevy Coach, App Store) https://apps.apple.com/app/id6502961756 ; "It's no fuss and easy to understand so my clients just buy in." (AlfredTheCoach, Hevy Coach) same URL.
- They judge an app by what their clients say about it: "My clients like how user friendly it is" (Emily Young, Everfit, 5★, 26 Feb 2024) https://www.trustpilot.com/review/everfit.io
- They expect to manage from the phone and are let down: "Coach app is next to useless, to really manage your clients you have to use the web front." (50snew30, Hevy Coach) https://apps.apple.com/app/id6502961756

**About admin**
- Admin is the enemy of coaching. A trainer on the burnout podcast: "No email is ever that time sensitive that I can't wait 24 hours once a day" and "People often figure stuff out for themselves if you give them 24 hours." https://thewarmup.transistor.fm/episodes/the-3-b-s-of-avoiding-pt-burnout-what-s-actually-worked-for-me/transcript
- [Inference] They tolerate admin as "the job" until it visibly costs them a client or a weekend.

**About client results**
- They believe the program is the product and individualisation matters, though the template debate is live: one coach "has never met a coach who didn't begin with a template" (search summary) https://www.theptdc.com/?p=63842 ; another argues anyone not trained in exercise physiology "is not equipped to handle individual programming" (search summary) https://elitefts.com/blogs/training/online-coaching-programming-and-analyzing-movement-programming-is-your-strong-point-part-5
- Barbell Logic's view, widely shared: video feedback is what makes online coaching feel like coaching, not just a delivered program (summary of their article). https://barbell-logic.com/video-feedback-for-online-coaching/

**About social media and "the grind"**
- Trainers are "hyperactive on Instagram and in Facebook groups" and found "in gym back offices, certification cohorts, and the WhatsApp groups their mentor runs" (Indie Hackers commenters, search snippet). https://www.indiehackers.com/post/i-built-a-saas-for-personal-trainers-in-under-a-week-turns-out-that-was-the-easy-part-29c9e88209
- Comparison pressure: "Don't compare yourself to what someone else is doing and online today." https://thewarmup.transistor.fm/episodes/the-3-b-s-of-avoiding-pt-burnout-what-s-actually-worked-for-me/transcript
- A mentorship industry sells scale: "$10K a month within 6–12 months" mentorships and six-month masterminds (search summary). https://www.eofire.com/wp-content/uploads/2022/01/10K-ACADEMY-1.pdf ; FitBudd webinar "the 9 box system that builds a 6 figure online fitness business" https://www.fitbudd.com/fitbudd-webinar/learn-the-9-box-system-that-builds-a-6-figure-online-fitness-business

---

## 3. Hopes and dreams, victories and failures, outside forces, prejudices

### 3.1 Hopes and dreams
- Time and family: "Now I have the time, money, and freedom to be with my family and to do what I truly love to do." (Fit Game, Trainerize, 5★) https://uk.trustpilot.com/review/trainerize.com?page=5
- From struggle to freedom: "I was a struggling trainer.." and Trainerize "created more time and freedom" (Grant Corriveau, 5★, 10 Nov 2021) https://uk.trustpilot.com/review/trainerize.com?page=5
- A real connection at a distance: "There is a level of accountability and care that creates a connection with people that I would have NEVER expected" (Grant Corriveau) same URL.
- Growth: "Super easy onboarding process, huge potential for business growth" (Kit Finlayson, Trainerize, 5★, 16 Sep 2026) https://ie.trustpilot.com/review/trainerize.com
- Retention as the win: "I have better client retention than I did before using Everfit" (coach, App Store, "Game changing app, constant improvements") https://apps.apple.com/us/app/everfit-for-coach/id1485827117?see-all=reviews&platform=iphone
- One place: "Trainerize centralized all my programming, macro tracking, and client check-ins" (Sarah A, 5★, 27 Mar 2026) https://ie.trustpilot.com/review/trainerize.com
- **[Inference]** Short term: get check-in day under control, stop losing data, look professional, take on 5–10 more clients without more evenings. Long term: a known name in their niche, a waiting list, 50–100 clients or a small team of coaches, income that doesn't depend on hours on a gym floor, and clients who stay for years.

### 3.2 Victories
- "Being able to create groups and packages has been a game changer." (Dan Hall, PT Distinction, 5★, 20 Oct 2025) https://www.trustpilot.com/review/ptdistinction.com
- "The weekly check ins/photo progress made ALL the difference for me." (a client, about her coach, 5★, 14 Jul 2021) https://www.trustpilot.com/review/cicionlinecoaching.com
- "it finally got my coaches off clipboards and spreadsheets." (gym owner, Exercise.com, 5★, 7 Oct 2026) https://www.trustpilot.com/review/exercise.com
- A coach ten years on one platform: "I've been using Trainerize for about 10 years now, and it has everything I'm looking for as a coach for my clients." (Daphney Springer, 5★, 3 Jun 2024) https://uk.trustpilot.com/review/trainerize.com?page=4

### 3.3 Failures
- A client lost to software: "I lost a paying client—$2,200 AUD gone." (Gary Burtenshaw, Kahunas, 1★, 10 Mar 2025) https://www.trustpilot.com/review/kahunas.io?page=7
- Clients leaving because of the app: "We have had multiple clients leave because of how bad this app is, and the developers do not care." (Testy, Kahunas, 1★, 18 May 2026) https://www.trustpilot.com/review/kahunas.io
- Over-capacity: "Six weeks of 20 people messaging her 24 7." and "even 20 at his studio felt too much." https://thewarmup.transistor.fm/episodes/the-3-b-s-of-avoiding-pt-burnout-what-s-actually-worked-for-me/transcript
- Quitting: "I'm tired of being an unpaid therapist for energy-draining clients." (r/personaltraining, "Quitting personal training and fitness coaching after 10 years", as quoted by FitBudd) https://www.reddit.com/r/personaltraining/comments/1sxzl72/quitting_personal_training_and_fitness_coaching/ via https://www.fitbudd.com/fitness-burnout-2026-27

### 3.4 Outside forces they blame
- **The software companies and their owners.** Trainerize was bought by ABC Financial (backed by Thoma Bravo) in September 2020 https://www.thomabravo.com/press-releases/abc-financial-acquires-trainerize-accelerating-a-mobile-first-total-fitness-experience-for-workouts-personal-training-nutrition-and-lifestyle-coaching ; TrueCoach went to TSG (an Advent International portfolio company) in April 2020 and now trades as Xplor TrueCoach (search summary; G2 lists it as "Xplor TrueCoach") https://www.g2.com/compare/everfit-vs-xplor-truecoach . Since then, coaches report canned support: "their customer service gives you canned responses when you reach out to them." (Nicky, Trainerize, 2★, 6 Mar 2026, "I've been a client for almost a decade…but not much longer.") https://ie.trustpilot.com/review/trainerize.com ; "generic copy and paste responses about clearing cache" (TrueCoach, 1★, 12 May 2026) https://www.trustpilot.com/review/truecoach.co
- **Developers who spend on ads, not the app:** "more money is put into that then actually making it a well functioning app" (Tim Williams, Kahunas, 2★, 6 Mar 2025) https://www.trustpilot.com/review/kahunas.io?page=7
- **Paywalls on tools their clients rely on.** MyFitnessPal moved barcode scanning behind Premium from 1 Oct 2022 ($19.99 a month or $79.99 a year), which Digital Trends said made recommending it as a free app harder. https://www.droid-life.com/2022/08/24/myfitnesspal-puts-barcode-scanner-behind-premium-paywall/ , https://digitaltrends.com/phones/myfitnesspal-barcode-scanning-not-free-premium-subscription
- **Clients who drift.** Vendors describe "silent drift" around month two or three (search summary) https://blog.trainero.com/why-personal-training-clients-quit-and-how-to-keep-them-the-complete-client-retention-guide-for-2026/ ; Coachway's data shows attrition is steepest between months 3 and 6 (about 7.5% a month). https://coachway.io/articles/online-fitness-coaching-statistics/
- **Cheap apps, influencers and now AI** compressing what clients will pay. [Inference, from the prevalence of AI-coach products and pricing debates; no direct quote found.]

### 3.5 Prejudices
- **Against "app coaches" and cookie-cutter programmes**: online programmes are often "cookie cutter" and don't fit the individual (Barbend, search summary) https://barbend.com/?p=19873 . A client of a large coaching company: "Nothing is personalized to you and you are put with a coach along with 20 or more other ladies" (GMRR, 1★, 26 Mar 2026) https://www.trustpilot.com/review/warriorbabe.com?stars=1&stars=2
- **Against automation that fakes attention**: "the feedback and responses felt automated and AI-generated, rather than coming from a coach who genuinely knew my journey." (L Hooks, client, 1★, 7 Jun 2026) https://www.trustpilot.com/review/empoweronlinecoaching.com
- **Against AI replacing the coach**: ISSA's December 2025 report found about 52% of trainers use AI daily or several times a week, mostly for routine tasks, while the profession neither fully embraces nor rejects it (summary). https://athletechnews.com/personal-trainers-using-ai-but-not-blindly-embracing-it-issa-report/ ; a vendor report claims "77% saying AI can never replace human coaches" (unverified vendor figure) https://www.fitbudd.com/fitness-industry-trends/ai-fitness-coaching-report
- **Against Excel-and-notebook gyms**: "I still see those hideous Excel spreadsheets and notebooks where gym staff writes everything by hand." (Quora answer, search snippet) https://www.quora.com/What-tools-ie-pen-and-paper-excel-others-do-personal-trainers-use-to-track-their-clients-progress-Has-anyone-tried-some-of-the-mobile-fitness-tools
- **Against weak certifications**: forum advice prefers "ACSM or NSCA over NASM or ACE" (search summary). https://forum.bodybuilding.com/showthread.php?t=168996283
- **Against new, unknown tools** (see 6.4 on trust).

### 3.6 Core beliefs in one to three sentences [Inference]
"I got into this because training changed my life and I'm good at changing other people's. I'd coach all day if the admin, the chasing and the tech would get out of the way. Every client deserves my full attention, and the day a client feels I'm not looking, I've lost them."

---

## 4. What the market uses now

### 4.1 The do-it-yourself stack
- A coach's own description: "I like to use Google sheets to input exercises, sets, weights, and reps. Google photos is where I have people share progress photos with me. And myfitnesspal to help track people's diets if they chose to track macros." (Quora answer, search snippet; exact thread not confirmed, Quora blocks direct reading; candidates: https://www.quora.com/What-software-do-you-use-in-order-to-conduct-online-coaching , https://www.quora.com/What-tools-ie-pen-and-paper-excel-others-do-personal-trainers-use-to-track-their-clients-progress-Has-anyone-tried-some-of-the-mobile-fitness-tools )
- The usual pieces: Google Sheets or Excel for programmes and logs; Google Forms into a Sheet for weekly check-ins; Drive or Google Photos for progress photos; MyFitnessPal for food; WhatsApp, Instagram DMs or email for messages and form-check videos; Calendly and Zoom for calls; Stripe, PayPal or bank transfer and hand-made invoices; Loom for video feedback.
- **What they like about it:** it is free, flexible, theirs, and fine at low numbers. Even a vendor concedes a well-organised Sheet "genuinely is the right tool for a coach's first few clients" (search summary). https://elitecoachinghub.com/blog/coaching-software-vs-spreadsheets ; and the founder's own coach ran everything this way.
- **What they dislike / where it breaks** (described by a vendor, so read as typical, not measured): "It worked at five clients. It worked at ten. Somewhere between ten and twenty, it stopped working." "Google Forms has no scheduling. The form does not know who your clients are or who has submitted this week." "Data lands as a row in a Sheet. Photos land in a Drive folder. Call notes live in a Doc." "The coaching conversation lives in three places: your inbox, their inbox, and the Sheet." It also describes a "Tuesday-night check-in marathon". https://assistantcoach.fit/blog/google-forms-check-ins-fitness-coaching/
- Spotting a trend means comparing rows and building charts by hand (same source). [Inference, from the founder's story] Checking weights and RPE sheet by sheet, client by client, is exactly this.
- Clients and spreadsheets on a phone: clients dislike logging into a sheet mid-set; "if logging feels like a chore, they won't do it" (summary). https://gymkee.com/blog/track-client-workouts-personal-training/
- Programmes drift out of date: a warning sign is "clients regularly asking what programme they are on because the version in their inbox is outdated" (search summary). https://elitecoachinghub.com/blog/coaching-software-vs-spreadsheets
- A coach leaving spreadsheets on Capterra found Excel or Google Sheets-style programming "awkward to write in and increasingly confusing" (search summary, 2018 TrueCoach review). https://www.capterra.com/p/155784/truecoach/reviews/?page=2

### 4.2 WhatsApp and Instagram DMs
- "Nothing is searchable and nothing is transcribed, so finding the form-check video from week three means scrolling past two months of chat"; coaches often give up and ask the client to resend it (vendor summary). https://www.quickcoach.fit/coaching-clients-on-whatsapp.html
- Chat on a personal phone spills into private life (vendor summary, same source). A trainer on boundaries: "I make it clear to my clients that I respond to texts and calls only during certain hours of the day." (IDEA Fit, search snippet) https://ideafit.com/ldquohow-do-you-create-professional-boundaries-with-your-clientsrdquo
- A Show HN founder built a trainer app because chatting with his own trainer over WhatsApp was awkward (summary). https://news.ycombinator.com/item?id=47245678

### 4.3 The named platforms: likes, dislikes, prices

**Prices (October 2026, from vendor pages unless noted)**

| Platform | Price (per month) | Notes |
|---|---|---|
| ABC Trainerize | Free (1 client), Grow $9–10, Pro from $23; "Pro scales to $135/month for up to 50 clients" | Add-ons: nutrition $20–45, Stripe payments $10, video $10, branded app $169 one-off. https://www.trainerize.com/pricing/ |
| TrueCoach | Starter $26.34 (5 clients), Standard $57.99 (20), Pro $136.99 (50), billed yearly | Month to month about $30 / $70 / $165; going from 20 to 21 clients moves you from $69.98 to $164.98 (Coachway). https://truecoach.co/pricing/ , https://coachway.io/articles/truecoach-pricing/ |
| Everfit | Free (5 clients); Pro $19 (5) to $95 (50) to $140 (100) | Add-ons: automation from $29, payments from $9, meal plans from $39. https://everfit.io/pricing |
| Kahunas | $35 (25 clients), $69 (50), $99 (unlimited) | Per Capterra and Coachway. https://www.capterra.com/p/10028886/Kahunas/pricing/ , https://coachway.io/articles/kahunas-pricing/ |
| PT Distinction | $19.90 (3 clients, +$6 each), $59.90 (25), $89.90 (50) | Per Capterra. https://www.capterra.com/p/141155/PT-Distinction/pricing/ |
| My PT Hub | about €25 (3 clients), €59 unlimited, €215 Ultimate | Per Coachway; Capterra lists from $22.50. https://coachway.io/articles/my-pt-hub-vs-pt-distinction/ |
| Hevy Coach | $25 (1–10), $50 (11–25), $90 (26–50), $160 (51–100) | Per GetApp. https://www.getapp.com/all-software/a/hevy-coach/ |

[Inference] For a 30–50-client coach, the bill runs $60–$170 a month before add-ons. Pricing that steps by client count punishes exactly the growth they want.

**ABC Trainerize** (the market leader by awareness; client app 4.9★ from 69K ratings, https://apps.apple.com/us/app/516851502?see-all=reviews&platform=iphone ; Trustpilot 3.1, https://uk.trustpilot.com/review/trainerize.com?page=3 )
- Likes: "Trainerize centralized all my programming, macro tracking, and client check-ins" (Sarah A, 5★) https://ie.trustpilot.com/review/trainerize.com ; "Overall I love the app and how easy it is to program for my clients." (Ame G, 4★, 11 Sep 2024) https://uk.trustpilot.com/review/trainerize.com?page=4
- Dislikes, bugs and lost data: "App keeps wiping logged sets" and "Closes out, wipes the set history, then tells them they worked out for 60 seconds." (Roger Hebert, 1★, 8 Sep 2026) https://ie.trustpilot.com/review/trainerize.com ; "This app freezes all the time, and changes clients data information with other clients" (Sophie-Louise Armitage, 2★, 16 Nov 2023) https://uk.trustpilot.com/review/trainerize.com?page=5 ; "I am getting glitches all the time when creating plans for my clients." (Adam Vašica, 1★, 11 Dec 2023) same URL.
- Dislikes, value and clunkiness: "Overall, not worth the amount you pay." (Alec Montgomery, 1★, 28 Apr 2026) https://ie.trustpilot.com/review/trainerize.com ; "it felt complicated and clunky from the start." (Claire Greenhouse, 1★, "Complicated to use and rip off", 23 Sep 2025) same URL; "Good app, the library is an absolute joke though." (Ollie Jessop, 4★) https://uk.trustpilot.com/review/trainerize.com?page=4
- Dislikes from switchers (Capterra, search snippets): Trainerize was "too heavy and clunky"; it "was SO busy" and you couldn't copy individual workouts; "a huge pay wall to get premium access". https://www.capterra.com/p/155784/truecoach/reviews/?page=4
- Clients feel it too: "around half of the weekend sessions he posts for us don't arrive and we have to pester him on Saturdays" (Robert Matthews, client, 2★, 13 Jan 2024) https://uk.trustpilot.com/review/trainerize.com?page=5

**TrueCoach** (Capterra 4.8 from about 838 reviews, search summary https://capterra.com/p/155784/truecoach/reviews/ ; client app 4.9★; coach app TrueCoach Connect 1.8★ from 84 ratings https://apps.apple.com/us/app/truecoach-connect/id1445214677 ; about 16,000 coaches and 250,000 clients claimed as of 2025, third-party figure https://zoftwarehub.com/en-bh/products/westrive/product-details )
- Likes: "Allows me to programme in advance" (5★, 10 Jan 2025) https://www.trustpilot.com/review/truecoach.co ; copy and paste "has saved a lot of time with workouts and adding subtle progressions" (Capterra, search summary) https://www.capterra.com/p/155784/truecoach/reviews/?page=3
- Dislikes, price: "Perfect, but expensive, but perfect (to me)." (5★, 9 Jan 2025) and "paying a rather large (possibly overpriced) monthly subscription" (1★, 12 May 2026) https://www.trustpilot.com/review/truecoach.co ; a plan that rose from $99 to $119 a month (Capterra, search summary) https://www.capterra.com/p/155784/truecoach/reviews/?page=4
- Dislikes, the coach's phone app: "Whenever I click on a client message inside the app the screen goes white and freezes the app." (thecoach_anna, 2022) and "With TrueCoach you can only message and see workouts completed." (jopeyu, 2023) https://apps.apple.com/us/app/truecoach-connect/id1445214677
- Dislikes, nutrition: through MyFitnessPal "you can only view macros, not micros or food log" (G2, search summary). https://www.g2.com/products/truecoach
- Dislikes from clients (who are the coach's customers): "it is the worst app I have used in terms of workout tracking" and "I'd like an easier way to track sets and reps, charts that clearly show strength improvements over time." https://apps.apple.com/us/app/truecoach/id1439127794?see-all=reviews&platform=iphone ; and after a redesign a coach wrote "the new update now acts as a barrier of entry to any new clients looking to work with me." (Joshua Lee Clay, 2021) same URL.
- Lock-in: "True Coach cut me off & locked my data as my coach is 'inactive'" (client, 1★, 11 Jun 2025) https://www.trustpilot.com/review/truecoach.co

**Everfit** (Coach app 4.5★ from 177 ratings)
- Likes: "I have better client retention than I did before using Everfit"; "The interface is intuitive, the flow is smooth" https://apps.apple.com/us/app/everfit-for-coach/id1485827117?see-all=reviews&platform=iphone ; generous free tier and per-client cost "around two dollars" (5★) https://www.trustpilot.com/review/everfit.io
- Dislikes: "The messenger function is probably the weakest part of the application"; "The app seems to crash two out of three times when I try to put together a workout."; "Comments are virtually inaccessible after you leave them"; the meal tracker is "a bit misleading" (it is a photo food diary) https://apps.apple.com/us/app/everfit-for-coach/id1485827117?see-all=reviews&platform=iphone ; "Everfit is one of the more expensive platforms on the market" and "you can't simply create a meal directly within a meal plan" (Gary Burtenshaw, 1★, 21 Oct 2026); "Sorry but charging an extra 50 dollars for automation is ridiculous" (jordan, 1★, 8 Aug 2023); "They have no customer service, only texting back and forth" (Julie Mastro, 1★, 2 Oct 2025) https://www.trustpilot.com/review/everfit.io

**Kahunas** (Trustpilot 4.8 from 459 reviews; most praise is for support staff by name)
- Likes: "their customer service is truly impressive. Every time I reach out someone responds promptly and professionally." (Mike, 5★, 6 Sep 2026) https://www.trustpilot.com/review/kahunas.io ; a coach leaving Trainerize after years: "there's a lot of change for me as a coach who has used another training platform for many years." (Jason Brophy, 5★, 28 Jul 2026) same URL.
- Dislikes: "The app itself is a nightmare, riddled with bugs that never get fully resolved." and "The support team is quick to mark issues as 'resolved' the moment they respond." (Gary Burtenshaw, 1★, 10 Mar 2025); "the app is constantly crashing and clients lose all their tracking data." (Tim Williams, 2★, 6 Mar 2025) https://www.trustpilot.com/review/kahunas.io?page=7 ; "The platform has not improved in over 2 years" (Testy, 1★, 18 May 2026) https://www.trustpilot.com/review/kahunas.io

**PT Distinction** (Trustpilot 4.8 from 297 reviews)
- Likes: "The app makes program delivery, progress tracking, habit tracking, check-ins, and client communication extremely smooth." (Abdul Basith, 5★, 29 Dec 2025); "I LOVE the photo Journal option and the daily 'to do' list for clients to check off." (Shelley Bonney Gaudet, 5★, 27 Jan 2026) https://www.trustpilot.com/review/ptdistinction.com
- Dislikes: "there is no way to substitute or adapt workouts on the go." (Michael Campbell, 4★, 24 May 2026) same URL.

**My PT Hub** (Trustpilot 4.4 from 2,557 reviews)
- Likes: phone onboarding calls; a coach who moved from Trainerize found it "better-value in terms of price and client capacity" (Quora, search snippet) https://www.quora.com/Which-is-the-best-software-for-personal-trainers-in-the-market
- Dislikes: "For £52 per month, I expected a much more polished and feature-rich product." and "both the web and mobile platforms are slow and laggy." (1★, 23 Jun 2026); "App is glitchy, clients do not enjoy the mobile experience." (1★, 30 Sep 2025); "they signed me up for another 12 months without clients." (2★, 17 Sep 2025); "My clients have had many problems with the videos, as they do not play." https://www.trustpilot.com/review/mypthub.net

**Exercise.com** (gyms and bigger coaching businesses)
- Likes: "the customer service we received throughout the process of migration was truly exceptional." (5★, 19 Oct 2026)
- Dislikes: "The admin dashboard is clunky as hell, honestly." (5★ review, 7 Oct 2026); "The second integration was a disaster that cost me $15,000 in RECOGNIZED Revenue." (1★, 28 Jun 2026); "They consistently told us it was "user error" for the first ~3 months." (1★, 9 Jan 2026) https://www.trustpilot.com/review/exercise.com

**Hevy Coach** (newer; strength-focused coaches whose clients already log in Hevy)
- Likes: "If you are a coach looking for a software that is easy to use, HEVY is a great option." https://apps.apple.com/app/id6502961756
- Dislikes: no nutrition, check-ins or payments built in; coaches "usually leave for scope, not faults" (Coachway, a competitor, summary). https://coachway.io/articles/hevy-coach-review

**Not researched in depth** (no usable reviews reached): CoachRx, TrainHeroic, Harbiz, Zenfit, Coach Catalyst. CoachRx's own help says a typed reply to a form check "is much less effective than a video response" (summary) https://intercom.help/coachrx/en/articles/6891954-video-messaging-with-loom

### 4.4 What the market likes across all solutions [synthesis]
Ease for clients ("my clients just buy in"), one place for programming, food and check-ins, copy-forward programming, a good library they can add their own videos to, quick human support, a branded app, and better retention.

### 4.5 What the market dislikes across all solutions [synthesis]
Bugs that lose a client's data or crash while building a plan; canned or automated support; add-on pricing and client-tier price cliffs; weak coach phone apps; too many taps to log a set; nutrition that is only MyFitnessPal macros or a photo diary; messaging that is slow, unsearchable or loses comments; strength progress that isn't shown clearly; payments that don't work in their country; data held hostage when a coach or client leaves.

---

## 5. Horror stories

1. **The client who walked.** A coach of nearly five years on Kahunas says repeated workout, nutrition and check-in bugs made a client leave: "I lost a paying client—$2,200 AUD gone." Support offered a free month; he moved his clients to Everfit. (Gary Burtenshaw, 10 Mar 2025) https://www.trustpilot.com/review/kahunas.io?page=7 . A reviewer of the same name later left Everfit too: "Possibly the worst customer service I've experienced from a company." and "For me, this is the final straw." (21 Oct 2026) https://www.trustpilot.com/review/everfit.io [Inference: likely the same coach, a serial switcher; not confirmed.]
2. **Sets wiped mid-workout.** "Closes out, wipes the set history, then tells them they worked out for 60 seconds." (Trainerize, 8 Sep 2026) https://ie.trustpilot.com/review/trainerize.com
3. **Clients' data swapped.** "changes clients data information with other clients" (Trainerize, 2★, 16 Nov 2023) https://uk.trustpilot.com/review/trainerize.com?page=5
4. **Hundreds of complaints in the inbox.** "I have hundreds of messages from frustrated clients complaining about constant issues." (Kahunas, Gary Burtenshaw) https://www.trustpilot.com/review/kahunas.io?page=7
5. **$15,000 gone in a migration.** "The second integration was a disaster that cost me $15,000 in RECOGNIZED Revenue." (Exercise.com, 28 Jun 2026) https://www.trustpilot.com/review/exercise.com
6. **Charged after cancelling / locked in for a year.** "they signed me up for another 12 months without clients." (My PT Hub, 17 Sep 2025) https://www.trustpilot.com/review/mypthub.net ; "Trainerize never received a cancel notice from me so continued to charge card." (31 Jan 2025) https://uk.trustpilot.com/review/trainerize.com?page=3
7. **The coach's chat goes white.** TrueCoach Connect: every client message opens a blank, frozen screen, for months. https://apps.apple.com/us/app/truecoach-connect/id1445214677
8. **The client's history held hostage.** "True Coach cut me off & locked my data as my coach is 'inactive'" https://www.trustpilot.com/review/truecoach.co
9. **Coach's Eye switched off.** The app coaches used to slow down, draw on and voice over a lift was retired by TechSmith in 2022; "anything left only in the Coach's Eye cloud was deleted" (summary). https://coachway.io/articles/coachs-eye-alternatives/ , https://alternativeto.net/software/coach-s-eye/about
10. **Weekend sessions that never arrive**, so clients "pester him on Saturdays". https://uk.trustpilot.com/review/trainerize.com?page=5

---

## 6. Does the market believe existing solutions work? Sophistication, curiosity, corruption

### 6.1 Belief
- **Partly.** Coaches believe software can work (many 5★ reviews), but they distrust any single vendor: reviews swing between "game changer" and "nightmare" on the same product, and the same coach can praise one platform and leave it two years later. The ratings gap shows it: client apps rate 4.9★ on the App Store while the companies sit at 3.1–3.5 on Trustpilot (Trainerize) and coach apps at 1.8 (TrueCoach Connect).
- **Why the doubt:** buggy updates ("It was simple enough to get the job done, but now there are a ton of bugs." Alec Montgomery, Trainerize) https://ie.trustpilot.com/review/trainerize.com ; private-equity ownership and canned support; and the sense that apps are built for selling programmes at scale, not for watching each client closely. [Inference]
- **Spreadsheet loyalists** believe the sheet works and is free; their objection is cost and loss of flexibility, not that apps don't work. "A guide addressing cost concerns notes that Google Sheets is free, while coaching software isn't" (summary). https://assistantcoach.fit/blog/google-sheets-to-fitness-coaching-software/

### 6.2 What has been tried and failed
- Spreadsheets plus WhatsApp plus Forms (works to about 10–20 clients, then breaks; see 4.1).
- Notion "all-in-one coaching OS" templates sold on Gumroad (search results show several). https://notion4biz.gumroad.com/l/ajorgq
- WhatsApp-only delivery tools (FitFlow: "Deliver coaching via WhatsApp & Telegram — no app needed"). https://www.producthunt.com/p/fitflow-bizos-for-coaches/fitflow-3
- Automated check-ins that "simulate" attention, called "hollow" by a coaching company (summary). https://www.trainwell.net/blog/online-fitness-coaches-who-actually-check-in-on-you
- Weekly client video check-ins instead of open messaging (PT Distinction's 2017 advice). https://portal.ptdistinction.com/blog/video-check-ins-to-easily-communicate-with-your-clients
- AI coaches for the end user, which beta users found "too slow mid-workout" (Indie Hackers, summary). https://www.indiehackers.com/post/solo-founder-building-ai-fitness-coach-6-months-in-heres-what-i-learned-7917062563

### 6.3 Market sophistication: stage 4 to 5 [Inference from evidence]
- Vendors found in this research publishing near-identical "replace the spreadsheets, WhatsApp and Calendly with one app" content: Coachway, FitBudd, Trainero, HubFit, QuickCoach, Assistant Coach, CoachingPortal, Elite Coaching Hub, Coached, CoachOS, TrainedBy, CoachPro+, Gymkee, LVLUP, Trainwell, Coachful, plus Trainerize, TrueCoach, My PT Hub, Kahunas and Everfit's own blogs. Representative lines: CoachOS replaces "spreadsheets, messaging apps, and standalone tools" (GetApp, summary) https://www.getapp.com/all-software/a/coach-os/ ; TrainedBy is pitched to move coaches "beyond WhatsApp, spreadsheets, and PDFs" (summary) https://www.capterra.com/p/10041945/TrainedBy/ ; Coached replaces "Programs in one doc, nutrition plans in another, check-ins scattered across emails and DMs" https://news.ycombinator.com/item?id=46204694
- So "all-in-one", "save hours", "ditch the spreadsheets", "branded app" and now "AI" are claims the coach has seen many times. A new entrant must lead with a specific mechanism, proof, or an identity the coach recognises, not the category claim.

### 6.4 Awareness
- [Inference] Most of the target market is **solution-aware to product-aware**: they know Trainerize, TrueCoach and Everfit by name, many have used one or two. Spreadsheet coaches are **problem-aware** but have normalised the pain ("it worked at ten").
- The trust bar for a new tool is high: "it isn't 'is this better than my spreadsheet'. it's 'do i trust a one-week-old tool from someone i've never met with my clients' payment details and session notes'" (Indie Hackers commenter, search snippet). https://www.indiehackers.com/post/i-built-a-saas-for-personal-trainers-in-under-a-week-turns-out-that-was-the-easy-part-29c9e88209

### 6.5 Curiosity: older or lost solutions
- **Coach's Eye (about 2012–2022)**: slow motion, frame-by-frame, drawing on screen, side by side and voice-over, the tool coaches used for video feedback; retired by TechSmith in 2022, apps pulled and cloud deleted. Replacements named are Hudl Technique, OnForm and Kinovea, none built into a coaching platform. https://coachway.io/articles/coachs-eye-alternatives/ , https://swing-analysis.v1sports.com/swing-analysis/coachs-eye-alternatives
- **The paper training log and the coach's notebook**: before apps, the coach wrote every set, saw every number and noticed when a client stalled. [Inference] An angle: the attention of the old one-to-one notebook, at forty clients.
- **Ubersense** (later Hudl Technique) and Coach's Eye were the first "draw on the video" apps (named in alternatives lists). https://alternativeto.net/software/coach-s-eye

### 6.6 Corruption: did the pain get worse because of an outside force?
- [Inference, supported by the timeline] Yes, in two ways:
  1. **2020 pushed everyone online overnight.** In-person-only trainers fell from 56% to 5%, online-only rose from 10% to 56% (PTDC). https://athletechnews.com/personal-trainer-salary-survey-2020-results-revealed/ Trainers adopted whatever tool was nearest; the spreadsheet and WhatsApp habit dates from then.
  2. **The same year the two biggest coaching apps were bought.** Trainerize by ABC Financial (Thoma Bravo-backed), September 2020; TrueCoach by TSG (Advent International), April 2020 (search summaries; ABC source https://www.businesswire.com/news/home/20200915005117/en ). Since then reviews describe price increases, add-ons, slower updates and canned support. A story: the tools coaches depend on are now owned by firms that also sell gym management software, and the solo coach isn't their customer.
  3. Smaller version: MyFitnessPal paywalled its barcode scanner in 2022. https://www.droid-life.com/2022/08/24/myfitnesspal-puts-barcode-scanner-behind-premium-paywall/

---

## 7. Market size and trends

- Fitness coaching platform market: USD 1.8 billion in 2025, projected USD 4.9 billion by 2034, 12.4% CAGR; North America about 42.5% of revenue (commercial report, summary). https://marketintelo.com/report/fitness-coaching-platform-market
- Coaching software overall: USD 3.7 billion in 2024, USD 10.4 billion by 2034, 10.9% CAGR (Market.us, as cited by Coachway). https://coachway.io/articles/online-fitness-coaching-statistics-2026/
- Broader fitness and wellness software: USD 81.9 billion in 2024 to 133.7 billion by 2030 (Arizton; includes gym software). https://www.arizton.com/market-reports/fitness-and-wellness-software-market
- Workforce: 370,100 US fitness trainer and instructor jobs in 2024, projected to grow 12% by 2034 (BLS, via Coachway); US personal training market USD 11.9 billion across about 329,302 businesses (IBISWorld, via Coachway). https://coachway.io/articles/online-fitness-coaching-statistics-2026/
- Online adoption: after 2020, 67% planned a mix of online and in-person, 21% primarily online, 10% primarily in person. https://athletechnews.com/personal-trainer-salary-survey-2020-results-revealed/
- Trends seen in this research:
  - Consolidation under private equity (ABC/Thoma Bravo, TSG-Advent/Xplor).
  - Everyone adding AI; trainers use it for admin but guard the human part (ISSA, December 2025). https://athletechnews.com/personal-trainers-using-ai-but-not-blindly-embracing-it-issa-report/
  - A new wave of cheap, "free for N clients" and per-client-cheap tools (Everfit free to 5, Coachway, Hevy Coach), squeezing the incumbents on price.
  - Logging apps adding a coach side (Hevy Coach), meeting strength coaches whose clients already log there.
  - Churn and retention as the business metric of the moment ("Retention, Not Acquisition, Is the Real Key", TrueCoach blog). https://truecoach.co/blog/the-hidden-cost-of-client-churn-why-retention-not-acquisition-is-the-real-key-to-coaching-success/

---

## 8. Verbatim quote bank (for the avatar sheet)

### General
- "Trainerize centralized all my programming, macro tracking, and client check-ins" (Sarah A) https://ie.trustpilot.com/review/trainerize.com
- "It allows you to guide and motivate all your clients with proper form" (TrueCoach, 5★, 15 Jan 2025) https://www.trustpilot.com/review/truecoach.co
- "to keep track of clients and communicate with them efficiently" (TrueCoach, 5★, 10 Jan 2025) https://www.trustpilot.com/review/truecoach.co
- "Tracking daily metrics for your clients (e.g. Weight, Steps, etc.) is also easy to set up." (Nick Meyer, PT Distinction) https://www.trustpilot.com/review/ptdistinction.com
- "It keeps my clients on task for tracking and accountability." (Debbie Martilotta, PT Distinction) https://www.trustpilot.com/review/ptdistinction.com
- "Highly recommend it for any trainers or small gyms looking for a simple platform to run their business." (Cal Page, Trainerize App Store) https://apps.apple.com/us/app/516851502?see-all=reviews&platform=iphone

### Pains and frustrations
- "Terrible interface, way too many bugs that should be really easy to fix." (SIM Bondi, Trainerize, 1★, 1 Oct 2026) https://uk.trustpilot.com/review/trainerize.com?page=3
- "I am getting glitches all the time when creating plans for my clients." (Adam Vašica) https://uk.trustpilot.com/review/trainerize.com?page=5
- "The app seems to crash two out of three times when I try to put together a workout." (Everfit for Coach) https://apps.apple.com/us/app/everfit-for-coach/id1485827117?see-all=reviews&platform=iphone
- "Comments are virtually inaccessible after you leave them" (Everfit for Coach) same URL.
- "If I assign a rep range to a client, it either defaults to the lower end of the range" (Everfit for Coach, 8 Aug 2025) same URL.
- "Too many button clicks to enter workout results." (TrueCoach, 2021) https://apps.apple.com/us/app/truecoach/id1439127794?see-all=reviews&platform=iphone
- "Workouts do not autocomplete when there are entries for each exercise." (TrueCoach) same URL.
- "Coach app is next to useless, to really manage your clients you have to use the web front." (Hevy Coach) https://apps.apple.com/app/id6502961756
- "I wish you could playback and erase voice messages before sending to client." (Alisa, Trainerize, 4★) https://uk.trustpilot.com/review/trainerize.com?page=3
- "I would like to see the DM feature a little more user friendly and engaging." (TrueCoach, 4★) https://www.trustpilot.com/review/truecoach.co
- "great app but for the love of god…" "please let us create folders to store workouts in!" (TrueCoach, 4★) https://www.trustpilot.com/review/truecoach.co
- "Need ability to manage clients meals on the web browser." (Sebastian, Trainerize, 4★) https://uk.trustpilot.com/review/trainerize.com?page=4
- "Sometimes it takes awhile to get answers from support." (Exercise.com, 4★) https://www.trustpilot.com/review/exercise.com
- "The coaching conversation lives in three places: your inbox, their inbox, and the Sheet." (vendor) https://assistantcoach.fit/blog/google-forms-check-ins-fitness-coaching/

### Mindset
- "It is about you can't help people if you burn out." https://thewarmup.transistor.fm/episodes/the-3-b-s-of-avoiding-pt-burnout-what-s-actually-worked-for-me/transcript
- "So the first thing I wanna say is that everyone's capacity as a trainer is different." same URL.
- "There's no painless way to scale once you're in the 20-30 hours of PT range." (r/personaltraining via FitBudd) https://www.reddit.com/r/personaltraining/comments/1subxf1/being_a_pt_goes_brutal_dope_brutal_too_many/
- "And if people love what you do, they will pay more." https://thewarmup.transistor.fm/episodes/the-3-b-s-of-avoiding-pt-burnout-what-s-actually-worked-for-me/transcript
- "Kahunas has made possible to elevate and improve my online coaching." (Rodney Alexander, 5★) https://www.trustpilot.com/review/kahunas.io?page=7
- "I've used Kahunas as a client, but moving into the coaching world I knew I needed to ensure" (Sharon Bickerton) https://www.trustpilot.com/review/kahunas.io

### Emotional state and personal drivers
- "I was a struggling trainer.." (Grant Corriveau, review title) https://uk.trustpilot.com/review/trainerize.com?page=5
- "Now I have the time, money, and freedom to be with my family and to do what I truly love to do." (Fit Game) same URL.
- "And I'm working at strange hours that maybe disrupt your family." https://thewarmup.transistor.fm/episodes/the-3-b-s-of-avoiding-pt-burnout-what-s-actually-worked-for-me/transcript
- "I'm starting to resent going to my classes." same URL.
- "Do I charge crazy high prices, do I take on more clients and burn myself out." (r/personaltraining via FitBudd) https://www.reddit.com/r/personaltraining/comments/1subxf1/being_a_pt_goes_brutal_dope_brutal_too_many/

### Emotional responses to struggles
- "For me, this is the final straw." (Everfit, 21 Oct 2026) https://www.trustpilot.com/review/everfit.io
- "I've been a client for almost a decade…but not much longer." (Nicky, Trainerize, review title) https://ie.trustpilot.com/review/trainerize.com
- "I felt that my experience was dismissed rather than acknowledged" (My PT Hub, 1★, 23 Jun 2026) https://www.trustpilot.com/review/mypthub.net
- "They essentially didn't believe me" (Alec Montgomery, Trainerize) https://ie.trustpilot.com/review/trainerize.com
- "I'm tired of being an unpaid therapist for energy-draining clients." (r/personaltraining via FitBudd) https://www.reddit.com/r/personaltraining/comments/1sxzl72/quitting_personal_training_and_fitness_coaching/
- "Good from far, but far from good" (Tim Williams, Kahunas, review title) https://www.trustpilot.com/review/kahunas.io?page=7
- "Possibly the worst App and Management team ever." (Testy, Kahunas, review title) https://www.trustpilot.com/review/kahunas.io

### Motivation and urgency
- "I've already started transferring clients over to everfit." (Gary Burtenshaw, Kahunas) https://www.trustpilot.com/review/kahunas.io?page=7
- "I had to switch to another app of better quality." (My PT Hub, 2★) https://www.trustpilot.com/review/mypthub.net
- "Being able to create groups and packages has been a game changer." (Dan Hall) https://www.trustpilot.com/review/ptdistinction.com
- "I have better client retention than I did before using Everfit" https://apps.apple.com/us/app/everfit-for-coach/id1485827117?see-all=reviews&platform=iphone
- "Since changing over to PT distinction…" managing clients "has become so much easier." (Tom, 5★, 9 Oct 2026) https://www.trustpilot.com/review/ptdistinction.com

### Fears
- "We have had multiple clients leave because of how bad this app is" (Kahunas) https://www.trustpilot.com/review/kahunas.io
- "I lost a paying client—$2,200 AUD gone." https://www.trustpilot.com/review/kahunas.io?page=7
- "the new update now acts as a barrier of entry to any new clients looking to work with me." (TrueCoach) https://apps.apple.com/us/app/truecoach/id1439127794?see-all=reviews&platform=iphone
- "They're worried that everyone's gonna leave them." (on trainers who won't set boundaries) https://thewarmup.transistor.fm/episodes/the-3-b-s-of-avoiding-pt-burnout-what-s-actually-worked-for-me/transcript
- "If you burn out and leave the industry, you are not helping people in this industry at all anymore." same URL.

---

## 9. The coach's client (secondary)

What clients of online coaches praise and complain about. These shape the coach's fear: whatever the client feels, the coach pays for in churn.

**Feeling unseen**
- "No one there even knows who I am." (Latonya Wilson, 19 Aug 2025) https://www.trustpilot.com/review/warriorbabe.com?stars=1&stars=2
- "I told my coaches repeatedly something was wrong" and "I changed coaches but the plan stayed exactly the same." (SG, 27 Jan 2026) same URL.
- "Feels like they say the same thing every week during check in." (3★, 15 Oct 2025) https://www.trustpilot.com/review/empoweronlinecoaching.com
- "She didn't keep tabs on my progression as much as she should have." (Mani, 1★, 1 Nov 2025) same URL.
- "the feedback and responses felt automated and AI-generated, rather than coming from a coach who genuinely knew my journey." (L Hooks, 7 Jun 2026) same URL.
- "I was surprised by the very limited 1:1 input provided." (Naz Y, 19 Jun 2025) https://www.trustpilot.com/review/cicionlinecoaching.com

**Slow or missing replies, overloaded coaches**
- "I can see the delayed responses and that she is overwhelmed but still taking more and more." (Mar 2026) https://www.trustpilot.com/review/warriorbabe.com?stars=1&stars=2
- "My calls were literally less than 2 minutes and the check-ins were around 3 minutes." (Josie Dawe, 3 May 2026) same URL.
- "I never got a follow up from Cici as to why, until I text expressing my dissatisfaction." (Jen, 5 Aug 2024) https://www.trustpilot.com/review/cicionlinecoaching.com
- A last check-in left unanswered before cancelling (summary). https://www.trustpilot.com/review/bitebackwithliz.com?page=2

**The app and the tools**
- "it is the worst app I have used in terms of workout tracking." https://apps.apple.com/us/app/truecoach/id1439127794?see-all=reviews&platform=iphone
- "I'd like an easier way to track sets and reps, charts that clearly show strength improvements over time." same URL.
- "There was no focus on nutrition--just fill out My Fitness Pal." https://www.trustpilot.com/review/warriorbabe.com?stars=1&stars=2
- "There are 3 macro calculators with zero guidance on which to use." same URL.
- "I didn't like the communication style on the app, it's a voicemail from Cici and I could only text back." https://www.trustpilot.com/review/cicionlinecoaching.com
- "Be warned, if you cancel future payments you'll be locked out of the app" same URL.

**What clients love (the opposite)**
- "I finally feel like I've got someone in my corner who I can be accountable to" (Kim Shepherd) https://www.trustpilot.com/review/cicionlinecoaching.com
- "what I appreciated most was how much effort Cici put into asking questions about what was and wasn't working for me." (Nader Alikhani) same URL.
- "I love have direct communication with my trainer who is very much available and helpful anytime I need assistance." https://apps.apple.com/us/app/516851502?see-all=reviews&platform=iphone
- "Every workout that he helps me with, he tells me what muscles and what position in basketball that it helps with." same URL.

**[Inference]** The client wants proof the coach looked: a reply that names their numbers, a programme that changes when they stall, feedback on their own lift. The founder's experience as a client ("I could feel my coach couldn't stay on top of every client") is the same feeling these reviews describe.

---

## 10. What this means for the next steps (Avatar Sheet and Offer Brief) [Inference throughout]

**Avatar, in one line:** an online or hybrid coach, 28–45, 10–60 clients at €130–€250 a month, earning roughly €2,000–€12,000 a month, who is a better coach than they are an admin, works evenings and Sundays on check-ins, and is quietly afraid that a client will feel unseen and leave.

**Key pains, grouped**
1. Not seeing every client properly: data spread across Sheet, Drive, WhatsApp and MyFitnessPal; trends built by hand; checking weights and RPE row by row; missing that a client stalled or a pain came back.
2. Time and boundaries: check-in day as a marathon, messages 24/7 on a personal phone, form-check videos lost in chat, the coach's own life squeezed.
3. Tools they can't trust: bugs that wipe sets, support that marks things "resolved", price cliffs and add-ons, coach apps that don't work on a phone, the risk of switching again.

**Emotional journey**
- Awareness: "It worked at five clients. It worked at ten."
- Frustration: Sunday check-ins, scrolling WhatsApp for week three's video, a client asking which programme is current.
- Desperation and seeking: tries Trainerize or Everfit, finds it clunky, buggy or expensive, or loses a client to a bug; considers going back to Excel.
- Relief and commitment: one place that is fast, reliable, shows them who needs them, and makes clients feel coached, from a company that answers.

**Objections to expect**
- "Sheets are free and I can make them do anything."
- "My clients won't download another app."
- "I've switched before; moving 40 clients is a nightmare." / "What happens to my data if I leave?"
- "Do I trust a new tool with my clients' data and payments?"
- "Will it break mid-workout like the last one?" / "Will anyone answer when it does?"
- "Pricing by client count punishes me for growing."
- "Will it make my coaching feel automated?" (clients now call this out)
- "Does it work in my country, my currency, with Stripe?"
- "My clients log food in MyFitnessPal; I'm not making them move."

**Sophistication and angle notes**
- Stage 4–5: do not lead with "all-in-one" or "save hours". Lead with a mechanism the coach hasn't heard: for example, strength trends and PBs worked out from every logged set so nothing is checked by hand; a feed of what needs the coach; drawing over the client's lift while talking (the Coach's Eye gap); links that open the exact set or meal being discussed.
- Possible origin and discovery story: the founder was the client who could feel his coach couldn't keep up, with a coach running everything in Google Sheets, sheet by sheet. It mirrors the clients' reviews above and the coaches' fear, and it is first-hand.
- Possible "corruption" frame: 2020 moved coaching online overnight and the same year the leading apps were sold to private equity; coaches have been paying more for canned support since.

---

## 11. Gaps and next research steps

- **Reddit (r/personaltraining, r/OnlineCoaching, r/fitnessbusiness), coaching Facebook groups (PTDC, Online Trainer Academy, platform user groups) and YouTube comments** could not be read here. They are where coaches speak most freely. A manual hour sorted by "top" and "most comments" for searches like "Trainerize", "TrueCoach", "Everfit", "Google Sheets", "check-ins", "form check", "client ghosted" would add the most raw voice.
- Capterra and G2 full reviews (blocked to direct reading) hold hundreds of "switched from" and "cons" answers; worth reading in a browser.
- No survey found on coaches' admin hours or time per check-in that isn't a vendor estimate; Finlay's and a few coaches' own numbers would be stronger than anything public.
- Not reached: CoachRx, TrainHeroic, Harbiz, Zenfit, Coach Catalyst reviews; client-count data outside the Nordics; the share of coaches still on spreadsheets.

---

## Sources (distinct, by group)

Surveys and data: theptdc.com/articles/personal-trainer-salary-survey · athletechnews.com/personal-trainer-salary-survey-2020-results-revealed · americanspa.com (PTDC 2020) · coachway.io/articles/online-fitness-coaching-statistics · coachway.io/articles/online-fitness-coaching-statistics-2026 · mypthub.net/?p=16319 · careerexplorer.com · fitbudd.com/fitness-burnout-2026-27 (Snarr & Beasley 2022; Reddit quotes) · leisureopportunities.co.uk (Workforce State of Mind) · athletechnews.com (ISSA AI report) · fitbudd.com AI report · athleticbusiness.com (NASM 40+) · marketintelo.com · arizton.com · keedia.com · exercise.com/grow · gymkee.com (two pages) · zoftwarehub.com.

Reviews: uk.trustpilot.com Trainerize pages 3, 4, 5 · ie.trustpilot.com Trainerize · trustpilot.com TrueCoach · Everfit · Kahunas (pages 1 and 7) · My PT Hub · PT Distinction · Exercise.com · WarriorBabe · Cici Online Coaching · Empower Online Coaching · Bite Back · App Store: TrueCoach, TrueCoach Connect, Everfit for Coach, ABC Trainerize, Hevy Coach · Capterra TrueCoach and Trainerize (snippets) · G2 TrueCoach (snippets) · Quora (snippets).

Pricing: trainerize.com/pricing · truecoach.co/pricing · everfit.io/pricing · capterra.com Kahunas and PT Distinction pricing · coachway.io Kahunas, TrueCoach, My PT Hub vs PT Distinction, Hevy Coach pages · getapp.com Hevy Coach.

Practice and opinion: assistantcoach.fit (Google Forms, Sheets) · quickcoach.fit (WhatsApp) · elitecoachinghub.com · thewarmup.transistor.fm transcript · ideafit.com · barbell-logic.com · trainwell.net · blog.trainero.com · truecoach.co blog · intercom.help/coachrx · portal.ptdistinction.com · theptdc.com/?p=63842 · elitefts.com · barbend.com · forum.bodybuilding.com · indiehackers.com (two posts) · news.ycombinator.com (two items) · producthunt.com FitFlow · getapp.com CoachOS · capterra.com TrainedBy · notion4biz.gumroad.com · eofire.com · fitbudd.com webinar.

History and industry: thomabravo.com and businesswire.com (ABC acquires Trainerize) · g2.com (Xplor TrueCoach) · coachway.io and alternativeto.net and v1sports.com (Coach's Eye) · droid-life.com and digitaltrends.com (MyFitnessPal paywall).
