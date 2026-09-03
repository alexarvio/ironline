import { listPackages } from "../lib/queries";
import BrandingPanel from "./BrandingPanel";
import PackagesEditor from "./PackagesEditor";

// Coach-level settings: things about the business rather than any one
// client. Branding (name, logo, colour) and the packages the coach sells.
export default function SettingsPanel() {
  const packages = listPackages().map((k) => ({ id: k.id, name: k.name, price: k.price, includes: k.includes }));
  return (
    <div className="br">
      <h1 style={{ margin: 0 }}>Settings</h1>

      <section className="br-card">
        <h3 className="ad-microlabel">Packages</h3>
        <p className="br-note">
          What you sell, with a price and what each includes. Pick a client&rsquo;s package on their card; they see it
          in their app, along with the other packages you offer.
        </p>
        <PackagesEditor packages={packages} />
      </section>

      <BrandingPanel embedded />
    </div>
  );
}
