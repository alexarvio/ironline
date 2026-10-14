"use client";

import { useCallback, useEffect, useState } from "react";

// The Library's card grid, as the coach left it (14 Oct): which groups are
// open, the filter chip, the search (settled 150ms after the last key), and
// the View menu's settings. The open groups and the settings live in
// localStorage, per browser; the filter and search start fresh each visit.

export type LibraryFilter = "all" | "nodemo" | "variations" | "substitutes";
export type LibrarySettings = { density: "comfortable" | "compact"; thumbs: "portrait" | "landscape"; cues: boolean };

const OPEN_KEY = "norcoach:lib-open";
const VIEW_KEY = "norcoach:lib-view";
const DEFAULT_SETTINGS: LibrarySettings = { density: "comfortable", thumbs: "portrait", cues: true };

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

export function useLibraryView(firstGroup: string | null) {
  // Open groups: the first one, until the coach has folded or opened any.
  const [open, setOpenState] = useState<string[]>(() => (firstGroup ? [firstGroup] : []));
  const [settings, setSettingsState] = useState<LibrarySettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      const saved = read<{ open?: string[] } | null>(OPEN_KEY, null);
      if (saved?.open) setOpenState(saved.open);
      setSettingsState(read(VIEW_KEY, DEFAULT_SETTINGS));
      setLoaded(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const setOpen = useCallback((next: string[] | ((o: string[]) => string[])) => {
    setOpenState((o) => {
      const v = typeof next === "function" ? next(o) : next;
      write(OPEN_KEY, { open: v });
      return v;
    });
  }, []);
  const toggle = useCallback((slug: string) => setOpen((o) => (o.includes(slug) ? o.filter((x) => x !== slug) : [...o, slug])), [setOpen]);
  const setSettings = useCallback((patch: Partial<LibrarySettings>) => {
    setSettingsState((s) => {
      const v = { ...s, ...patch };
      write(VIEW_KEY, v);
      return v;
    });
  }, []);

  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [q, setQ] = useState("");
  const [needle, setNeedle] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setNeedle(q.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [q]);

  return { open, toggle, setOpen, settings, setSettings, loaded, filter, setFilter, q, setQ, needle };
}
