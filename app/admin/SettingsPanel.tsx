import { CURRENCIES, getBranding, listPackages } from "../lib/queries";
import { saveCurrencyAction } from "../lib/actions";
import BrandingPanel from "./BrandingPanel";
import PackagesEditor from "./PackagesEditor";

// Coach-level settings: things about the business rather than any one
// client. The packages the coach sells, and Branding (name, logo, colour).
export default function SettingsPanel() {
  const branding = getBranding();
  const symbol = CURRENCIES.find((c) => c.code === branding.currency)?.symbol ?? "";
  const packages = listPackages().map((k) => ({
    id: k.id,
    name: k.name,
    price: k.price,
    period: k.period ?? "month",
    includes: k.includes,
  }));

  return (
    <div className="br br-wide">
      <h1 style={{ margin: 0 }}>Settings</h1>

      <section className="br-card">
        <div className="ms-head">
          <h3 className="ad-microlabel">Packages</h3>
          {/* One currency for every price; changing it relabels them all. */}
          <form action={saveCurrencyAction} className="cid">
            <span className="cid-label">Currency</span>
            <select
              name="currency"
              defaultValue={branding.currency}
              className="cid-select"
              aria-label="Currency for prices"
              // Server-component form: the select submits itself via the
              // tiny inline handler below, no client bundle needed.
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <button type="submit" className="ad-btn-secondary">
              Save
            </button>
          </form>
        </div>
        <p className="br-note">
          What you sell, with a price and what each includes. Pick a client&rsquo;s package on their card; they see
          it in their app, along with the other packages you offer.
        </p>
        <PackagesEditor packages={packages} currencySymbol={symbol} />
      </section>

      <BrandingPanel embedded />
    </div>
  );
}
