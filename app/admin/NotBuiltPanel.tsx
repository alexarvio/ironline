export default function NotBuiltPanel({ what }: { what: string }) {
  return (
    <div className="not-built-panel">
      <p className="empty-note">
        {what} logging isn&rsquo;t built in the client app yet, so there&rsquo;s
        nothing here to show. Once a client can enter {what.toLowerCase()} data on
        their side, it&rsquo;ll appear in this tab automatically — same shared
        database as Training, no separate wiring needed.
      </p>
    </div>
  );
}
