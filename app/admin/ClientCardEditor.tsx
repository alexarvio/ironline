"use client";

import { ReactNode, useState, useTransition } from "react";
import { renameClientAction, saveClientCardAction } from "../lib/actions";
import type { OverviewInfoRow, OverviewPanel } from "../lib/queries";
import PanelSection from "./PanelSection";

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
  "phone",
  "address",
  "coaching_start_date",
  "goal_phase",
  "goal_date",
  "check_in_day",
  "starting_weight_kg",
];
const MEMBER_KEYS: CardKey[] = ["name", "birthdate", "gender", "height_cm", "email", "phone", "address"];
const COACHING_KEYS: CardKey[] = ["coaching_start_date", "goal_date", "goal_phase", "check_in_day", "starting_weight_kg"];

type Which = "member" | "coaching";

export default function ClientCardEditor({
  clientId,
  panel,
  onboarding = false,
}: {
  clientId: number;
  panel: OverviewPanel;
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

  return (
    <>
      <PanelSection title="Member info" hint={`${filled} of ${panel.memberInfo.length} filled`} forceOpen={onboarding}>
        {editing.member ? (
          <CardForm clientId={clientId} card={card} keys={MEMBER_KEYS} cancelLabel={onboarding ? "Skip for now" : "Cancel"} onDone={() => done("member")}>
            {onboarding && (
              // Everything here can be left blank and filled in later — saying
              // so matters, because a coach adding a client mid-conversation
              // rarely has the address to hand and shouldn't feel stuck.
              <p className="ad-onboard-note">New client. Fill in what you know. Anything you skip can be added later.</p>
            )}
            <div className="ad-fields">
              {/* The name saves on its own when the coach leaves the field. It is
                  the one thing on this card that shows elsewhere immediately (the
                  rail, the panel header), and a new client sat as "New client"
                  until Save was found. */}
              <Field
                label="Name"
                name="name"
                value={card.name}
                required
                focus={focus}
                onBlur={(v) => {
                  if (v.trim() && v.trim() !== card.name) startRename(() => renameClientAction(clientId, v));
                }}
              />
              <Field label="Birthdate" name="birthdate" value={card.birthdate} type="date" focus={focus} />
              <Field label="Gender" name="gender" value={card.gender} focus={focus} />
              <Field label="Height" name="height_cm" value={card.height_cm} type="number" suffix="cm" focus={focus} />
              <Field label="Email" name="email" value={card.email} type="email" focus={focus} />
              <Field label="Phone" name="phone" value={card.phone} type="tel" focus={focus} />
              <Field label="Address" name="address" value={card.address} focus={focus} />
            </div>
          </CardForm>
        ) : (
          <>
            <InfoRows rows={panel.memberInfo} onAdd={(field) => edit("member", field)} />
            <button type="button" className="ad-sect-edit" onClick={() => edit("member")}>
              Edit details
            </button>
          </>
        )}
      </PanelSection>

      <PanelSection title="Coaching info" hint={`${set} of ${panel.coachingInfo.length} set`} defaultOpen forceOpen={onboarding}>
        {editing.coaching ? (
          <CardForm clientId={clientId} card={card} keys={COACHING_KEYS} cancelLabel={onboarding ? "Skip for now" : "Cancel"} onDone={() => done("coaching")}>
            <div className="ad-fields">
              <Field label="Start date" name="coaching_start_date" value={card.coaching_start_date} type="date" focus={focus} />
              <Field label="Goal date" name="goal_date" value={card.goal_date} type="date" focus={focus} />
              {card.goal_phase_from_plan ? (
                // Driven by the Plan tab while a nutrition phase is running:
                // editing it here would be overwritten on the next render, so
                // the card says where it comes from instead of offering a box.
                <div className="ad-field">
                  <span className="ad-field-label">Goal / phase</span>
                  <span className="ad-field-static">
                    {card.goal_phase_from_plan}
                    <em>from the Plan tab</em>
                  </span>
                  <input type="hidden" name="goal_phase" value={card.goal_phase} />
                </div>
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
          </CardForm>
        ) : (
          <>
            <InfoRows rows={panel.coachingInfo} onAdd={(field) => edit("coaching", field)} />
            <button type="button" className="ad-sect-edit" onClick={() => edit("coaching")}>
              Edit plan
            </button>
          </>
        )}
      </PanelSection>
    </>
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
}) {
  return (
    <label className="ad-field">
      <span className="ad-field-label">{label}</span>
      <span className={suffix ? "ad-field-input has-suffix" : "ad-field-input"}>
        <input
          name={name}
          type={type}
          step={step}
          defaultValue={value}
          placeholder={placeholder}
          required={required}
          autoFocus={focus === name}
          onBlur={onBlur ? (e) => onBlur(e.currentTarget.value) : undefined}
        />
        {suffix && <em>{suffix}</em>}
      </span>
    </label>
  );
}
