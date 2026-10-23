"use client";

import { useState } from "react";
import { DEFAULT_DIAL, DIAL_CODES } from "../../InfoRow";
import { saveCoachContactAction } from "../../../lib/actions";
import Picker from "../Picker";
import { useSaveSlot } from "../settings/SaveHost";

// Your profile → Your details (26 Sep; on the admin rules 22 Oct): the account basics any profile has, the sign-in
// email, a phone and an address, each part's small caps label over one hairline card, fields on clean lines. Only the
// coach (and the owner) sees these; the public profile is the other tab. Changes go on Settings' one bar (23 Oct),
// and wait there while Profile is folded.

export type ProfileDetailsData = {
  email: string;
  phoneCode: string;
  phone: string;
  address: string;
  postcode: string;
  city: string;
  countryCode: string;
};

const NONE = "";

export default function ProfileDetails({ coachId, data, countries }: { coachId: number; data: ProfileDetailsData; countries: { code: string; name: string }[] }) {
  const [d, setD] = useState({ ...data, phoneCode: data.phoneCode || DEFAULT_DIAL });
  const [saved, setSaved] = useState(JSON.stringify({ ...data, phoneCode: data.phoneCode || DEFAULT_DIAL }));
  const dirty = JSON.stringify(d) !== saved;
  const was = JSON.parse(saved) as typeof d;
  const changed = (Object.keys(d) as (keyof typeof d)[]).filter((k) => d[k] !== was[k]).length;
  const set = <K extends keyof ProfileDetailsData>(k: K) => (v: ProfileDetailsData[K]) => setD((x) => ({ ...x, [k]: v }));
  const save = async () => {
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
    return res.ok;
  };
  // A part of the Profile section: its changes on the page's bar, its dot on Profile's title.
  useSaveSlot("profile:details", { dirty, count: changed, save, cancel: () => setD(JSON.parse(saved)) });
  // The dial codes as the floating list (design rules 6); a code saved before that isn't on it stays, first.
  const dials = [...(DIAL_CODES.some(([, c]) => c === d.phoneCode) ? [] : [{ value: d.phoneCode, label: d.phoneCode }]), ...DIAL_CODES.map(([iso, c]) => ({ value: c, label: `${iso} ${c}` }))];

  return (
    <div className="rpf-details">
      <section className="rls-section rst-sub">
        <div className="trn-weekhead">
          <div>
            <h3>Account</h3>
          </div>
        </div>
        <div className="rls-card rst-card">
          <div className="rst-grid">
            <div className="rst-field">
              <span className="dlh-label">Email</span>
              <span className="rst-static">{d.email}</span>
            </div>
            <div className="rst-field">
              <span className="dlh-label">Phone</span>
              <span className="rpf-phone">
                <Picker value={d.phoneCode} onChange={set("phoneCode")} label="Country dial code" className="rst-pick rpf-dial" options={dials} />
                <input className="dlh-line" type="tel" inputMode="tel" value={d.phone} onChange={(e) => set("phone")(e.target.value)} placeholder="6 12345678" aria-label="Phone number" autoComplete="off" />
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="rls-section rst-sub">
        <div className="trn-weekhead">
          <div>
            <h3>Address</h3>
          </div>
        </div>
        <div className="rls-card rst-card">
          <div className="rst-grid rpf-grid3">
            <label className="rst-field wide">
              <span className="dlh-label">Street and number</span>
              <input className="dlh-line" value={d.address} onChange={(e) => set("address")(e.target.value)} autoComplete="street-address" placeholder="Hämeenkatu 12 B 4" maxLength={160} />
            </label>
            <label className="rst-field">
              <span className="dlh-label">Postcode</span>
              <input className="dlh-line" value={d.postcode} onChange={(e) => set("postcode")(e.target.value)} autoComplete="postal-code" placeholder="33100" maxLength={20} />
            </label>
            <label className="rst-field">
              <span className="dlh-label">City</span>
              <input className="dlh-line" value={d.city} onChange={(e) => set("city")(e.target.value)} autoComplete="address-level2" placeholder="Tampere" maxLength={80} />
            </label>
            <div className="rst-field">
              <span className="dlh-label">Country</span>
              <Picker
                value={d.countryCode || NONE}
                onChange={set("countryCode")}
                label="Country"
                className={`rst-pick${d.countryCode ? "" : " empty"}`}
                options={[...(d.countryCode ? [] : [{ value: NONE, label: "Choose" }]), ...countries.map((c) => ({ value: c.code, label: c.name }))]}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
