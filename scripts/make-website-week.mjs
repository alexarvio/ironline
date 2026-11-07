// The "Why it happens" picture (7 Nov, Alex): four real-looking places a coach's week gets lost in, and the same four
// as the app's Feed shows them under Needs you (NeedGroups.tsx, feed.css: grouped by category, rust card, round buttons).
import { readFileSync, writeFileSync } from "node:fs";
const file = process.argv[2];

const I = {
  chat: `<svg viewBox="0 0 18 18"><path fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" d="M2.5 4.8a1.3 1.3 0 0 1 1.3-1.3h10.4a1.3 1.3 0 0 1 1.3 1.3v6.3a1.3 1.3 0 0 1-1.3 1.3H7.3L4 15.2v-2.8H3.8a1.3 1.3 0 0 1-1.3-1.3V4.8z"/></svg>`,
  dumb: `<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/></svg>`,
  video: `<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M4 7h11v10H4zM15 10l5-3v10l-5-3"/></svg>`,
  reply: `<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M10 8L5 12l5 4M5 12h9a5 5 0 0 1 5 5"/></svg>`,
  play: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>`,
  eye: `<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
  cal: `<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/></svg>`,
  check: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M8.5 12.2l2.4 2.4 4.6-4.8"/></svg>`,
};
const face = (n) => `<span class="nf" style="background-image:url(img/avatars/${n}.svg)"></span>`;

// The left: as the places themselves look.
const scraps = `
      <div class="scraps" aria-hidden="true">
        <div class="scrap gs">
          <div class="gs-bar"><span class="gs-doc"></span><b>Tom | Training log</b></div>
          <div class="gs-grid">
            <span class="c h"></span><span class="c h">A</span><span class="c h">B</span><span class="c h">C</span><span class="c h">D</span>
            <span class="c n">39</span><span class="c">Wk 6</span><span class="c">Back squat</span><span class="c r">80 × 8</span><span class="c"></span>
            <span class="c n">40</span><span class="c"></span><span class="c">Bench press</span><span class="c r">60 × 8</span><span class="c"></span>
            <span class="c n on">41</span><span class="c"></span><span class="c">Incline DB</span><span class="c r">24 × 10</span><span class="c sel">left shoulder felt tight</span>
            <span class="c n">42</span><span class="c"></span><span class="c">Cable fly</span><span class="c r">15 × 12</span><span class="c"></span>
          </div>
        </div>
        <div class="scrap wa">
          <div class="wa-bar">${face("sara")}<b>Sara</b><span>online</span></div>
          <div class="wa-body">
            <span class="wa-unread">31 unread messages</span>
            <p class="wa-in">knee hurt again on the lunges<small>21:14</small></p>
            <p class="wa-in">should I skip them tomorrow?<small>21:15</small></p>
          </div>
        </div>
        <div class="scrap ig">
          <div class="ig-bar">${face("james")}<b>james.moore</b></div>
          <div class="ig-body">
            <span class="ig-day">Tue 18:42</span>
            <div class="ig-vid"><span>${I.play}</span><em>0:24</em></div>
            <p class="ig-in">deadlift, form ok?</p>
          </div>
        </div>
        <div class="scrap em">
          <div class="em-bar"><b>Inbox</b><span>48</span></div>
          <div class="em-row"><i></i><b>Stripe</b><span>Your payout is on its way</span></div>
          <div class="em-row unread"><i></i><b>Emma Clarke</b><span>Call this week? Could we do a quick one…</span></div>
          <div class="em-row"><i></i><b>Instagram</b><span>You have 6 new followers</span></div>
        </div>
      </div>`;

// The right: the Feed's Needs you, as the app draws it.
const row = (n, name, what, words, wait, late, icon, label) => `
            <div class="nr">${face(n)}<b class="nm">${name}</b><span class="th"><span class="wh">${what}</span>${words ? `<q>${words}</q>` : ""}</span><span class="wt${late ? " late" : ""}">${wait}</span><span class="na" title="${label}">${icon}</span></div>`;
const group = (cls, icon, label, count, rows) => `
          <div class="ng-head ${cls}">${icon}${label}<small>${count}</small></div>
          <div class="ng-card">${rows}
          </div>`;
const board = `
      <div class="board" aria-hidden="true">
        <div class="desk-title">Needs you <span class="ncount">4</span></div>
        <div class="ng">${group("msg", I.chat, "Messages", 1, row("sara", "Sara Novak", "Message", "knee hurt again on the lunges", "2 days", true, I.reply, "Reply"))}${group("trn", I.dumb, "Training", 2, row("james", "James Moore", "Video of Deadlift", "", "1 day", false, I.play, "Review") + row("tom", "Tom Baker", "Note on Upper A", "left shoulder felt tight", "today", false, I.eye, "Read"))}${group("mtg", I.video, "Meetings", 1, row("emma", "Emma Clarke", "Asked for a call", "this week if you can", "today", false, I.cal, "Book"))}
        </div>
      </div>`;

const html = `<div class="week" role="img" aria-label="One ordinary week: Tom's note in row 41 of his sheet, Sara's sore knee under 31 unread WhatsApp messages, James's deadlift video in Instagram, Emma asking for a call by email. In NorCoach the four are one list, Needs you, each with its reason and the button that answers it.">${scraps}

      <svg class="arrow" viewBox="0 0 60 24" aria-hidden="true"><use href="#i-arrow"/></svg>
${board}
    </div>

    `;

let s = readFileSync(file, "utf8");
const a = s.indexOf(`<div class="week" role="img"`);
const b = s.indexOf(`<p class="reason">`, a);
if (a < 0 || b < 0) throw new Error("week not found");
s = s.slice(0, a) + html + s.slice(b);
writeFileSync(file, s);
console.log("week replaced");
