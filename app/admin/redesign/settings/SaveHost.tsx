"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import SaveBar from "./SaveBar";
import { useHoldRefresh } from "../holdRefresh";

// One save bar for the Settings page (23 Oct, Alex: one page of folding sections). Each form that saves on Save puts
// its changes here while it has any (useSaveSlot), under its section's key ("profile", "business") or a part of one
// ("profile:details"); a folded section keeps its changes and its slot. The bar at the page's foot counts them all,
// Cancel puts every one back, and Save saves each through its own action, as each did on its own page, then draws the
// page again once.

type Slot = { count: number; blocked: boolean; problem: string | null; save: () => Promise<boolean | void>; cancel: () => void };
type Host = { put: (key: string, slot: Slot) => void; drop: (key: string) => void };

const HostContext = createContext<Host | null>(null);
const UnsavedContext = createContext<readonly string[]>([]);

/** The page's root (its classes given), what is in it, and the one bar at its foot once something is changed. */
export function SaveHost({ className, children }: { className: string; children: ReactNode }) {
  const router = useRouter();
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [busy, start] = useTransition();
  const [host] = useState<Host>(() => ({
    put: (key, slot) => setSlots((s) => ({ ...s, [key]: slot })),
    drop: (key) =>
      setSlots((s) => {
        if (!(key in s)) return s;
        const rest = { ...s };
        delete rest[key];
        return rest;
      }),
  }));
  const keys = Object.keys(slots);
  const open = Object.values(slots);
  // Changes on the bar, or saving: the page doesn't read itself again meanwhile (RefreshOnReturn).
  useHoldRefresh(open.length > 0 || busy);
  const save = () =>
    start(async () => {
      // Invoicing goes first: a new country in Business details draws Invoicing again (its own defaults come with
      // it), and what was typed there would be gone before it was saved.
      const order = Object.entries(slots).sort(([a], [b]) => Number(b === "invoicing") - Number(a === "invoicing"));
      let ok = true;
      for (const [, slot] of order) {
        try {
          if ((await slot.save()) === false) ok = false;
        } catch {
          ok = false;
        }
      }
      start(() => router.refresh());
      if (ok) toast.success("Saved");
      else toast.error("Couldn't save", { description: "Check your connection and try again." });
    });
  return (
    <HostContext.Provider value={host}>
      <UnsavedContext.Provider value={keys}>
        <div className={className}>
          {children}
          {open.length > 0 && (
            <SaveBar
              count={open.reduce((n, s) => n + s.count, 0)}
              busy={busy}
              onSave={save}
              onCancel={() => open.forEach((s) => s.cancel())}
              problem={open.find((s) => s.problem)?.problem ?? null}
              blocked={open.some((s) => s.blocked)}
            />
          )}
        </div>
      </UnsavedContext.Provider>
    </HostContext.Provider>
  );
}

/** The keys holding unsaved changes ("business", "profile:details"), for the sections' dots. */
export const useUnsaved = () => useContext(UnsavedContext);

/** A form's changes on the page's bar, under its key, while it has any. `save` resolves false (or throws) when it
 *  didn't save; the bar's toast says so. */
export function useSaveSlot(key: string, slot: { dirty: boolean; count: number; blocked?: boolean; problem?: string | null; save: () => Promise<boolean | void>; cancel: () => void }) {
  const host = useContext(HostContext);
  // Save and Cancel read the form as it is at the click, not as it was when it last changed its count.
  const latest = useRef(slot);
  useEffect(() => {
    latest.current = slot;
  });
  const { dirty, count, blocked = false, problem = null } = slot;
  useEffect(() => {
    if (!host) return;
    if (!dirty) host.drop(key);
    else host.put(key, { count, blocked, problem, save: () => latest.current.save(), cancel: () => latest.current.cancel() });
  }, [host, key, dirty, count, blocked, problem]);
  useEffect(() => () => host?.drop(key), [host, key]);
}
