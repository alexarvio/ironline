import Link from "next/link";
import { getUserForClient, requireCoach } from "../../../lib/auth";
import {
  getClientProfile,
  getLatestWeight,
  listClients,
  listInvoices,
  listPrograms,
  localDateStr,
} from "../../../lib/queries";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/basics";
import { loadRail } from "../loaders";
import RedesignRail from "../RedesignRail";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../rail.css";
import "./business.css";

// The coach's business at a glance, in the redesign with the rail on its
// left (replaces /admin?view=business): who their clients are (age, gender,
// height, weight), how long they stay, what they pay, and a row a client.
// Every figure comes from what is on the clients' cards and says how many
// clients it rests on: a blank is left out, never counted as zero.
//   /admin/redesign/business
export const dynamic = "force-dynamic";

const DAY = 86400000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (list: number[]) =>
  list.length ? list.reduce((s, n) => s + n, 0) / list.length : null;
const daysSince = (iso: string, today: string) =>
  Math.floor(
    (new Date(`${today}T00:00:00`).getTime() -
      new Date(`${iso}T00:00:00`).getTime()) /
      DAY,
  );
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

export default async function BusinessPage() {
  const coach = await requireCoach();
  const today = localDateStr();
  const clients = listClients(coach.id).map((c) => {
    const p = getClientProfile(c.id);
    const age = p.birthdate
      ? Math.floor(daysSince(p.birthdate, today) / 365.25)
      : null;
    const gender = (p.gender ?? "").trim().toLowerCase();
    const invoices = listInvoices(c.id);
    return {
      id: c.id,
      name: c.name ?? "Client",
      age: age != null && age > 0 && age < 120 ? age : null,
      gender: gender.startsWith("m")
        ? "Male"
        : gender.startsWith("f") || gender.startsWith("w")
          ? "Female"
          : gender
            ? "Other"
            : null,
      height: p.height_cm ?? null,
      weight: getLatestWeight(c.id) ?? p.starting_weight_kg ?? null,
      // With you since: the coaching start date on their card; else the day
      // their login was made; else when their first programme went live.
      tenureDays: (() => {
        const firstProgram = listPrograms(c.id)
          .map((pr) => pr.deployed_at?.slice(0, 10))
          .filter((d): d is string => !!d)
          .sort()[0];
        const since =
          p.coaching_start_date ||
          getUserForClient(c.id)?.created_at?.slice(0, 10) ||
          firstProgram ||
          null;
        return since ? Math.max(0, daysSince(since, today)) : null;
      })(),
      // The latest invoice's day: when they were last billed.
      lastBilled:
        invoices
          .map((i) => i.created_at.slice(0, 10))
          .sort()
          .at(-1) ?? null,
      paid: invoices
        .filter((i) => i.status === "paid")
        .reduce((s, i) => s + (i.amount || 0), 0),
      open: invoices
        .filter((i) => i.status !== "paid")
        .reduce((s, i) => s + (i.amount || 0), 0),
    };
  });
  const n = clients.length;
  const have = <K extends "age" | "height" | "weight" | "tenureDays">(k: K) =>
    clients.map((c) => c[k]).filter((v): v is number => v != null);
  const ages = have("age");
  const heights = have("height");
  const weights = have("weight");
  const tenures = have("tenureDays");
  const genders = clients
    .map((c) => c.gender)
    .filter((g): g is "Male" | "Female" | "Other" => g != null);
  const genderSplit = (["Male", "Female", "Other"] as const)
    .map((g) => ({ label: g, count: genders.filter((x) => x === g).length }))
    .filter((g) => g.count > 0);
  const bands = AGE_BANDS.map((b) => ({
    ...b,
    count: ages.filter((a) => a >= b.min && a <= b.max).length,
  }));
  const bandMax = Math.max(1, ...bands.map((b) => b.count));
  const paid = clients.reduce((s, c) => s + c.paid, 0);
  const open = clients.reduce((s, c) => s + c.open, 0);
  const payers = clients.filter((c) => c.paid > 0).length;
  const monthly = clients
    .filter((c) => c.paid > 0 && c.tenureDays != null && c.tenureDays >= 30)
    .map((c) => c.paid / (c.tenureDays! / 30.44));
  const basis = (k: number) => `${k} of ${n} client${n === 1 ? "" : "s"}`;

  const people: {
    label: string;
    value: string;
    unit?: string;
    basis: string;
  }[] = [
    { label: "Clients", value: String(n), basis: "on your roster now" },
    {
      label: "Average age",
      value: avg(ages) != null ? String(Math.round(avg(ages)!)) : "–",
      unit: avg(ages) != null ? "yrs" : undefined,
      basis: basis(ages.length),
    },
    {
      label: "Average height",
      value: avg(heights) != null ? String(Math.round(avg(heights)!)) : "–",
      unit: avg(heights) != null ? "cm" : undefined,
      basis: basis(heights.length),
    },
    {
      label: "Average weight",
      value: avg(weights) != null ? String(round1(avg(weights)!)) : "–",
      unit: avg(weights) != null ? "kg" : undefined,
      basis: basis(weights.length),
    },
    {
      label: "Average time with you",
      value: avg(tenures) != null ? span(avg(tenures)!) : "–",
      basis: basis(tenures.length),
    },
    {
      label: "Longest",
      value: tenures.length ? span(Math.max(...tenures)) : "–",
      basis: "since their coaching start",
    },
  ];
  const revenue: {
    label: string;
    value: string;
    basis: string;
    tone?: "warn";
  }[] = [
    {
      label: "Paid to date",
      value: money(paid),
      basis: `${payers} paying client${payers === 1 ? "" : "s"}`,
    },
    {
      label: "Average per client",
      value: payers ? money(paid / payers) : "–",
      basis: "paid invoices, per paying client",
    },
    {
      label: "Per client per month",
      value: avg(monthly) != null ? money(avg(monthly)!) : "–",
      basis: basis(monthly.length),
    },
    {
      label: "Outstanding",
      value: money(open),
      basis: "invoices not marked paid",
      tone: open > 0 ? "warn" : undefined,
    },
  ];
  const byPaid = [...clients].sort(
    (a, b) => b.paid - a.paid || a.name.localeCompare(b.name),
  );

  return (
    <div className="rd-frame">
      <RedesignRail rail={loadRail(coach)} clientId={0} />
      <div className="rd-page">
        <div className="bzd">
          <header>
            <h1 className="bzd-title">Business</h1>
            <p className="bzd-sub">
              From what is filled in on each client&rsquo;s card; blanks are
              left out, never counted as zero.
            </p>
          </header>

          {/* The numbers on the left, every client on the right: the page fills the screen. */}
          <div className="bzd-cols">
            <div className="bzd-left">
              <section className="bzd-section" aria-label="Your clients">
                <h2 className="bzd-h">Your clients</h2>
                <div className="bzd-tiles">
                  {people.map((t) => (
                    <Card key={t.label} className="bzd-tile">
                      <CardContent>
                        <span className="bzd-label">{t.label}</span>
                        <span className="bzd-value">
                          {t.value}
                          {t.unit && <small> {t.unit}</small>}
                        </span>
                        <span className="bzd-basis">{t.basis}</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

              <div className="bzd-two">
                <Card>
                  <CardHeader>
                    <CardTitle>Gender</CardTitle>
                    <CardDescription>{basis(genders.length)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {genderSplit.length ? (
                      <div className="bzd-bars">
                        {genderSplit.map((g) => {
                          const pct = Math.round(
                            (g.count / genders.length) * 100,
                          );
                          return (
                            <div key={g.label} className="bzd-bar-row">
                              <span className="bzd-bar-label">{g.label}</span>
                              <span className="bzd-bar-track">
                                <span
                                  className="bzd-bar-fill"
                                  style={{ width: `${pct}%` }}
                                />
                              </span>
                              <span className="bzd-bar-num">
                                {pct}% <small>({g.count})</small>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="bzd-empty">
                        No gender filled in on any card yet.
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Age</CardTitle>
                    <CardDescription>{basis(ages.length)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {ages.length ? (
                      <div className="bzd-bars">
                        {bands.map((b) => (
                          <div key={b.label} className="bzd-bar-row">
                            <span className="bzd-bar-label">{b.label}</span>
                            <span className="bzd-bar-track">
                              <span
                                className="bzd-bar-fill"
                                style={{
                                  width: `${(b.count / bandMax) * 100}%`,
                                }}
                              />
                            </span>
                            <span className="bzd-bar-num">{b.count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="bzd-empty">
                        No birthdate filled in on any card yet.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <section className="bzd-section" aria-label="Revenue">
                <h2 className="bzd-h">Revenue</h2>
                <div className="bzd-tiles four">
                  {revenue.map((t) => (
                    <Card
                      key={t.label}
                      className={`bzd-tile${t.tone ? ` ${t.tone}` : ""}`}
                    >
                      <CardContent>
                        <span className="bzd-label">{t.label}</span>
                        <span className="bzd-value">{t.value}</span>
                        <span className="bzd-basis">{t.basis}</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            </div>

            {/* A row a client, most paid first; a name opens their Home. */}
            <Card className="bzd-right">
              <CardHeader>
                <CardTitle>By client</CardTitle>
                <CardDescription>Most paid first</CardDescription>
              </CardHeader>
              <CardContent>
                {n === 0 ? (
                  <p className="bzd-empty">No clients yet.</p>
                ) : (
                  <Table className="bzd-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Age</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>With you</TableHead>
                        <TableHead>Last billed</TableHead>
                        <TableHead className="num">Paid</TableHead>
                        <TableHead className="num">Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byPaid.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <Link
                              href={`/admin/redesign/home?client=${c.id}`}
                              className="bzd-name"
                            >
                              {c.name}
                            </Link>
                          </TableCell>
                          <TableCell>{c.age ?? "–"}</TableCell>
                          <TableCell>{c.gender ?? "–"}</TableCell>
                          <TableCell>
                            {c.tenureDays != null ? span(c.tenureDays) : "–"}
                          </TableCell>
                          <TableCell>
                            {c.lastBilled
                              ? new Date(
                                  `${c.lastBilled}T00:00:00`,
                                ).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "–"}
                          </TableCell>
                          <TableCell className="num">
                            {c.paid ? money(c.paid) : "–"}
                          </TableCell>
                          <TableCell className="num">
                            {c.open ? (
                              <Badge className="bzd-open">
                                {money(c.open)}
                              </Badge>
                            ) : (
                              "–"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
