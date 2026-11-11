"use client";

import { useEffect, useState } from "react";
import { useTabActive } from "./CheckInContext";
import { ChevronDownIcon } from "../components/icons";
import { Bars } from "./Bars";

export type LastWeekDay = {
  date: string;
  label: string;
  type: string;
  note: string;
  kcal: number;
  delta: { text: string; tone: string };
  meals: { label: string; foods: { name: string; amount: string; kcal: number }[] }[];
};

// Nutrition's Last 7 days (10 Nov, Alex: "click on it and see the stuff i ate"): a day with food folds open on what was
// eaten, meal by meal, flat on the page, one day at a time; a figure typed with no food has nothing more, so no chevron.
export default function LastWeekDays({ days }: { days: LastWeekDay[] }) {
  const [open, setOpen] = useState<string | null>(null);
  // Leaving Nutrition folds it back (11 Nov, Alex: "I go to do a session in the gym I come back and it's still opened").
  const showing = useTabActive();
  useEffect(() => {
    if (!showing) setOpen(null);
  }, [showing]);
  return (
    <>
      {days.map((d) => {
        const opens = d.meals.length > 0;
        const isOpen = open === d.date;
        const figures = (
          <>
            <span>
              <span className="nd-day-date">{d.label}</span>
              <span className="nd-day-type">{d.type}</span>
            </span>
            <span className="nd-day-note">
              {opens && (
                <span className={`ci-day-chev nd-day-chev${isOpen ? " open" : ""}`} aria-hidden="true">
                  <ChevronDownIcon />
                </span>
              )}
              {d.note}
            </span>
            <span className="nd-day-kcal">{d.kcal.toLocaleString("en-US")}</span>
            <span className={`nd-day-delta ${d.delta.tone}`}>{d.delta.text}</span>
          </>
        );
        return (
          <div key={d.date} className="nd-day-wrap">
            {opens ? (
              <button type="button" className="nd-day nd-day-btn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : d.date)}>
                {figures}
              </button>
            ) : (
              <div className="nd-day">{figures}</div>
            )}
            {opens && (
              <div className={`so-fold${isOpen ? " open" : ""}`} aria-hidden={!isOpen} inert={!isOpen}>
                <div className="so-fold-in">
                  <div className="nd-day-foods">
                    {d.meals.map((m, i) => (
                      <div key={i} className="nd-day-meal">
                        <div className="nd-day-meal-name">{m.label}</div>
                        {m.foods.map((f, j) => (
                          <div key={j} className="nd-day-food">
                            <span className="nd-day-food-name">{f.name}</span>
                            <span className="nd-day-food-facts">
                              <Bars parts={[f.amount, `${f.kcal.toLocaleString("en-US")} kcal`]} />
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
