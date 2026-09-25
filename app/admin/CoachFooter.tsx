"use client";

import Link from "next/link";
import { logoutAction } from "../lib/auth-actions";
import { GearIcon } from "../components/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";

// The coach, at the foot of the rail, with the gear that opens their account
// menu: profile, the redesign preview, sign out.
//
// The menu is shadcn's Dropdown Menu (components/ui): it opens above the
// gear, closes on Escape or a click outside, takes the arrow keys, and puts
// focus back on the gear when it closes.
export default function CoachFooter({ name, photoPath, redesignHref }: { name: string; photoPath: string | null; redesignHref: string }) {
  return (
    <div className="ad-rail-coach">
      <span className="ad-rail-coach-avatar" aria-hidden="true">
        {photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
          <img src={photoPath} alt="" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </span>
      <div className="ad-rail-coach-text">
        <div className="ad-rail-coach-name">{name}</div>
        <div className="ad-rail-coach-role">Coach</div>
      </div>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className="ad-rail-gear" aria-label="Account">
          <GearIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" sideOffset={14} className="ad-rail-menu">
          <DropdownMenuItem asChild>
            <Link href="/admin/profile">Your profile</Link>
          </DropdownMenuItem>
          {/* The redesign drafts, read-only, for looking at the new feel. Goes when a draft becomes the tab. */}
          <DropdownMenuItem asChild>
            <Link href={redesignHref}>Redesign preview</Link>
          </DropdownMenuItem>
          <form action={logoutAction}>
            {/* Selecting an item closes the menu, which would take the button
                out of the page before its form could submit. Kept open, the
                sign-out navigates away instead. */}
            <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
              <button type="submit">Sign out</button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
