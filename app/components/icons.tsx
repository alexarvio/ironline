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
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2.5 9.2v1.6M5.2 7.2v5.6M14.8 7.2v5.6M17.5 9.2v1.6M5.2 10h9.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

export function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 3.6v2M12 18.4v2M20.4 12h-2M5.6 12h-2M17.6 6.4l-1.4 1.4M7.8 16.2l-1.4 1.4M17.6 17.6l-1.4-1.4M7.8 7.8 6.4 6.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
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
