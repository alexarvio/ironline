// The queued copy and layout changes of 7 Nov (Alex), applied once the builders were done with index.html.
import { readFileSync, writeFileSync } from "node:fs";
const file = process.argv[2];
let s = readFileSync(file, "utf8");
const swapBetween = (startMark, endMark, html) => {
  const a = s.indexOf(startMark);
  const b = s.indexOf(endMark, a);
  if (a < 0 || b < 0) throw new Error("missing " + startMark.slice(0, 50));
  s = s.slice(0, a) + html + s.slice(b + endMark.length);
};

// 1. How it works: what a phase is, plainly.
swapBetween(`<p class="lede">You plan each client in blocks`, `</p>`,
  `<p class="lede">Every client has a plan made of phases: blocks of weeks with one goal each, like a 6-week strength block or a 12-week lean bulk. You run three side by side, for training, nutrition and lifestyle, and line up the next ones before the current one ends. Your client sees which phase they're in and which week on their home screen. You see, week by week, what they actually did against it.</p>`);

// 2. The problem: the paragraph says what goes wrong; the platform line goes.
swapBetween(`<p class="money">You haven't stopped caring.`, `</p>`,
  `<p class="money">With a few clients, you see every set and answer every message the same day. With twenty or thirty, things start to slip: a check-in reply goes out a day late, then two, and a stalled lift goes unnoticed for weeks. You care just as much as before. But your clients feel the difference, and that's when they start looking elsewhere. Keeping one client a year longer at €180 a month is <b>€2,160</b> you don't have to win back.</p>`);
swapBetween(`<p class="quotes-fact">`, `</p>`, ``);

// 3. What your client feels: four tiles, the linking first.
const tile = (icon, colour, title, text) => `
      <article class="tile">
        <span class="tile-icon" style="color: ${colour}"><svg aria-hidden="true"><use href="#${icon}"/></svg></span>
        <h3>${title}</h3>
        <p>${text}</p>
      </article>`;
const sixStart = s.indexOf(`<div class="six">`);
const sixEnd = s.indexOf(`<p class="rest">`, sixStart);
if (sixStart < 0 || sixEnd < 0) throw new Error("tiles not found");
s = s.slice(0, sixStart) + `<div class="six four">` +
  tile("i-link", "var(--blue)", `No more "which exercise?"`, `When your client has a question, they ask it from the exercise, meal or check-in it's about: "how should I place my feet on this one?" The message comes to you linked to it. One tap and you're looking at that exact exercise with their sets, without searching or asking which one they mean. It works the same way when you write to them.`) +
  tile("i-play", "var(--teal)", `Form checks on video`, `Your client films a set and sends it from the exercise. You watch it slowed down, draw lines and arrows on it and talk them through it, like you're standing next to them. They get the video back on that exercise.`) +
  tile("i-list", "var(--ink)", `Goals that are theirs`, `After each call, up to three goals you agreed sit at the top of their app until the next one. Add a weight goal with a target and a date, and they can see whether they're on track.`) +
  tile("i-pen", "var(--indigo)", `Notes where they'll read them`, `Put a note on their training block, a single session, an exercise ("pause at the bottom") or a meal. They read it at the moment it applies, not buried in a chat.`) +
  `
    </div>
    ` + s.slice(sixEnd);
swapBetween(`<p class="lede">That's what NorCoach is for: your name,`, `</p>`, `<p class="lede">That's what NorCoach is built for. Four things make the difference.</p>`);

// 4. In Emma's app: drawn as the app's notifications (NotificationsScreen.tsx, globals.css .ntf-*).
const P = {
  dumbbell: "M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12",
  play: "M8 5v14l11-7z",
  list: "M10 6h10M10 12h10M10 18h10M5 6h.01M5 12h.01M5 18h.01",
  chat: "M4 5h16v11H9l-5 4z",
};
const ntf = (c, icon, fill, cat, time, title, body, action, unread) => `
        <div class="nt${unread ? "" : " read"}" style="--c:${c}"><span class="nt-av"><span class="nt-badge"><svg viewBox="0 0 24 24"><path d="${icon}" ${fill ? `fill="currentColor"` : `fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"`}/></svg></span></span><span class="nt-c"><span class="nt-top"><span class="nt-cat">${cat}</span><span class="nt-time">${time}</span>${unread ? `<span class="nt-dot"></span>` : ""}</span><span class="nt-title">${title}</span>${body ? `<span class="nt-body">${body}</span>` : ""}<span class="nt-act">${action}</span></span></div>`;
const bar = `<i class="sep"></i>`;
swapBetween(`<p class="faces-head" aria-hidden="true">In Emma's app this week</p>`, `<p class="faces-cap" aria-hidden="true">Every line written by her coach.</p>`,
  `<p class="faces-head" aria-hidden="true">Emma's notifications</p>
      <div class="nts" aria-hidden="true">` +
  ntf("#3a3390", P.play, true, "Video reply", "2h", "Finlay reviewed your squat", "Hips rise first. Brace before you drop.", "Watch reply", true) +
  ntf("#1d3466", P.chat, false, "Message", "5h", "Great week. Same again Thursday?", "", "Reply", true) +
  ntf("#2f6fd6", P.list, false, "To focus on", "Yesterday", "Set what to focus on", `Film your top set of squats ${bar} 8,000 steps every day ${bar} Protein at every meal`, "See it", false) +
  ntf("#3a3390", P.dumbbell, false, "Training", "Mon", "Finlay left a note on Upper strength", "Three weeks of building. Keep the last rep honest.", "See training", false) + `
      </div>
      <p class="faces-cap" aria-hidden="true">Every line written by her coach.</p>`);

writeFileSync(file, s);
console.log("queued edits applied");
