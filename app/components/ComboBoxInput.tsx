"use client";

import { useEffect, useRef, useState } from "react";

// A themed text input with a visible chevron button that opens a dropdown of
// values already used elsewhere in the system (other clients' metrics,
// saved templates, etc.). The input stays a normal, freely-typeable text
// field — name= is what the surrounding <form> submits — so picking a
// suggestion just fills it in, and typing anything else creates a brand new
// value. "Create a new one" is always the last row in the menu.
export default function ComboBoxInput({
  name,
  options,
  placeholder,
  defaultValue = "",
  required,
}: {
  name: string;
  options: string[];
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = options.filter((o) => !value.trim() || o.toLowerCase().includes(value.trim().toLowerCase()));

  return (
    <div className="combo-box" ref={wrapRef}>
      <div className="combo-box-field">
        <input
          ref={inputRef}
          type="text"
          name={name}
          value={value}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <button
          type="button"
          className="combo-box-chevron"
          aria-label="Show suggestions"
          onClick={() => {
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L5 5L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="combo-box-menu">
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              className="combo-box-option"
              onMouseDown={(e) => {
                e.preventDefault();
                setValue(o);
                setOpen(false);
              }}
            >
              {o}
            </button>
          ))}
          <button
            type="button"
            className="combo-box-option combo-box-create"
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(false);
              inputRef.current?.focus();
            }}
          >
            {value.trim() && !options.some((o) => o.toLowerCase() === value.trim().toLowerCase())
              ? `+ Create "${value.trim()}"`
              : "+ Create a new one"}
          </button>
        </div>
      )}
    </div>
  );
}
