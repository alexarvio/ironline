import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

// Sentry settings shared by the server (instrumentation.ts) and the browser
// (instrumentation-client.ts). Errors only: no performance tracing, no
// session replay. The app holds health data and body photos, so nothing the
// client typed or uploaded leaves with an error, and neither do cookies,
// headers, IPs or query strings. What Sentry gets is the error, the stack
// and the page it happened on.

// A DSN only says where to send errors; it is safe in the browser bundle.
// NEXT_PUBLIC_SENTRY_DSN overrides it (e.g. a separate project for staging).
const DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  "https://132d1ea60874d1b5821e3e7f8a6e40f7@o4512077533544448.ingest.us.sentry.io/4512078723874816";

const stripQuery = (url: string) => url.split("?")[0];

function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
    if (event.request.url) event.request.url = stripQuery(event.request.url);
  }
  // Keep at most an id; never a name, email or IP.
  event.user = event.user?.id ? { id: event.user.id } : undefined;
  return event;
}

function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  // Console lines and typed input can carry a client's own data.
  if (crumb.category === "console" || crumb.category === "ui.input") return null;
  if (crumb.data) {
    for (const key of ["url", "from", "to"]) {
      const v = crumb.data[key];
      if (typeof v === "string") crumb.data[key] = stripQuery(v);
    }
  }
  return crumb;
}

export const sentryOptions = {
  dsn: DSN,
  environment: process.env.NODE_ENV,
  // Localhost errors show in the terminal already; only production reports.
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
};
