"use client";

// The opening's screen, admin and client app alike (7 Nov, Alex: "while it's loading, just the logo. And once it's
// loaded, just the name appears from behind and boom… everything centered"; then "have the same for the app"): the
// paper with the star alone in the middle; `revealing`, the NORCOACH word shoots out from behind the star, the two
// staying centred as one, and the paper fades off what is under it. Styles: "Opening" at the end of globals.css.

import { NorCoachMark, NorCoachWordmark } from "./NorCoachLogo";

type Props = {
  revealing?: boolean;
  /** The paper alone (the client app coming back from another screen: the opening has played). */
  plain?: boolean;
  className?: string;
  /** The paper has gone (its fade ended, or the 8s safety did). */
  onEnd?: () => void;
};

export default function OpeningLogo({ revealing = false, plain = false, className, onEnd }: Props) {
  return (
    <div
      className={`nc-boot${className ? " " + className : ""}${revealing ? " revealing" : ""}`}
      aria-hidden="true"
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && (e.animationName === "nc-boot-off" || e.animationName === "nc-open-safe")) onEnd?.();
      }}
    >
      {!plain && (
        <div className="nc-boot-logo">
          <NorCoachMark className="nc-boot-star" />
          <span className="nc-boot-wordwrap">
            <NorCoachWordmark className="nc-boot-word" />
          </span>
        </div>
      )}
    </div>
  );
}

/** The least time from opening before the word comes out, so the star alone is seen (7 Nov, Alex; doubled: "make it
 *  last double the amount of time"). */
export const OPENING_HOLD_MS = 1800;
