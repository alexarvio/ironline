"use client";

import { useState, useTransition } from "react";
import { renameClientAction, saveClientCardAction } from "../lib/actions";
import type { OverviewPanel } from "../lib/queries";

// Member info and Coaching info — the client card.
//
// Most of this is filled once at onboarding and then never touched, which is
// exactly why it has to be correctable: an email changes, a phase ends, a
// check-in day moves. Read mode is the design's label/value rows; Edit turns
// the same rows into fields in place, so the coach never leaves the panel or
// hunts for a settings screen.
//
// Only what a coach actually authors is editable. Plan, current week and
// current weight are derived — from the live programme and the client's own
// logged weight — so they stay read-only rows rather than becoming a second,
// stale copy of the truth.
export default function ClientCardEditor({
  clientId,
  panel,
  onboarding = false,
}: {
  clientId: number;
  panel: OverviewPanel;
  /** Straight after the client was created. The card opens already in edit
      mode with a line saying why — onboarding is not a separate wizard, it is
      this same card being filled in for the first time. A second form for the
      same eleven fields would be a second place for them to drift. */
  onboarding?: boolean;
}) {
  const [editing, setEditing] = useState(onboarding);
  const [saving, startSaving] = useTransition();
  const card = panel.card;

  if (!editing) {
    return (
      <>
        <section className="ad-panel-section">
          <div className="ad-panel-heading-row">
            <h3 className="ad-panel-heading">Member info</h3>
            <button type="button" className="ad-panel-edit" onClick={() => setEditing(true)}>
              Edit
            </button>
          </div>
          <dl className="ad-facts">
            {panel.memberInfo.map((f) => (
              <div key={f.label} className="ad-fact">
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="ad-panel-section">
          <h3 className="ad-panel-heading">Coaching info</h3>
          <dl className="ad-facts">
            {panel.coachingInfo.map((f) => (
              <div key={f.label} className="ad-fact">
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </>
    );
  }

  return (
    // One form across both blocks: the coach opened "edit the client", not
    // "edit member info", and two Save buttons would make correcting an email
    // and a goal date two separate trips.
    // The action is called inside a transition rather than handed straight to
    // `action`, so edit mode closes AFTER the save resolves. Flipping the
    // state in the Save button's onClick unmounted the form mid-submit and
    // the post never left the page.
    <form
      action={(fd) =>
        startSaving(async () => {
          await saveClientCardAction(fd);
          setEditing(false);
        })
      }
      className="ad-card-form"
    >
      <input type="hidden" name="clientId" value={clientId} />

      {onboarding && (
        // Everything here can be left blank and filled in later — saying so
        // matters, because a coach adding a client mid-conversation rarely has
        // the address to hand and shouldn't feel stuck.
        <p className="ad-onboard-note">
          New client. Fill in what you know. Anything you skip can be added later from Edit.
        </p>
      )}

      <section className="ad-panel-section">
        <div className="ad-panel-heading-row">
          <h3 className="ad-panel-heading">Member info</h3>
          <button type="button" className="ad-panel-edit" onClick={() => setEditing(false)}>
            {onboarding ? "Skip for now" : "Cancel"}
          </button>
        </div>
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
            onBlur={(v) => {
              if (v.trim() && v.trim() !== card.name) startSaving(() => renameClientAction(clientId, v));
            }}
          />
          <Field label="Birthdate" name="birthdate" value={card.birthdate} type="date" />
          <Field label="Gender" name="gender" value={card.gender} placeholder="-" />
          <Field label="Height" name="height_cm" value={card.height_cm} type="number" suffix="cm" />
          <Field label="Email" name="email" value={card.email} type="email" placeholder="-" />
          <Field label="Phone" name="phone" value={card.phone} type="tel" placeholder="-" />
          <Field label="Address" name="address" value={card.address} placeholder="-" />
        </div>
      </section>

      <section className="ad-panel-section">
        <h3 className="ad-panel-heading">Coaching info</h3>
        <div className="ad-fields">
          <Field label="Start date" name="coaching_start_date" value={card.coaching_start_date} type="date" />
          <Field label="Goal / phase" name="goal_phase" value={card.goal_phase} placeholder="-" />
          <Field label="Goal date" name="goal_date" value={card.goal_date} type="date" />
          <Field label="Check-in day" name="check_in_day" value={card.check_in_day} placeholder="Monday" />
          <Field
            label="Starting weight"
            name="starting_weight_kg"
            value={card.starting_weight_kg}
            type="number"
            step="0.1"
            suffix="kg"
          />
        </div>
        {/* Named, not hidden: a coach looking for "current week" here should
            find out where it comes from rather than assume it's missing. */}
        <p className="ad-field-note">
          Plan, current week and current weight follow the live programme and the client&rsquo;s own
          check-ins. They can&rsquo;t be typed here.
        </p>
      </section>

      <div className="ad-card-form-foot">
        <button type="button" className="ad-btn-secondary" onClick={() => setEditing(false)}>
          {onboarding ? "Skip for now" : "Cancel"}
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
          onBlur={onBlur ? (e) => onBlur(e.currentTarget.value) : undefined}
        />
        {suffix && <em>{suffix}</em>}
      </span>
    </label>
  );
}
