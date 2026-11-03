// The group a needs-you task sits under (3 Nov, Alex: option C of docs/boards/needs-rows-mockup.html): the Feed's and
// the Phases screen's Needs you, and Ending soon, each split under small-caps heads with the category's icon, name and
// count. Plain data, so the server's readers and the screens share it. The tracks run Lifestyle, Training, Nutrition.

export type NeedCat = "messages" | "lifestyle" | "training" | "nutrition" | "meetings" | "account" | "plan";

/** The groups' order down the page. */
export const NEED_CATS: NeedCat[] = ["messages", "lifestyle", "training", "nutrition", "meetings", "account", "plan"];

/** A link's group by the tab it opens: a check-in or a shape update Lifestyle, a session Training, a food day Nutrition,
    a call Meetings; anything else (the chat) Messages. */
export function needCatOfHref(href: string): NeedCat {
  const tab = /\/admin\/redesign\/([a-z]+)/.exec(href)?.[1] ?? "";
  if (tab === "training") return "training";
  if (tab === "nutrition") return "nutrition";
  if (tab === "measurements" || tab === "pictures") return "lifestyle";
  if (tab === "meetings") return "meetings";
  return "messages";
}
