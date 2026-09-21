"use client";

import { ReactNode, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { renameClientAction, saveClientCardAction } from "../lib/actions";
import type { OverviewInfoRow, OverviewPanel } from "../lib/queries";
import PanelSection from "./PanelSection";
import { ageFrom, DEFAULT_DIAL, GenderPills, InfoRow, PhoneInput, Suffixed } from "./InfoRow";

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
}) {
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
        <Field label="Starting weight" name="starting_weight_kg" value={card.starting_weight_kg} type="number" step="0.1" suffix="kg" focus={focus} />
      </div>
      {/* Named, not hidden: a coach looking for "current week" here should
          find out where it comes from rather than assume it's missing. */}
      <p className="ad-field-note">
        Plan, current week and current weight follow the live programme and the client&rsquo;s own check-ins.
        They can&rsquo;t be typed here.
      </p>
    </>
  );

  const inDialog = chrome === "rail";

  return (
    <>
      <Section
        chrome={chrome}
        onboarding={onboarding}
        title="Member info"
        hint={`${filled} of ${panel.memberInfo.length} filled`}
        onEdit={() => edit("member")}
      >
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

      <Section
        chrome={chrome}
        onboarding={onboarding}
        title="Coaching info"
        hint={`${set} of ${panel.coachingInfo.length} set`}
        defaultOpen
        onEdit={() => edit("coaching")}
      >
        {editing.coaching && !inDialog ? (
          <CardForm clientId={clientId} card={card} keys={COACHING_KEYS} cancelLabel={onboarding ? "Skip for now" : "Cancel"} onDone={() => done("coaching")}>
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

      {inDialog && editing.member && (
        <CardDialog title="Member info" clientId={clientId} card={card} keys={MEMBER_KEYS} onDone={() => done("member")}>
          {memberFields}
        </CardDialog>
      )}
      {inDialog && editing.coaching && (
        <CardDialog title="Coaching info" clientId={clientId} card={card} keys={COACHING_KEYS} onDone={() => done("coaching")}>
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
function CardDialog({
  title,
  clientId,
  card,
  keys,
  onDone,
  children,
}: {
  title: string;
  clientId: number;
  card: Card;
  keys: CardKey[];
  onDone: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDone]);

  return createPortal(
    <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onDone()}>
      <div className="pb-modal cc-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="cc-dialog-head">
          <span className="ch-label">{title}</span>
          <button type="button" className="cc-dialog-x" onClick={onDone} aria-label="Close">
            ×
          </button>
        </div>
        <CardForm clientId={clientId} card={card} keys={keys} cancelLabel="Cancel" onDone={onDone}>
          {children}
        </CardForm>
      </div>
    </div>,
    document.body
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

// One section's form. The save action writes the whole card, so the other
// section's fields ride along as their saved values rather than blanking.
// The action runs inside a transition so edit mode closes AFTER the save
// resolves; flipping state on click unmounted the form mid-submit before.
function CardForm({
  clientId,
  card,
  keys,
  cancelLabel,
  onDone,
  children,
}: {
  clientId: number;
  card: Card;
  keys: CardKey[];
  cancelLabel: string;
  onDone: () => void;
  children: ReactNode;
}) {
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
        <input className="nc-input" name="birthdate" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} autoFocus={focus === "birthdate"} />
      </InfoRow>
      <InfoRow label="Gender" as="div">
        <GenderPills name="gender" value={gender} onChange={setGender} />
      </InfoRow>
      <Field label="Height" name="height_cm" value={card.height_cm} type="number" suffix="cm" focus={focus} />
      <Field label="Email" name="email" value={card.email} type="email" focus={focus} full />
      <InfoRow label="Phone" as="div">
        <PhoneInput code={code} number={phone} onCode={setCode} onNumber={setPhone} codeName="phone_code" numberName="phone" legacy={legacy} />
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
