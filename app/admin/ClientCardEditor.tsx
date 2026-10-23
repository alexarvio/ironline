"use client";

import { ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { renameClientAction, saveClientCardAction } from "../lib/actions";
import { addClientPlanAction, setClientPlanAction } from "../lib/planActions";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { CheckIcon, ChevronDownIcon } from "../components/icons";
import type { OverviewInfoRow, OverviewPanel } from "../lib/queries";
import PanelSection from "./PanelSection";
import { ageFrom, DEFAULT_DIAL, GenderPills, InfoRow, PhoneInput, Suffixed } from "./InfoRow";
import DatePick from "./redesign/DatePick";

// Member info and Coaching info — the client card, as two collapsible
// sections of the client panel.
//
// Most of this is filled once at onboarding and then never touched, which is
// exactly why it has to be correctable: an email changes, a phase ends, a
// check-in day moves. Each section reads as label/value rows; an empty field
// shows "Add", which opens that section's editor on the field, and the button
// at the foot opens it too. Editing happens in place, in the section.
//
// Only what a coach actually authors is editable. Plan, current week, current
// weight and the change are derived — from the live programme and the
// client's own logged weight — so they stay read-only rows rather than
// becoming a second, stale copy of the truth.

type Card = OverviewPanel["card"];
type CardKey = Exclude<keyof Card, "goal_phase_from_plan">;
const CARD_KEYS: CardKey[] = [
  "name",
  "birthdate",
  "gender",
  "height_cm",
  "email",
  "phone_code",
  "phone",
  "address",
  "coaching_start_date",
  "goal_phase",
  "goal_date",
  "check_in_day",
  "starting_weight_kg",
];
const MEMBER_KEYS: CardKey[] = ["name", "birthdate", "gender", "height_cm", "email", "phone_code", "phone", "address"];
const COACHING_KEYS: CardKey[] = ["coaching_start_date", "goal_date", "goal_phase", "check_in_day", "starting_weight_kg"];

type Which = "member" | "coaching";

export default function ClientCardEditor({
  clientId,
  panel,
  onboarding = false,
  chrome = "panel",
  look,
  plans = [],
  planId = null,
}: {
  clientId: number;
  panel: OverviewPanel;
  /** "panel": collapsible sections in the client panel. "rail": two cards on
      the client's Home, each with an Edit in its header strip. */
  chrome?: "panel" | "rail";
  /** Straight after the client was created. Both sections open already in
      edit mode, with a line saying why — onboarding is not a separate wizard,
      it is this same card being filled in for the first time. */
  onboarding?: boolean;
  /** "hairline": the redesign's look, on Home's Details: Contact and Coaching as grids of facts (23 Oct, Alex: mockup A
      with B's icons), the edit pop-up in ink and hairlines. */
  look?: "hairline";
  /** The plans the client's coach offers, and the one the client is on (23 Oct, Alex): the hairline look's Plan. */
  plans?: { id: string; name: string }[];
  planId?: string | null;
}) {
  const hl = look === "hairline";
  const [editing, setEditing] = useState<Record<Which, boolean>>({ member: onboarding, coaching: onboarding });
  const [focus, setFocus] = useState<string | null>(null);
  const [, startRename] = useTransition();
  const card = panel.card;

  const edit = (which: Which, field?: string) => {
    setFocus(field ?? null);
    setEditing((e) => ({ ...e, [which]: true }));
  };
  const done = (which: Which) => setEditing((e) => ({ ...e, [which]: false }));

  const filled = panel.memberInfo.filter((r) => r.value).length;
  const set = panel.coachingInfo.filter((r) => r.value).length;

  // The fields themselves, once, whether they show inline (the panel, and
  // onboarding with it) or in the dialog the card's Edit opens. On the
  // client's Home the card is a narrow column: a form in it squeezed seven
  // boxed inputs into 180px, so there it lifts out into a dialog and the
  // rows keep the shape they have when they are being read.
  const memberFields = (
    <>
      {onboarding && (
        // Everything here can be left blank and filled in later — saying
        // so matters, because a coach adding a client mid-conversation
        // rarely has the address to hand and shouldn't feel stuck.
        <p className="ad-onboard-note">New client. Fill in what you know. Anything you skip can be added later.</p>
      )}
      <MemberFields
        card={card}
        focus={focus}
        // The name saves on its own when the coach leaves the field. It is
        // the one thing on this card that shows elsewhere immediately (the
        // rail, the panel header).
        onRename={(v) => {
          if (v.trim() && v.trim() !== card.name) startRename(() => renameClientAction(clientId, v));
        }}
      />
    </>
  );

  const coachingKeys = hl ? COACHING_KEYS.filter((k) => k !== "starting_weight_kg") : COACHING_KEYS;
  const coachingFields = (
    <>
      <div className="nc-grid">
        <Field label="Start date" name="coaching_start_date" value={card.coaching_start_date} type="date" focus={focus} />
        <Field label="Goal date" name="goal_date" value={card.goal_date} type="date" focus={focus} />
        {card.goal_phase_from_plan ? (
          // Driven by the Plan tab while a nutrition phase is running:
          // editing it here would be overwritten on the next render, so
          // the card says where it comes from instead of offering a box.
          <InfoRow label="Goal / phase" aside="from the Plan tab" as="div">
            <span className="nc-static">{card.goal_phase_from_plan}</span>
            <input type="hidden" name="goal_phase" value={card.goal_phase} />
          </InfoRow>
        ) : (
          <Field label="Goal / phase" name="goal_phase" value={card.goal_phase} focus={focus} />
        )}
        <Field label="Check-in day" name="check_in_day" value={card.check_in_day} placeholder="Monday" focus={focus} />
        {/* No weight in the redesign's Details (23 Oct, Alex): its saved value rides along untouched (coachingKeys). */}
        {!hl && <Field label="Starting weight" name="starting_weight_kg" value={card.starting_weight_kg} type="number" step="0.1" suffix="kg" focus={focus} />}
      </div>
      {/* Named, not hidden: a coach looking for "current week" here should
          find out where it comes from rather than assume it's missing.
          Not in the redesign's look, which explains nothing (design rules 1). */}
      {!hl && <p className="ad-field-note">Plan, current week and current weight follow the live programme and the client&rsquo;s own check-ins. They can&rsquo;t be typed here.</p>}
    </>
  );

  const inDialog = chrome === "rail";

  return (
    <>
      {hl && inDialog ? (
        <>
          <ContactFacts rows={panel.memberInfo} onEdit={(field) => edit("member", field)} />
          <CoachingFacts rows={panel.coachingInfo} onEdit={(field) => edit("coaching", field)} plan={<PlanPicker clientId={clientId} plans={plans} planId={planId} />} />
        </>
      ) : (
        <>
          <Section chrome={chrome} onboarding={onboarding} title="Member info" hint={`${filled} of ${panel.memberInfo.length} filled`} onEdit={() => edit("member")}>
            {editing.member && !inDialog ? (
              <CardForm clientId={clientId} card={card} keys={MEMBER_KEYS} cancelLabel={onboarding ? "Skip for now" : "Cancel"} onDone={() => done("member")}>
                {memberFields}
              </CardForm>
            ) : (
              <>
                <InfoRows rows={panel.memberInfo} onAdd={(field) => edit("member", field)} />
                {chrome === "panel" && (
                  <button type="button" className="ad-sect-edit" onClick={() => edit("member")}>
                    Edit details
                  </button>
                )}
              </>
            )}
          </Section>

          <Section chrome={chrome} onboarding={onboarding} title="Coaching info" hint={`${set} of ${panel.coachingInfo.length} set`} defaultOpen onEdit={() => edit("coaching")}>
            {editing.coaching && !inDialog ? (
              <CardForm clientId={clientId} card={card} keys={coachingKeys} cancelLabel={onboarding ? "Skip for now" : "Cancel"} onDone={() => done("coaching")}>
                {coachingFields}
              </CardForm>
            ) : (
              <>
                <InfoRows rows={panel.coachingInfo} onAdd={(field) => edit("coaching", field)} />
                {chrome === "panel" && (
                  <button type="button" className="ad-sect-edit" onClick={() => edit("coaching")}>
                    Edit plan
                  </button>
                )}
              </>
            )}
          </Section>
        </>
      )}

      {inDialog && editing.member && (
        <CardDialog hl={hl} title="Member info" clientId={clientId} card={card} keys={MEMBER_KEYS} onDone={() => done("member")}>
          {memberFields}
        </CardDialog>
      )}
      {inDialog && editing.coaching && (
        <CardDialog hl={hl} title="Coaching info" clientId={clientId} card={card} keys={coachingKeys} onDone={() => done("coaching")}>
          {coachingFields}
        </CardDialog>
      )}
    </>
  );
}

// One wrapper or the other; what is inside them is the same. Defined out
// here rather than inside the editor: a component built during render is a
// new type on every keystroke, which remounted PanelSection and threw away
// whether the coach had it open.
function Section({
  chrome,
  onboarding,
  title,
  hint,
  defaultOpen,
  onEdit,
  children,
}: {
  chrome: "panel" | "rail";
  onboarding: boolean;
  title: string;
  hint: string;
  defaultOpen?: boolean;
  onEdit: () => void;
  children: ReactNode;
}) {
  if (chrome === "rail") {
    return (
      <section className="ch-card ch-rail-card">
        <div className="ch-rail-head">
          <span className="ch-label">{title}</span>
          <button type="button" className="ch-edit" onClick={onEdit}>
            Edit
          </button>
        </div>
        {children}
      </section>
    );
  }
  return (
    <PanelSection title={title} hint={hint} defaultOpen={defaultOpen} forceOpen={onboarding}>
      {children}
    </PanelSection>
  );
}

// The card, lifted off the page to be filled in.
//
// Rows keep the rhythm they have when they are being read — label left,
// value right, a hairline between — and the input is the value rather than a
// box around it: transparent at rest, outlined on hover, white on focus.
// Seven boxed inputs stacked in a narrow card read as a form to be survived;
// this reads as the card itself, with the values now typeable.
function CardDialog({ hl, title, clientId, card, keys, onDone, children }: { hl: boolean; title: string; clientId: number; card: Card; keys: CardKey[]; onDone: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDone]);

  return createPortal(
    <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onDone()}>
      <div className={`pb-modal cc-dialog${hl ? " cc-hl" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="cc-dialog-head">
          <span className="ch-label">{title}</span>
          <button type="button" className="cc-dialog-x" onClick={onDone} aria-label="Close">
            {hl ? "✕" : "×"}
          </button>
        </div>
        <CardForm clientId={clientId} card={card} keys={keys} cancelLabel="Cancel" onDone={onDone}>
          {children}
        </CardForm>
      </div>
    </div>,
    document.body,
  );
}

// Label left, value right. Empty and editable: "Add", which opens the
// editor on that field. Empty and derived: said plainly, not a dash.
function InfoRows({ rows, onAdd }: { rows: OverviewInfoRow[]; onAdd: (field: string) => void }) {
  return (
    <div className="ad-rows">
      {rows.map((r) => (
        <div key={r.label} className="ad-row">
          <span className="ad-row-label">{r.label}</span>
          {r.value ? (
            <span className={`ad-row-value${r.tone === "good" ? " good" : ""}`}>{r.value}</span>
          ) : r.field ? (
            <button type="button" className="ad-row-add" onClick={() => onAdd(r.field!)}>
              Add
            </button>
          ) : (
            <span className="ad-row-none">Not set</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- The hairline look (Home's Details; 23 Oct, Alex: mockup A with B's icons). Styles: `.cc-` in home/home.css.

/** A contact line's icon: stroke 1.6, round caps and joins, no fills (design rules 5). */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Contact: a line a fact, its icon naming it (no word label); Email and Address take two of the three columns. */
const CONTACT: { field: string; name: string; add: string; wide?: boolean; icon: ReactNode }[] = [
  {
    field: "email",
    name: "Email",
    add: "Add email",
    wide: true,
    icon: (
      <Glyph>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </Glyph>
    ),
  },
  {
    field: "phone",
    name: "Phone",
    add: "Add phone",
    icon: (
      <Glyph>
        <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
      </Glyph>
    ),
  },
  {
    field: "address",
    name: "Address",
    add: "Add address",
    wide: true,
    icon: (
      <Glyph>
        <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </Glyph>
    ),
  },
  {
    field: "birthdate",
    name: "Birthday",
    add: "Add birthday",
    icon: (
      <Glyph>
        <path d="M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7" />
        <path d="M3 21h18" />
        <path d="M5 16c2.3 1.3 4.7 1.3 7 0s4.7-1.3 7 0" />
        <path d="M12 12V8.5" />
        <path d="M12 6.2c.7 0 1.2-.5 1.2-1.2 0-1-1.2-2.2-1.2-2.2s-1.2 1.2-1.2 2.2c0 .7.5 1.2 1.2 1.2z" />
      </Glyph>
    ),
  },
];

/** Coaching: a small grey label over each figure, three across. `row` is the server's label (OverviewPanel.coachingInfo). */
const COACHING: { row: string; name: string; add?: string }[] = [
  { row: "Start date", name: "Started", add: "Add start date" },
  { row: "Goal date", name: "Goal date", add: "Add goal date" },
  { row: "Check-in day", name: "Check-in day", add: "Add check-in day" },
];

/** A section's head: its small caps label, Edit in words on the right. */
function FactsHead({ title, onEdit }: { title: string; onEdit: () => void }) {
  return (
    <div className="cc-sec-head">
      <span className="dlh-label">{title}</span>
      <button type="button" className="rh-textact" onClick={onEdit}>
        Edit
      </button>
    </div>
  );
}

// An empty one is its icon and "Add phone", which opens the editor on that field.
function ContactFacts({ rows, onEdit }: { rows: OverviewInfoRow[]; onEdit: (field?: string) => void }) {
  return (
    <section className="cc-sec">
      <FactsHead title="Contact" onEdit={() => onEdit()} />
      <div className="cc-grid">
        {CONTACT.map((c) => {
          const value = rows.find((r) => r.field === c.field)?.value ?? "";
          const cls = `cc-line${c.wide ? " wide" : ""}`;
          return value ? (
            <div key={c.field} className={cls} title={`${c.name}: ${value}`}>
              {c.icon}
              <span className="sr-only">{c.name}: </span>
              <span className="cc-line-v">{value}</span>
            </div>
          ) : (
            <button key={c.field} type="button" className={`${cls} add`} onClick={() => onEdit(c.field)}>
              {c.icon}
              <span className="cc-line-v">{c.add}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// Empty and editable: "Add", which opens the editor on that field. Empty and derived (now, the change): a grey dash.
// The Plan first (23 Oct, Alex: picked here, for invoices later), then the dates; no weight (23 Oct, Alex).
function CoachingFacts({ rows, onEdit, plan }: { rows: OverviewInfoRow[]; onEdit: (field?: string) => void; plan: ReactNode }) {
  return (
    <section className="cc-sec">
      <FactsHead title="Coaching" onEdit={() => onEdit()} />
      <div className="cc-grid">
        <div className="cc-cell">
          <span className="cc-cell-k">Plan</span>
          {plan}
        </div>
        {COACHING.map((c) => {
          const r = rows.find((x) => x.label === c.row);
          return (
            <div key={c.row} className="cc-cell">
              <span className="cc-cell-k">{c.name}</span>
              {r?.value ? (
                <span className={`cc-cell-v${r.tone === "good" ? " good" : ""}`}>{r.value}</span>
              ) : r?.field ? (
                <button type="button" className="cc-cell-v add" onClick={() => onEdit(r.field)} aria-label={c.add ?? `Add ${c.name.toLowerCase()}`}>
                  Add
                </button>
              ) : (
                <span className="cc-cell-v none">–</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// The plan a client is on (23 Oct, Alex): one of the coach's, picked from the floating list (design rules 6), None to
// take it off; + New plan pinned at its foot opens a name line in the same panel, Cancel in words and an ink Add, and
// puts the client on the new plan. Shown at once; the page re-reads after the save.
function PlanPicker({ clientId, plans, planId }: { clientId: number; plans: { id: string; name: string }[]; planId: string | null }) {
  const router = useRouter();
  const [, startSaving] = useTransition();
  const [open, setOpen] = useState(false);
  const [making, setMaking] = useState(false);
  const [name, setName] = useState("");
  // What is shown follows a pick at once, and the server's value whenever that changes (by content, not identity).
  const [picked, setPicked] = useState<{ value: string | null; base: string | null } | null>(null);
  const shown = picked && picked.base === planId ? picked.value : planId;
  const setShown = (value: string | null) => setPicked({ value, base: planId });
  const [added, setAdded] = useState<{ id: string; name: string }[]>([]);
  const list = [...plans, ...added.filter((a) => !plans.some((p) => p.id === a.id))];
  const current = list.find((p) => p.id === shown) ?? null;
  const close = () => {
    setOpen(false);
    setMaking(false);
    setName("");
  };
  const pick = (id: string | null) => {
    close();
    setShown(id);
    startSaving(async () => {
      await setClientPlanAction(clientId, id);
      router.refresh();
    });
  };
  const create = () => {
    const clean = name.trim();
    if (!clean) return;
    close();
    startSaving(async () => {
      const made = await addClientPlanAction(clientId, clean);
      if (made) {
        setAdded((a) => [...a, made]);
        setShown(made.id);
      }
      router.refresh();
    });
  };
  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button type="button" className={`cc-cell-v cc-plan${current ? "" : " add"}`} aria-label={current ? `Plan: ${current.name}. Change` : "Pick a plan"}>
          <span>{current ? current.name : "Add"}</span>
          <ChevronDownIcon />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="cc-plan-pop">
        {making ? (
          <form
            className="cc-plan-new"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <span className="dlh-label">New plan</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Name" aria-label="Name of the new plan" />
            <span className="cc-plan-new-foot">
              <button type="button" className="cc-plan-cancel" onClick={() => setMaking(false)}>
                Cancel
              </button>
              <button type="submit" className="cc-plan-add" disabled={!name.trim()}>
                Add
              </button>
            </span>
          </form>
        ) : (
          <>
            <div className="cc-plan-list" role="listbox" aria-label="Plans">
              {list.length === 0 && <p className="cc-plan-empty">No plans yet</p>}
              {list.map((p) => (
                <button key={p.id} type="button" role="option" aria-selected={p.id === shown} className={`cc-plan-row${p.id === shown ? " on" : ""}`} onClick={() => pick(p.id)}>
                  <span>{p.name}</span>
                  {p.id === shown && <CheckIcon />}
                </button>
              ))}
              {current && (
                <button type="button" role="option" aria-selected={false} className="cc-plan-row none" onClick={() => pick(null)}>
                  <span>None</span>
                </button>
              )}
            </div>
            <button type="button" className="cc-plan-make" onClick={() => setMaking(true)}>
              + New plan
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// One section's form. The save action writes the whole card, so the other
// section's fields ride along as their saved values rather than blanking.
// The action runs inside a transition so edit mode closes AFTER the save
// resolves; flipping state on click unmounted the form mid-submit before.
function CardForm({ clientId, card, keys, cancelLabel, onDone, children }: { clientId: number; card: Card; keys: CardKey[]; cancelLabel: string; onDone: () => void; children: ReactNode }) {
  const [saving, startSaving] = useTransition();
  return (
    <form
      action={(fd) =>
        startSaving(async () => {
          await saveClientCardAction(fd);
          onDone();
        })
      }
      className="ad-card-form"
    >
      <input type="hidden" name="clientId" value={clientId} />
      {CARD_KEYS.filter((k) => !keys.includes(k)).map((k) => (
        <input key={k} type="hidden" name={k} value={card[k]} />
      ))}
      {children}
      <div className="ad-card-form-foot">
        <button type="button" className="ad-btn-secondary" onClick={onDone}>
          {cancelLabel}
        </button>
        <button type="submit" className="ad-btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

// The member fields, with their own state for the few that are not plain
// text: the age beside Birthdate follows the date as it is typed, Gender is
// three pills, and Phone is a dial code and a number kept apart. Mounted
// afresh each time the card is edited, so Cancel leaves nothing behind.
function MemberFields({ card, focus, onRename }: { card: Card; focus: string | null; onRename: (v: string) => void }) {
  const [birthdate, setBirthdate] = useState(card.birthdate);
  const [gender, setGender] = useState(card.gender);
  // A phone typed before the split keeps its text and no code, rather than
  // a country guessed out of it.
  const legacy = !card.phone_code && !!card.phone;
  const [code, setCode] = useState(card.phone_code || (legacy ? "" : DEFAULT_DIAL));
  const [phone, setPhone] = useState(card.phone);
  const age = ageFrom(birthdate);
  return (
    <div className="nc-grid">
      <Field label="Name" name="name" value={card.name} required focus={focus} onBlur={onRename} full />
      <InfoRow label="Birthdate" aside={age != null ? `${age} years old` : null}>
        {/* Typed or picked, as every date (20 Oct, Alex); posted under its name. */}
        <FocusIn on={focus === "birthdate"}>
          <DatePick value={birthdate} onChange={setBirthdate} label="Birthdate" clearable className="nc-input nc-date" />
        </FocusIn>
        <input type="hidden" name="birthdate" value={birthdate} />
      </InfoRow>
      <InfoRow label="Gender" as="div">
        <GenderPills name="gender" value={gender} onChange={setGender} />
      </InfoRow>
      <Field label="Height" name="height_cm" value={card.height_cm} type="number" suffix="cm" focus={focus} />
      <Field label="Email" name="email" value={card.email} type="email" focus={focus} full />
      <InfoRow label="Phone" as="div">
        <FocusIn on={focus === "phone"}>
          <PhoneInput code={code} number={phone} onCode={setCode} onNumber={setPhone} codeName="phone_code" numberName="phone" legacy={legacy} />
        </FocusIn>
      </InfoRow>
      <Field label="Address" name="address" value={card.address} focus={focus} />
    </div>
  );
}

// One row of the card: an InfoRow (shared with the New client dialog) whose
// input is the value itself.
function Field({
  label,
  name,
  value,
  type = "text",
  step,
  suffix,
  placeholder,
  required,
  focus,
  onBlur,
  full = false,
}: {
  label: string;
  name: string;
  value: string;
  type?: string;
  step?: string;
  suffix?: string;
  placeholder?: string;
  required?: boolean;
  /** The field an "Add" link opened the editor on. */
  focus: string | null;
  /** Called with the field's value when focus leaves it. */
  onBlur?: (value: string) => void;
  /** Spans both columns. */
  full?: boolean;
}) {
  if (type === "date") return <DateField label={label} name={name} value={value} full={full} focus={focus === name} />;
  const input = (
    <input
      className="nc-input"
      name={name}
      type={type}
      step={step}
      defaultValue={value}
      placeholder={placeholder}
      required={required}
      autoFocus={focus === name}
      onBlur={onBlur ? (e) => onBlur(e.currentTarget.value) : undefined}
    />
  );
  return (
    <InfoRow label={label} full={full}>
      {suffix ? <Suffixed unit={suffix}>{input}</Suffixed> : input}
    </InfoRow>
  );
}

/** A date row of the card: typed or picked (20 Oct, Alex: every date field is the same), posted under its name. */
function DateField({ label, name, value, full, focus }: { label: string; name: string; value: string; full: boolean; focus: boolean }) {
  const [day, setDay] = useState(value);
  return (
    <InfoRow label={label} full={full}>
      <FocusIn on={focus}>
        <DatePick value={day} onChange={setDay} label={label} clearable className="nc-input nc-date" />
      </FocusIn>
      <input type="hidden" name={name} value={day} />
    </InfoRow>
  );
}

/** The cursor in the first box inside, as it opens, when an "Add" link opened the editor on it: autoFocus for the
    controls that take none (DatePick, PhoneInput's number). No box of its own: `display: contents`. */
function FocusIn({ on, children }: { on: boolean; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (on) ref.current?.querySelector<HTMLInputElement>('input:not([type="hidden"])')?.focus();
  }, [on]);
  return (
    <span ref={ref} style={{ display: "contents" }}>
      {children}
    </span>
  );
}
