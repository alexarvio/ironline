"use client";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { ChevronDownIcon } from "../../components/icons";

// One choice from a short list, as the same menu the add rows use: a field
// that reads its choice, and a list under it. Takes the place of a native
// select wherever the drafts need one, so every list looks the same.
export default function Picker<T extends string>({ value, options, onChange, label, className = "" }: { value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void; label: string; className?: string }) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className={`rd-input rd-picker ${className}`} aria-label={label}>
        <span>{current?.label ?? "—"}</span>
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="pb-menu rd-picker-menu">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} className={o.value === value ? "on" : ""} onSelect={() => onChange(o.value)}>
            {o.label}
            {o.hint && <small>{o.hint}</small>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
