"use client";

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { PlayIcon, PlusIcon } from "../../../components/icons";
import Pager from "../Pager";
import { SepJoin } from "../Sep";
import { dayMonth, logDate, logDateWidth } from "../../../lib/dayMonth";
// Types only: businessBoard.ts re-exports the server's reader, which must never reach the browser.
import type { BillingRow, BusinessBoard, MoneyMonth, OwedRow, RosterMonth, SeriesEvery } from "../../../lib/businessBoard";

// The coach's Business (21 Oct, Alex: built from the Business mockup, root "rd trn rls rh rbz"): the business in numbers,
// nothing about the clients' bodies. Training's header, Home's Since line, then
// - three figures in one hairline card: Clients (scrolls to Clients by month), A month (opens the series), Owed (scrolls to Owed);
// - Money by month beside Clients by month, inline SVG, a month a column that opens what is in it;
// - Owed and Not billed automatically as logs, each with its way to act (no Plans ending: 23 Oct, Alex).
// Facts, not explanations; dates d/m (dayMonth), a log's rows by logDate; ink, never navy; weights 500 and 600.

const HOME = (id: number) => `/admin/redesign/home?client=${id}`;
const INVOICES = (id: number) => `/admin/redesign/invoices?client=${id}`;
/** An invoice as it prints (the Invoices tab's own link). */
const SHEET = (id: number) => `/admin/redesign/invoices/${id}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MINUS = "−";
const EVERY: Record<SeriesEvery, string> = { week: "Weekly", "2weeks": "Every 2 weeks", month: "Monthly" };
const PAGE = 20;

// ---- Money in words: sums and averages whole (€1,040), an invoice as it is (€340, €116.67).
const FMT = new Map<string, Intl.NumberFormat>();
function nf(currency: string, kind: "whole" | "cents" | "compact") {
  const key = `${currency}:${kind}`;
  let f = FMT.get(key);
  if (!f) {
    const opts: Intl.NumberFormatOptions =
      kind === "compact"
        ? { style: "currency", currency, notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1 }
        : { style: "currency", currency, minimumFractionDigits: kind === "cents" ? 2 : 0, maximumFractionDigits: kind === "cents" ? 2 : 0 };
    try {
      f = new Intl.NumberFormat("en-GB", opts);
    } catch {
      f = new Intl.NumberFormat("en-GB", { ...opts, currency: "EUR" });
    }
    FMT.set(key, f);
  }
  return f;
}
type Money = { whole: (n: number) => string; exact: (n: number) => string; axis: (n: number) => string };
const moneyIn = (currency: string): Money => ({
  whole: (n) => nf(currency, "whole").format(Math.round(n || 0)),
  exact: (n) => {
    const c = Math.round((n || 0) * 100) / 100;
    return nf(currency, Number.isInteger(c) ? "whole" : "cents").format(c);
  },
  axis: (n) => nf(currency, "compact").format(n),
});

/** "2 sessions", "1 check-in"; nothing for none, so the part drops out. */
const count = (n: number, one: string, many: string) => (n > 0 ? `${n} ${n === 1 ? one : many}` : null);
const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
const dayNum = (d: string) => Math.round(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86400000);
const months1 = (d: number) => Math.round((d / 30.44) * 10) / 10;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** Scrolled to, gently unless motion is turned down. */
function goTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
}

/** A page of a log at a time (the pager comes in past 20 rows). */
function usePaged<T>(rows: T[]) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const at = Math.min(page, pages);
  const from = (at - 1) * PAGE;
  return { at, pages, from, shown: rows.slice(from, from + PAGE), setPage };
}

/** The width a chart has, in pixels, so its marks stay crisp at any size (0 until measured). */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export default function BusinessDraft({ board }: { board: BusinessBoard }) {
  const money = useMemo(() => moneyIn(board.currency), [board.currency]);
  const thisMonth = MONTHS[Number(board.today.slice(5, 7)) - 1];
  const { clients, monthly, owed } = board;

  return (
    <div className="rd trn rls rh rbz">
      {/* ---- Header: Training's, bare (no fact line, so no room kept for one). */}
      <header className="trn-head bare">
        <div className="trn-head-main">
          <div className="trn-name-row">
            <h1 className="trn-name">Business</h1>
          </div>
        </div>
      </header>

      <SinceLine since={board.since} money={money} />

      {/* ---- The three figures, in one hairline card; each a way in. */}
      <section className="rls-card rls-figs" aria-label="At a glance">
        <button type="button" className="rls-fig rbz-fig" onClick={() => goTo("rbz-clients")}>
          <span className="rls-fig-label">Clients</span>
          <b>{clients.count}</b>
          {(clients.joinedThisMonth > 0 || clients.leftThisMonth > 0) && (
            <small>
              <SepJoin
                parts={[
                  clients.joinedThisMonth > 0 && (
                    <span key="j" className="up">
                      +{clients.joinedThisMonth}
                    </span>
                  ),
                  clients.leftThisMonth > 0 && (
                    <span key="l" className="down">
                      {MINUS}
                      {clients.leftThisMonth}
                    </span>
                  ),
                ]}
              />{" "}
              in {thisMonth}
            </small>
          )}
        </button>
        <SeriesFigure monthly={monthly} clients={clients.count} money={money} />
        <button type="button" className="rls-fig rbz-fig" onClick={() => goTo("rbz-owed")}>
          <span className="rls-fig-label">Owed</span>
          <b className={owed.total > 0 ? "warn" : ""}>{money.whole(owed.total)}</b>
          {owed.invoices > 0 && (
            <small>
              <SepJoin parts={[count(owed.invoices, "invoice", "invoices"), owed.overdue > 0 && `${owed.overdue} overdue`]} />
            </small>
          )}
        </button>
      </section>

      {/* ---- Money by month beside Clients by month; one under the other on a narrow page. */}
      <div className="rbz-duo">
        <MoneyCard months={board.money} money={money} />
        <RosterCard roster={board.roster} />
      </div>

      <OwedLog owed={owed} today={board.today} money={money} />
      <BillingLog rows={board.billing} money={money} />
    </div>
  );
}

// ---- Since the coach last looked: one quiet line, the date in ink, each fact only when there is one.
function SinceLine({ since, money }: { since: BusinessBoard["since"]; money: Money }) {
  if (!since) return null;
  const facts = [since.paid > 0 ? `${money.whole(since.paid)} paid` : null, since.sent > 0 ? `${since.sent} sent` : null, count(since.newClients, "new client", "new clients")];
  if (facts.every((f) => f == null)) return null;
  return (
    <p className="rh-sinceline">
      <SepJoin
        parts={[
          <span key="from">
            Since <b>{dayMonth(since.from)}</b>
          </span>,
          ...facts,
        ]}
      />
    </p>
  );
}

// ---- A month: what the active series bring in a month; it opens the series, paused ones faint at the foot, a row their Invoices tab.
function SeriesFigure({ monthly, clients, money }: { monthly: BusinessBoard["monthly"]; clients: number; money: Money }) {
  const grid = { gridTemplateColumns: "minmax(0, 1fr) auto 52px 80px", columnGap: 12 } as const;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="rls-fig rbz-fig">
          <span className="rls-fig-label">A month</span>
          <b>{money.whole(monthly.total)}</b>
          {monthly.onSeries > 0 && (
            <small>
              <SepJoin parts={[`${monthly.onSeries} of ${clients} on a series`, monthly.perClient != null && `${money.whole(monthly.perClient)} a client`]} />
            </small>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="rbz-pop rbz-pop-series">
        {monthly.series.length === 0 ? (
          <p className="rbz-pop-none">None yet</p>
        ) : (
          <div className="rbz-pop-list">
            {monthly.series.map((s) => (
              <Link key={s.seriesId} href={INVOICES(s.clientId)} className={`rbz-pop-row${s.paused ? " off" : ""}`} style={grid}>
                <span className="rbz-pop-name">{s.client}</span>
                <span className="rbz-pop-grey">{EVERY[s.every]}</span>
                <span className="rbz-pop-grey">{s.paused ? "Paused" : dayMonth(s.next)}</span>
                <span className="rbz-pop-amt">{money.whole(s.perMonth)}/mo</span>
              </Link>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---- The charts' shared geometry: the same height on both cards, so they line up side by side. The month's labels
// sit in its column (a button that opens the month) under the drawing.
const AXIS = 156;
const SVG_H = 168;
const LABEL_H = 22;
const BAR = 24;
/** Clean ticks: a top a little over the most, at 1, 2, 2.5 or 5 × a power of ten (whole steps for counts). */
function niceScale(max: number, whole: boolean) {
  if (!(max > 0)) return { top: 0, step: 0 };
  const raw = max / 3;
  const p = 10 ** Math.floor(Math.log10(raw));
  const factors = whole && p < 10 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  const step = Math.max(whole ? 1 : 0, factors.map((f) => f * p).find((s) => s >= raw) ?? 10 * p);
  return { top: step * Math.ceil(max / step), step };
}
/** A column's short name under the axis ("Oct"); every other one dropped when the columns are too narrow, the newest always kept. */
const short = (label: string) => label.slice(0, 3);
const showLabel = (i: number, n: number, slot: number) => slot >= 28 || i % 2 === (n - 1) % 2;

/** The gridlines and their figures on the left, the baseline under the columns. */
function Grid({ left, right, top, step, plotTop, fmt }: { left: number; right: number; top: number; step: number; plotTop: number; fmt: (v: number) => string }) {
  const lines: ReactNode[] = [];
  if (top > 0)
    for (let v = step; v <= top + 1e-9; v += step) {
      const y = Math.round(AXIS - (v / top) * (AXIS - plotTop)) + 0.5;
      lines.push(
        <g key={v}>
          <line x1={left} x2={right} y1={y} y2={y} stroke="#eef0f3" strokeWidth={1} />
          <text className="rbz-ytick" x={left - 8} y={y + 4} textAnchor="end">
            {fmt(v)}
          </text>
        </g>
      );
    }
  return (
    <>
      {lines}
      <line x1={left} x2={right} y1={AXIS + 0.5} y2={AXIS + 0.5} stroke="#e1e5eb" strokeWidth={1} />
    </>
  );
}

// ---- Money by month: a column a month, paid (a soft green fill, its edge full green), open on top (billed, not paid:
// a rust outline), to come on top of that (the active series; this month's rest and the next two: dashed grey). The
// head: the average month as the columns stand, and the newer half of the window on the older. 6 or 12 months back.
type Span = 6 | 12;
const PAID = "#2f7a3f";
const OPEN = "#b8471f";
const COME = "#98a2b3";
function MoneyCard({ months: all, money }: { months: MoneyMonth[]; money: Money }) {
  const [span, setSpan] = useState<Span>(6);
  const past = all.filter((m) => !m.future).slice(-span);
  const months = [...past, ...all.filter((m) => m.future)];
  const bar = (m: MoneyMonth) => m.paid + m.open + m.toCome;
  const total = sum(past.map(bar));
  const avg = past.length ? total / past.length : 0;
  const half = Math.floor(past.length / 2);
  const older = past.slice(0, half);
  const before = sum(older.map(bar));
  const after = sum(past.slice(half).map(bar));
  const change = before > 0 ? Math.round(((after - before) / before) * 100) : null;
  const olderSpan = older.length ? (older.length === 1 ? older[0].label : `${older[0].label}–${older[older.length - 1].label}`) : "";

  return (
    <section className="rls-card rh-panel rbz-chartcard" aria-label="Money by month">
      <div className="rh-panel-head tall">
        <div className="rbz-titles">
          <h2 className="rh-panel-title">Money by month</h2>
          <span className="rbz-under">
            {total > 0 ? (
              <SepJoin
                parts={[
                  <span key="avg">
                    <span className="rbz-avg">Avg</span> <b>{money.whole(avg)}</b>
                  </span>,
                  change != null && (
                    <span key="ch">
                      <b className={change > 0 ? "up" : change < 0 ? "down" : ""}>{change > 0 ? `+${change}%` : change < 0 ? `${MINUS}${Math.abs(change)}%` : "0%"}</b> on {olderSpan}
                    </span>
                  ),
                ]}
              />
            ) : (
              <span aria-hidden="true">&nbsp;</span>
            )}
          </span>
        </div>
        <div className="rd-btn-group" role="group" aria-label="Months shown">
          {([6, 12] as const).map((n) => (
            <button key={n} type="button" className={span === n ? "on" : ""} aria-pressed={span === n} onClick={() => setSpan(n)}>
              {n} months
            </button>
          ))}
        </div>
      </div>
      <MoneyChart months={months} money={money} />
      <div className="rh-key">
        <span>
          <i className="rbz-sw paid" aria-hidden="true" />
          Paid
        </span>
        <span>
          <i className="rbz-sw open" aria-hidden="true" />
          Open
        </span>
        <span>
          <i className="rbz-sw come" aria-hidden="true" />
          To come
        </span>
      </div>
    </section>
  );
}

/** A month's money in words: "€400 paid | €120 open | €200 to come", nothing as "Nothing". */
const moneyFacts = (m: MoneyMonth, money: Money) => {
  const parts = [m.paid > 0 && `${money.whole(m.paid)} paid`, m.open > 0 && `${money.whole(m.open)} open`, m.toCome > 0 && `${money.whole(m.toCome)} to come`].filter(Boolean) as string[];
  return parts.length ? parts : ["Nothing"];
};

function MoneyChart({ months, money }: { months: MoneyMonth[]; money: Money }) {
  const [ref, w] = useWidth();
  const n = months.length;
  const { top, step } = niceScale(Math.max(0, ...months.map((m) => m.paid + m.open + m.toCome)), false);
  const left = 44;
  const right = Math.max(left + 1, w - 2);
  const slot = n ? (right - left) / n : 0;
  const bw = Math.min(BAR, Math.max(6, slot * 0.6));
  const plotTop = 8;
  const said = `Money by month. ${months.map((m) => `${m.label}: ${moneyFacts(m, money).join(", ")}`).join(". ")}.`;

  return (
    <div ref={ref} className="rbz-chart" style={{ height: SVG_H + LABEL_H }}>
      {w > 0 && (
        <>
          {/* A column a month: hover shades it, a click opens its invoices. Under the drawing, so the bars stay crisp on top. */}
          {months.map((m, i) => {
            const style: CSSProperties = { left: left + i * slot, width: slot };
            const label = showLabel(i, n, slot) ? short(m.label) : "";
            const title = `${m.label}: ${moneyFacts(m, money).join(" · ")}`;
            // A month ahead opens too once it holds an invoice (one dated ahead); else it is only what is to come.
            if (m.future && m.invoices.length === 0)
              return (
                <span key={m.month} className="rbz-col ahead" style={style} title={title}>
                  <span>{label}</span>
                </span>
              );
            return <MoneyMonthPop key={m.month} month={m} money={money} style={style} label={label} title={title} />;
          })}
          <svg width={w} height={SVG_H} role="img" aria-label={said}>
            <Grid left={left} right={right} top={top} step={step} plotTop={plotTop} fmt={money.axis} />
            {top > 0 &&
              months.map((m, i) => {
                const x = left + i * slot + (slot - bw) / 2;
                let y = AXIS;
                const segs: ReactNode[] = [];
                for (const [k, v] of [
                  ["paid", m.paid],
                  ["open", m.open],
                  ["come", m.toCome],
                ] as const) {
                  if (!(v > 0)) continue;
                  const h = Math.max(3, (v / top) * (AXIS - plotTop));
                  const y0 = y - h;
                  segs.push(
                    <rect
                      key={k}
                      x={x + 0.75}
                      y={y0 + 0.75}
                      width={bw - 1.5}
                      height={Math.max(0.5, h - 1.5)}
                      rx={3}
                      fill={k === "paid" ? "rgba(47, 122, 63, 0.18)" : k === "open" ? "#fff" : "none"}
                      stroke={k === "paid" ? PAID : k === "open" ? OPEN : COME}
                      strokeWidth={1.5}
                      strokeDasharray={k === "come" ? "3 2.5" : undefined}
                    />
                  );
                  // A 2px gap of the card's white between one part and the next.
                  y = y0 - 2;
                }
                return <g key={m.month}>{segs}</g>;
              })}
          </svg>
        </>
      )}
    </div>
  );
}

/** A month's column and what opens from it: its invoices, the newest first; a row opens the invoice as it prints. */
function MoneyMonthPop({ month: m, money, style, label, title }: { month: MoneyMonth; money: Money; style: CSSProperties; label: string; title: string }) {
  const rows = [...m.invoices].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const grid = { gridTemplateColumns: `${logDateWidth(rows.map((r) => r.date))}px minmax(0, 1fr) auto 64px`, columnGap: 12 } as const;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={`rbz-col${m.current ? " now" : ""}`} style={style} title={title} aria-label={`${m.label}: ${moneyFacts(m, money).join(", ")}`}>
          <span>{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="rbz-pop rbz-pop-money">
        <div className="rbz-pop-head">
          <b>{m.label}</b>
          <span>
            <SepJoin parts={moneyFacts(m, money)} />
          </span>
        </div>
        {rows.length === 0 ? (
          <p className="rbz-pop-none">None</p>
        ) : (
          <div className="rbz-pop-list">
            {rows.map((r) => (
              <a key={r.invoiceId} href={SHEET(r.invoiceId)} target="_blank" rel="noopener noreferrer" className="rbz-pop-row" style={grid}>
                <span className="rd-logdate">{logDate(r.date)}</span>
                <span className="rbz-pop-name">
                  {r.client}
                  {r.number && <small>{r.number}</small>}
                </span>
                <span className="rbz-pop-amt">{money.exact(r.amount)}</span>
                <span className={`trn-state rbz-state ${r.state === "paid" ? "good" : "warn"}`}>{r.state === "paid" ? "Paid" : "Open"}</span>
              </a>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---- Clients by month: the roster at each month's end (today for this one) as an ink step line, the latest a dot
// with its figure; a green tick above the axis a client who joined, a rust one under it a client who left. How long
// clients stay under the title. A month opens who joined and who left; a name opens their Home.
const JOIN = "#2f7a3f";
const LEAVE = "#b8471f";
function RosterCard({ roster }: { roster: BusinessBoard["roster"] }) {
  // Both rest on the same clients: none, neither.
  const stay = roster.avgStayDays != null ? `Stay ${months1(roster.avgStayDays)} months` : null;
  const longest = stay && roster.longestDays != null ? `longest ${months1(roster.longestDays)}` : null;
  return (
    <section id="rbz-clients" className="rls-card rh-panel rbz-chartcard" aria-label="Clients by month">
      <div className="rh-panel-head tall">
        <div className="rbz-titles">
          <h2 className="rh-panel-title">Clients by month</h2>
          <span className="rbz-under">{stay ? <SepJoin parts={[stay, longest]} /> : <span aria-hidden="true">&nbsp;</span>}</span>
        </div>
      </div>
      <RosterChart months={roster.months} />
      <div className="rh-key">
        <span>
          <i className="line" aria-hidden="true" />
          Clients
        </span>
        <span>
          <i className="rbz-sw tick join" aria-hidden="true" />
          Joined
        </span>
        <span>
          <i className="rbz-sw tick leave" aria-hidden="true" />
          Left
        </span>
      </div>
    </section>
  );
}

const rosterFacts = (m: RosterMonth) => [count(m.count, "client", "clients") ?? "No clients", m.joined.length > 0 && `${m.joined.length} joined`, m.left.length > 0 && `${m.left.length} left`].filter(Boolean) as string[];

function RosterChart({ months }: { months: RosterMonth[] }) {
  const [ref, w] = useWidth();
  const n = months.length;
  const { top, step } = niceScale(Math.max(0, ...months.map((m) => m.count)), true);
  const left = 28;
  const right = Math.max(left + 1, w - 2);
  const slot = n ? (right - left) / n : 0;
  const plotTop = 18;
  const Y = (v: number) => (top > 0 ? AXIS - (v / top) * (AXIS - plotTop) : AXIS);
  const xOf = (i: number) => left + i * slot;
  // Each month's level across its column, the step at the month's edge; it ends at this month's middle, on the dot.
  let d = "";
  months.forEach((m, i) => {
    const y = Y(m.count).toFixed(1);
    const end = (i === n - 1 ? xOf(i) + slot / 2 : xOf(i + 1)).toFixed(1);
    d += i === 0 ? `M${xOf(0).toFixed(1)} ${y}H${end}` : `V${y}H${end}`;
  });
  const last = months[n - 1];
  /** A tick a person, side by side in the middle of the column, as many as fit. */
  const ticks = (k: number, i: number, y1: number, y2: number, color: string, key: string) => {
    const shown = Math.max(1, Math.min(k, Math.floor((slot * 0.8) / 2.5)));
    const gap = Math.min(4, Math.max(2.5, (slot * 0.7) / shown));
    const from = xOf(i) + slot / 2 - ((shown - 1) * gap) / 2;
    return Array.from({ length: shown }, (_, j) => <line key={`${key}${j}`} x1={from + j * gap} x2={from + j * gap} y1={y1} y2={y2} stroke={color} strokeWidth={2} strokeLinecap="round" />);
  };
  const said = `Clients by month. ${months.map((m) => `${m.label}: ${rosterFacts(m).join(", ")}`).join(". ")}.`;

  return (
    <div ref={ref} className="rbz-chart" style={{ height: SVG_H + LABEL_H }}>
      {w > 0 && n > 0 && (
        <>
          {months.map((m, i) => (
            <RosterMonthPop key={m.month} month={m} style={{ left: xOf(i), width: slot }} label={showLabel(i, n, slot) ? short(m.label) : ""} />
          ))}
          <svg width={w} height={SVG_H} role="img" aria-label={said}>
            <Grid left={left} right={right} top={top} step={step} plotTop={plotTop} fmt={(v) => String(v)} />
            {months.map((m, i) => (
              <g key={m.month}>
                {m.joined.length > 0 && ticks(m.joined.length, i, AXIS - 3, AXIS - 9, JOIN, "j")}
                {m.left.length > 0 && ticks(m.left.length, i, AXIS + 4, AXIS + 10, LEAVE, "l")}
              </g>
            ))}
            <path d={d} fill="none" stroke="#141a24" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {last && (
              <>
                <circle cx={xOf(n - 1) + slot / 2} cy={Y(last.count)} r={4} fill="#141a24" stroke="#fff" strokeWidth={2} />
                <text className="rbz-dotval" x={xOf(n - 1) + slot / 2} y={Y(last.count) - 10} textAnchor="middle">
                  {last.count}
                </text>
              </>
            )}
          </svg>
        </>
      )}
    </div>
  );
}

/** A month's column and who joined and left in it; a name opens their Home. */
function RosterMonthPop({ month: m, style, label }: { month: RosterMonth; style: CSSProperties; label: string }) {
  const facts = rosterFacts(m);
  const people = (list: RosterMonth["joined"]) =>
    list.map((p, i) => {
      const inner = (
        <>
          <span className="rbz-pop-name">{p.name}</span>
          <span className="rbz-pop-grey">{dayMonth(p.date)}</span>
        </>
      );
      return p.clientId != null ? (
        <Link key={`${p.clientId}-${i}`} href={HOME(p.clientId)} className="rbz-pop-row rbz-pop-person">
          {inner}
        </Link>
      ) : (
        <span key={`${p.name}-${i}`} className="rbz-pop-row rbz-pop-person still">
          {inner}
        </span>
      );
    });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={`rbz-col${m.current ? " now" : ""}`} style={style} title={`${m.label}: ${facts.join(" · ")}`} aria-label={`${m.label}: ${facts.join(", ")}`}>
          <span>{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="rbz-pop rbz-pop-roster">
        <div className="rbz-pop-head">
          <b>{m.label}</b>
          <span>{facts[0]}</span>
        </div>
        {m.joined.length === 0 && m.left.length === 0 ? (
          <p className="rbz-pop-none">None</p>
        ) : (
          <div className="rbz-pop-list">
            {m.joined.length > 0 && (
              <>
                <span className="rbz-pop-label">
                  <i className="rbz-sw tick join" aria-hidden="true" />
                  Joined
                </span>
                {people(m.joined)}
              </>
            )}
            {m.left.length > 0 && (
              <>
                <span className="rbz-pop-label">
                  <i className="rbz-sw tick leave" aria-hidden="true" />
                  Left
                </span>
                {people(m.left)}
              </>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---- The logs: a section title and its status on the page, the rows in one hairline card (no line above the first),
// a page of 20 at a time with the pager under the card; a list with nothing in it keeps its title and says so.
function Log<T>({ id, title, sub, empty, rows, label, row }: { id?: string; title: string; sub?: ReactNode; empty: string; rows: T[]; label: string; row: (r: T) => ReactNode }) {
  const p = usePaged(rows);
  const paged = rows.length > PAGE;
  return (
    <section id={id} className="rls-section rbz-log" aria-label={title}>
      <div className="trn-weekhead">
        <div>
          <h2>{title}</h2>
          {sub ? <span>{sub}</span> : null}
        </div>
      </div>
      {/* Paged, always a full page tall, so the pager never moves (design rules 8): 53px a row with its hairline. */}
      <div className={`rls-card rbz-card${paged ? " rd-steady" : ""}`} style={paged ? ({ "--log-rows": PAGE, "--log-row": "53px", "--log-head": "1px" } as CSSProperties) : undefined}>
        {rows.length === 0 ? <p className="rls-none">{empty}</p> : <div className="rbz-rows">{p.shown.map(row)}</div>}
      </div>
      <Pager page={p.at} pages={p.pages} from={p.from} shown={p.shown.length} total={rows.length} label={label} onPage={p.setPage} />
    </section>
  );
}

// ---- Owed: overdue first (most days late), then sent (soonest due), then drafts (faded, not counted). The due day
// leads, then the client and the number, how late or how soon, the amount and the state. The row opens the invoice as
// it prints (a new tab); the name opens their Invoices tab.
function OwedLog({ owed, today, money }: { owed: BusinessBoard["owed"]; today: string; money: Money }) {
  const dateW = logDateWidth(owed.rows.map((r) => r.due ?? r.issued).filter((d): d is string => !!d));
  const grid = { gridTemplateColumns: `${dateW}px minmax(0, 1fr) 112px 96px 84px` } as const;
  const open = (e: MouseEvent, id: number) => {
    if (!(e.currentTarget as Element).contains(e.target as Node)) return;
    if ((e.target as HTMLElement).closest("a, button")) return;
    window.open(SHEET(id), "_blank", "noopener");
  };
  const when = (r: OwedRow): { text: string; late: boolean } => {
    if (r.state === "draft" || !r.due) return { text: "", late: false };
    const ahead = dayNum(r.due) - dayNum(today);
    // Marked Overdue on or before its due day: due today, not "0 days late".
    if ((r.state === "overdue" && (r.daysLate ?? 0) > 0) || ahead < 0) return { text: `${days(r.daysLate || Math.max(1, -ahead))} late`, late: true };
    return { text: ahead === 0 ? "due today" : ahead === 1 ? "tomorrow" : `in ${days(ahead)}`, late: false };
  };
  return (
    <Log
      id="rbz-owed"
      title="Owed"
      sub={owed.total > 0 ? <SepJoin parts={[money.whole(owed.total), owed.overdue > 0 && `${owed.overdue} overdue`]} /> : null}
      empty="Nothing outstanding"
      rows={owed.rows}
      label="Owed pages"
      row={(r) => {
        const day = r.due ?? r.issued;
        const w = when(r);
        const pill = r.state === "overdue" ? { cls: "warn", word: "Overdue" } : r.state === "sent" ? { cls: "live", word: "Sent" } : { cls: "", word: "Not sent" };
        return (
          <div key={r.invoiceId} className={`rls-row rbz-row opens${r.state === "draft" ? " draft" : ""}`}>
            <div className="rls-row-main" style={grid} onClick={(e) => open(e, r.invoiceId)}>
              <a className="rd-row-hit" href={SHEET(r.invoiceId)} target="_blank" rel="noopener noreferrer" title={r.number ? `Open ${r.number}` : "Open the invoice"}>
                <span className="rd-logdate">{day ? logDate(day) : "–"}</span>
              </a>
              <span className="rbz-who">
                {r.clientId != null ? (
                  <Link href={INVOICES(r.clientId)} className="rbz-name">
                    {r.client}
                  </Link>
                ) : (
                  <span className="rbz-name">{r.client}</span>
                )}
                {r.number && <span className="rbz-num">{r.number}</span>}
              </span>
              <span className={`rbz-when${w.late ? " late" : ""}`}>{w.text}</span>
              <span className="rbz-amt">{money.exact(r.amount)}</span>
              <span className={`trn-state rbz-state ${pill.cls}`}>{pill.word}</span>
            </div>
          </div>
        );
      }}
    />
  );
}

/** €/mo, or a faint dash when none. */
const PerMonth = ({ n, money }: { n: number | null; money: Money }) => (n != null && n > 0 ? <span className="rbz-amt">{money.whole(n)}/mo</span> : <span className="rbz-amt none">–</span>);
/** The client's name, semi-bold; it opens their Home. */
const Who = ({ id, name }: { id: number; name: string }) => (
  <span className="rbz-who">
    <Link href={HOME(id)} className="rbz-name">
      {name}
    </Link>
  </span>
);

// ---- Not billed automatically: a paused repeat (Resume) or none at all (Set up); both open their Invoices tab.
function BillingLog({ rows, money }: { rows: BillingRow[]; money: Money }) {
  const grid = { gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr) 88px 116px" } as const;
  return (
    <Log
      title="Not billed automatically"
      empty="None"
      rows={rows}
      label="Not billed automatically pages"
      row={(r) => (
        <div key={r.clientId} className="rls-row rbz-row">
          <div className="rls-row-main" style={grid}>
            <Who id={r.clientId} name={r.client} />
            <span className="rbz-facts">
              <SepJoin parts={[r.reason === "paused" ? "Repeat paused" : "No repeat invoice", r.lastInvoice && `last invoice ${dayMonth(r.lastInvoice)}`]} />
            </span>
            <PerMonth n={r.perMonth} money={money} />
            <span className="rbz-act">
              <Link href={INVOICES(r.clientId)} className="trn-pill">
                {r.reason === "paused" ? (
                  <>
                    <PlayIcon /> Resume
                  </>
                ) : (
                  <>
                    <PlusIcon /> Set up
                  </>
                )}
              </Link>
            </span>
          </div>
        </div>
      )}
    />
  );
}
