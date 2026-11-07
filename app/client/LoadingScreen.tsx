"use client";

import { OpeningScreen, openingPlayed } from "./OpeningSplash";

/** loading.tsx's screen: the opening's paper and star on a page load; coming back from another screen of the app, the
 *  paper alone, as the opening has played. */
export default function LoadingScreen() {
  return <OpeningScreen plain={openingPlayed()} />;
}
