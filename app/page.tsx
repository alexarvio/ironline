import Link from "next/link";

export default function Home() {
  return (
    <div className="shell">
      <div className="top-nav">
        <span className="brand">Ironline</span>
      </div>
      <h1>Core loop prototype</h1>
      <p className="subtitle">
        Build a week as the coach, deploy it, then switch to the client view and log
        sets against it — watch it show up back on the coach side off the same
        database.
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <Link className="btn" href="/admin">
          Open coach workstation
        </Link>
        <Link className="btn secondary" href="/client">
          Open client app
        </Link>
      </div>
    </div>
  );
}
