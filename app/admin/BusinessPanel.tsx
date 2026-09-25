import { getClientProfile, getLatestWeight, listClients, listInvoices, localDateStr } from "../lib/queries";

// The coach's business at a glance: who their clients are (age, gender,
// height, weight), how long they stay, and what they pay. Every figure is
// worked out from what is already on the clients' cards, and says how many
// clients it is based on, since a card left blank is left out rather than
// counted as zero.

const DAY = 86400000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (list: number[]) => (list.length ? list.reduce((s, n) => s + n, 0) / list.length : null);
const daysSince = (iso: string, today: string) => Math.floor((new Date(`${today}T00:00:00`).getTime() - new Date(`${iso}T00:00:00`).getTime()) / DAY);
const money = (n: number) => `€${Math.round(n).toLocaleString("en-US")}`;
function span(days: number): string {
  const months = days / 30.44;
  if (months < 1) {
    const w = Math.max(0, Math.round(days / 7));
    return `${w} ${w === 1 ? "week" : "weeks"}`;
  }
  if (months < 12) return `${round1(months)} mo`;
  return `${round1(months / 12)} yr`;
}

const AGE_BANDS: { label: string; min: number; max: number }[] = [
  { label: "Under 25", min: 0, max: 24 },
  { label: "25–34", min: 25, max: 34 },
  { label: "35–44", min: 35, max: 44 },
  { label: "45–54", min: 45, max: 54 },
  { label: "55+", min: 55, max: 200 },
];

export default function BusinessPanel({ coachId }: { coachId: number }) {
  const today = localDateStr();
  const clients = listClients(coachId).map((c) => {
    const p = getClientProfile(c.id);
    const age = p.birthdate ? Math.floor(daysSince(p.birthdate, today) / 365.25) : null;
    const gender = (p.gender ?? "").trim().toLowerCase();
    const invoices = listInvoices(c.id);
    return {
      id: c.id,
      age: age != null && age > 0 && age < 120 ? age : null,
      gender: gender.startsWith("m") ? "Male" : gender.startsWith("f") || gender.startsWith("w") ? "Female" : gender ? "Other" : null,
      height: p.height_cm ?? null,
      weight: getLatestWeight(c.id) ?? p.starting_weight_kg ?? null,
      tenureDays: p.coaching_start_date ? Math.max(0, daysSince(p.coaching_start_date, today)) : null,
      paid: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + (i.amount || 0), 0),
      open: invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + (i.amount || 0), 0),
    };
  });
  const n = clients.length;
  const have = <K extends "age" | "height" | "weight" | "tenureDays">(k: K) => clients.map((c) => c[k]).filter((v): v is number => v != null);

  const ages = have("age");
  const heights = have("height");
  const weights = have("weight");
  const tenures = have("tenureDays");
  const genders = clients.map((c) => c.gender).filter((g): g is "Male" | "Female" | "Other" => g != null);
  const genderSplit = (["Male", "Female", "Other"] as const)
    .map((g) => ({ label: g, count: genders.filter((x) => x === g).length }))
    .filter((g) => g.count > 0);
  const bands = AGE_BANDS.map((b) => ({ ...b, count: ages.filter((a) => a >= b.min && a <= b.max).length }));
  const bandMax = Math.max(1, ...bands.map((b) => b.count));
  const paid = clients.reduce((s, c) => s + c.paid, 0);
  const open = clients.reduce((s, c) => s + c.open, 0);
  const payers = clients.filter((c) => c.paid > 0).length;
  // Revenue per client per month of coaching, for clients with both on file.
  const monthly = clients.filter((c) => c.paid > 0 && c.tenureDays != null && c.tenureDays >= 30).map((c) => c.paid / (c.tenureDays! / 30.44));

  const basis = (k: number) => `${k} of ${n} client${n === 1 ? "" : "s"}`;
  const tiles: { label: string; value: string; unit?: string; basis: string }[] = [
    { label: "Clients", value: String(n), basis: "on your roster now" },
    { label: "Average age", value: avg(ages) != null ? String(Math.round(avg(ages)!)) : "–", unit: avg(ages) != null ? "yrs" : undefined, basis: basis(ages.length) },
    { label: "Average height", value: avg(heights) != null ? String(Math.round(avg(heights)!)) : "–", unit: avg(heights) != null ? "cm" : undefined, basis: basis(heights.length) },
    { label: "Average weight", value: avg(weights) != null ? String(round1(avg(weights)!)) : "–", unit: avg(weights) != null ? "kg" : undefined, basis: basis(weights.length) },
    { label: "Average time with you", value: avg(tenures) != null ? span(avg(tenures)!) : "–", basis: basis(tenures.length) },
    { label: "Longest", value: tenures.length ? span(Math.max(...tenures)) : "–", basis: "since their coaching start date" },
  ];
  const revenue: { label: string; value: string; basis: string }[] = [
    { label: "Paid to date", value: money(paid), basis: `${payers} paying client${payers === 1 ? "" : "s"}` },
    { label: "Average per client", value: payers ? money(paid / payers) : "–", basis: "paid invoices, per paying client" },
    { label: "Average per client per month", value: avg(monthly) != null ? money(avg(monthly)!) : "–", basis: basis(monthly.length) },
    { label: "Outstanding", value: money(open), basis: "invoices not marked paid" },
  ];

  return (
    <>
      <div className="fd-head">
        <h1 className="fd-title">Business</h1>
      </div>

      <section className="pl-card">
        <div className="pl-card-head">
          <div className="pl-card-titles">
            <span className="pl-eyebrow">Your clients</span>
            <span className="pl-helper">From what is filled in on each client&rsquo;s card; blanks are left out</span>
          </div>
        </div>
        <div className="biz-tiles">
          {tiles.map((t) => (
            <div key={t.label} className="biz-tile">
              <span className="biz-label">{t.label}</span>
              <span className="biz-value">
                {t.value}
                {t.unit && <small> {t.unit}</small>}
              </span>
              <span className="biz-basis">{t.basis}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="biz-two">
        <section className="pl-card">
          <div className="pl-card-head">
            <div className="pl-card-titles">
              <span className="pl-eyebrow">Gender</span>
              <span className="pl-helper">{basis(genders.length)}</span>
            </div>
          </div>
          {genderSplit.length ? (
            <div className="biz-bars">
              {genderSplit.map((g) => {
                const pct = Math.round((g.count / genders.length) * 100);
                return (
                  <div key={g.label} className="biz-bar-row">
                    <span className="biz-bar-label">{g.label}</span>
                    <span className="biz-bar-track">
                      <span className="biz-bar-fill" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="biz-bar-num">
                      {pct}% <small>({g.count})</small>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="ch-empty">No gender filled in on any card yet.</p>
          )}
        </section>

        <section className="pl-card">
          <div className="pl-card-head">
            <div className="pl-card-titles">
              <span className="pl-eyebrow">Age</span>
              <span className="pl-helper">{basis(ages.length)}</span>
            </div>
          </div>
          {ages.length ? (
            <div className="biz-bars">
              {bands.map((b) => (
                <div key={b.label} className="biz-bar-row">
                  <span className="biz-bar-label">{b.label}</span>
                  <span className="biz-bar-track">
                    <span className="biz-bar-fill" style={{ width: `${(b.count / bandMax) * 100}%` }} />
                  </span>
                  <span className="biz-bar-num">{b.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="ch-empty">No birthdate filled in on any card yet.</p>
          )}
        </section>
      </div>

      <section className="pl-card">
        <div className="pl-card-head">
          <div className="pl-card-titles">
            <span className="pl-eyebrow">Revenue</span>
            <span className="pl-helper">From the invoices on each client&rsquo;s card</span>
          </div>
        </div>
        <div className="biz-tiles">
          {revenue.map((t) => (
            <div key={t.label} className="biz-tile">
              <span className="biz-label">{t.label}</span>
              <span className="biz-value">{t.value}</span>
              <span className="biz-basis">{t.basis}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
