// Runs in the browser before the app becomes interactive: reports errors from
// the admin and the client app to Sentry. See app/lib/sentryOptions.ts for
// what is (and is not) sent.
import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./app/lib/sentryOptions";

Sentry.init(sentryOptions);

// Navigation breadcrumbs, so an error shows the screens that led to it.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
