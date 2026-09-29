"use client";

import { useState } from "react";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/basics";
import { ChevronDownIcon, PlusIcon } from "../../components/icons";

// The switcher under a tab's title (Training, Nutrition, Measurements): the
// phases or programmes of this client, sorted by where they stand. The
// toggle on top picks Live, Scheduled, Draft or Past; it opens on the one
// the phase on screen is in, and a kind with nothing in it can't be picked.

const STATES = [
  { key: "live", label: "Live" },
  { key: "scheduled", label: "Scheduled" },
  { key: "draft", label: "Draft" },
  { key: "past", label: "Past" },
] as const;
type State = (typeof STATES)[number]["key"];
const stateOf = (s: string): State => (s === "live" || s === "scheduled" || s === "past" ? s : "draft");

export type SwitcherItem = { id: number; name: string; weeks: number; state: string };

export default function PhaseSwitcher({
  name,
  currentId,
  items,
  hrefFor,
  label,
  newLabel,
  onNew,
}: {
  /** The one on screen: its name is the button. */
  name: string;
  currentId: number;
  items: SwitcherItem[];
  hrefFor: (id: number) => string;
  /** "Switch phase", for screen readers. */
  label: string;
  newLabel: string;
  onNew: () => void;
}) {
  const current = stateOf(items.find((p) => p.id === currentId)?.state ?? "live");
  const [picked, setPicked] = useState<State | null>(null);
  const shown = picked ?? current;
  const count = (s: State) => items.filter((p) => stateOf(p.state) === s).length;
  const list = items.filter((p) => stateOf(p.state) === shown);
  return (
    <DropdownMenu modal={false} onOpenChange={(open) => open && setPicked(null)}>
      <DropdownMenuTrigger className="rd-switch rd-keep" aria-label={label}>
        {name}
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="pb-menu rd-switch-menu">
        <ToggleGroup type="single" value={shown} onValueChange={(v) => v && setPicked(v as State)} aria-label="Which to list" className="rd-switch-states">
          {STATES.map((s) => (
            <ToggleGroupItem key={s.key} value={s.key} disabled={count(s.key) === 0}>
              {s.label}
              {count(s.key) > 0 && <span className="rd-switch-count">{count(s.key)}</span>}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {list.map((p) => (
          <DropdownMenuItem key={p.id} asChild>
            <Link href={hrefFor(p.id)} scroll={false} className={p.id === currentId ? "on" : ""}>
              <span className="rd-switch-name">{p.name}</span>
              <small>
                {p.weeks} {p.weeks === 1 ? "week" : "weeks"}
              </small>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onNew}>
          <PlusIcon /> {newLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
