// The identity strip above the section tabs. Deliberately thin: name, age,
// how long they've been coached, and a way to message them.
//
// The plan read-outs and stat pills that used to sit here moved into the
// right-hand panel's snapshot. They were competing with the tabs for the
// coach's eye at the exact moment they'd chosen what to work on.
export default function ClientHeader({
  name,
  age,
  since,
}: {
  name: string;
  age: number | null;
  since: string | null;
}) {
  return (
    <header className="ad-client-header">
      <div className="ad-client-ident">
        <h1 className="ad-client-title">
          {name}
          {age != null && <span className="ad-client-age">{age}</span>}
        </h1>
        {since && <div className="ad-client-since">{since}</div>}
      </div>
      <button type="button" className="ad-message-btn">
        Message
      </button>
    </header>
  );
}
