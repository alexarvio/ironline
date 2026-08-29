// Shared inline icon set. Sized via their own width/height so callers don't
// need to pass props — wrapping elements (.feed-nav-icon, .app-tab-icon,
// .row-icon-btn) just center whatever's inside.

export function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11.3 1.7a1.6 1.6 0 0 1 2.3 0l.7.7a1.6 1.6 0 0 1 0 2.3L5.4 13.6l-3.4.8.8-3.4 8.5-8.5-1.3-1.3z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.8 3.2l2.3 2.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2.7 4.3h10.6M6.2 4.3V2.7a.8.8 0 0 1 .8-.8h2a.8.8 0 0 1 .8.8v1.6M6.7 7.4v4.2M9.3 7.4v4.2M3.9 4.3l.6 8.2a1 1 0 0 0 1 .9h5l1-.9.6-8.2"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PinIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 1.5c-2 0-3.5 1.6-3.5 3.6 0 2.3 2.3 4.3 3.5 6.4 1.2-2.1 3.5-4.1 3.5-6.4 0-2-1.5-3.6-3.5-3.6z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
        fill={filled ? "currentColor" : "none"}
      />
      <circle cx="8" cy="5.1" r="1.3" stroke="currentColor" strokeWidth="1.1" fill={filled ? "white" : "none"} />
      <path d="M8 11.5v3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function ReportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4.5 2h6l3 3v9a1.5 1.5 0 0 1-1.5 1.5h-7.5A1.5 1.5 0 0 1 3 14V3.5A1.5 1.5 0 0 1 4.5 2z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M6 10.5h6M6 13h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function ChartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2.3 13.7V2.3M2.3 13.7h11.4"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.3 11.2l2.6-3.4 2.2 1.9 3.3-4.9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FeedIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10.2 1.5 3.6 10.2h4.1L7 16.5l6.6-8.7H9.5l.7-6.3z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.25" y="3.5" width="13.5" height="12.25" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.25 7h13.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.75 1.75v3M12.25 1.75v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function DumbbellIcon() {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="5" width="3" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4.5" y="2.5" width="3" height="11" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7.5" y1="8" x2="16.5" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="16.5" y="2.5" width="3" height="11" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="20.5" y="5" width="3" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ChecklistIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2.7 4.5l1.1 1.1 2-2M2.7 9.5l1.1 1.1 2-2M2.7 14.5l1.1 1.1 2-2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.2 4.5h7.1M8.2 9.5h7.1M8.2 14.5h7.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// Rotates 180deg via the .open modifier class wherever it's used, so a
// single icon serves as both the collapsed and expanded chevron.
export function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 5l4.5 4.5L11.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2.3 8.4 9 2.5l6.7 5.9M4 7.2v7.3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7 15.3v-4.1a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4.1" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2.5 4.8a1.3 1.3 0 0 1 1.3-1.3h10.4a1.3 1.3 0 0 1 1.3 1.3v6.3a1.3 1.3 0 0 1-1.3 1.3H7.3L4 15.2v-2.8H3.8a1.3 1.3 0 0 1-1.3-1.3V4.8z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 9a6 6 0 0 1 12 0c0 3.2 1 5.1 1.8 6.1.4.5.1 1.2-.5 1.2H4.7c-.6 0-.9-.7-.5-1.2C5 14.1 6 12.2 6 9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9.5 19.2a2.6 2.6 0 0 0 5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronLeftIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 12h13.5M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LeafIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 4.6c-.9-1.1-2.3-1.6-3.6-1.3C6.6 3.7 5.5 5.4 5.7 7.2c.3 3.7 3 7.6 6.3 9.8 3.3-2.2 6-6.1 6.3-9.8.2-1.8-.9-3.5-2.7-3.9-1.3-.3-2.7.2-3.6 1.3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 17v3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M15.5 8.5c2.8 0 4.5 2.4 4.5 5.5 0 4-2.7 7.5-5.5 7.5-1 0-1.5-.5-2.5-.5s-1.5.5-2.5.5c-2.8 0-5.5-3.5-5.5-7.5 0-3.1 1.9-5.5 4.7-5.5 1.3 0 2.1.6 3.3.6s1.9-.6 3.5-.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 8.5V6a2.2 2.2 0 0 1 2-2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function GearIcon() {
  // A real cog (trapezoidal teeth), not the ray-burst that reads as a sun —
  // eight teeth around a ring, hollow center for the axle.
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V19a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 17.6a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function PaletteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 2.25a6.75 6.75 0 1 0 0 13.5c.9 0 1.5-.6 1.5-1.35 0-.35-.15-.65-.35-.9-.2-.25-.35-.55-.35-.9 0-.75.6-1.35 1.35-1.35h1.35A3.15 3.15 0 0 0 15.75 8.1c0-3.2-3.02-5.85-6.75-5.85z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="5.7" cy="8.1" r="0.95" fill="currentColor" />
      <circle cx="6.9" cy="5.4" r="0.95" fill="currentColor" />
      <circle cx="10.2" cy="4.8" r="0.95" fill="currentColor" />
    </svg>
  );
}

export function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2.5 6.2a1 1 0 0 1 1-1h1.7l.9-1.5h3.8l.9 1.5H15a1 1 0 0 1 1 1v7.3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V6.2z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
