"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/basics";
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/form";
import { DEFAULT_DIAL, PhoneInput } from "../../InfoRow";
import { saveCoachContactAction } from "../../../lib/actions";

// Your profile → Your details (26 Sep): the account basics any profile has,
// the sign-in email, a phone and an address. Only the coach (and the owner)
// sees these; the public profile is the other tab.

export type ProfileDetailsData = {
  email: string;
  phoneCode: string;
  phone: string;
  address: string;
  postcode: string;
  city: string;
  countryCode: string;
};

export default function ProfileDetails({ coachId, data, countries }: { coachId: number; data: ProfileDetailsData; countries: { code: string; name: string }[] }) {
  const [d, setD] = useState({ ...data, phoneCode: data.phoneCode || DEFAULT_DIAL });
  const [saved, setSaved] = useState(JSON.stringify({ ...data, phoneCode: data.phoneCode || DEFAULT_DIAL }));
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(d) !== saved;
  const was = JSON.parse(saved) as typeof d;
  const changed = (Object.keys(d) as (keyof typeof d)[]).filter((k) => d[k] !== was[k]).length;
  const set = <K extends keyof ProfileDetailsData>(k: K) => (v: ProfileDetailsData[K]) => setD((x) => ({ ...x, [k]: v }));
  const save = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("coachId", String(coachId));
      fd.set("phone_code", d.phoneCode);
      fd.set("phone", d.phone);
      fd.set("address", d.address);
      fd.set("postcode", d.postcode);
      fd.set("city", d.city);
      fd.set("country_code", d.countryCode);
      const res = await saveCoachContactAction(fd);
      if (res.ok) setSaved(JSON.stringify(d));
    });

  return (
    <div className="rpf-details">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="rpf-fields">
          <div className="rpf-field">
            <Label htmlFor="pd-email">Email</Label>
            <Input id="pd-email" value={d.email} readOnly className="rpf-readonly" />
            <span className="rpf-hint">The email you sign in with.</span>
          </div>
          <div className="rpf-field">
            <Label>Phone</Label>
            <PhoneInput code={d.phoneCode} number={d.phone} onCode={set("phoneCode")} onNumber={set("phone")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
          <CardDescription>Yours, not the business on your invoices (that is in Settings)</CardDescription>
        </CardHeader>
        <CardContent className="rpf-fields">
          <div className="rpf-field">
            <Label htmlFor="pd-address">Street and number</Label>
            <Input id="pd-address" value={d.address} onChange={(e) => set("address")(e.target.value)} autoComplete="street-address" placeholder="Hämeenkatu 12 B 4" maxLength={160} />
          </div>
          <div className="rpf-grid3">
            <div className="rpf-field">
              <Label htmlFor="pd-postcode">Postcode</Label>
              <Input id="pd-postcode" value={d.postcode} onChange={(e) => set("postcode")(e.target.value)} autoComplete="postal-code" placeholder="33100" maxLength={20} />
            </div>
            <div className="rpf-field">
              <Label htmlFor="pd-city">City</Label>
              <Input id="pd-city" value={d.city} onChange={(e) => set("city")(e.target.value)} autoComplete="address-level2" placeholder="Tampere" maxLength={80} />
            </div>
            <div className="rpf-field">
              <Label>Country</Label>
              <Select value={d.countryCode || undefined} onValueChange={set("countryCode")}>
                <SelectTrigger aria-label="Country">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent className="rpf-select-menu">
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Changes: the app's one blue bar (30 Sep); nothing when all is saved. */}
      {dirty && (
        <div className="rd-pending rd-pending-sticky" role="region" aria-label="Unsaved changes">
          <span className="rd-pending-count">{changed || 1}</span>
          <span className="rd-pending-text">{changed === 1 ? "change" : "changes"} to your details · only you and the app see them</span>
          <button type="button" className="rd-pending-ghost" onClick={() => setD(JSON.parse(saved))} disabled={pending}>
            Discard
          </button>
          <button type="button" className="rd-pending-apply" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
