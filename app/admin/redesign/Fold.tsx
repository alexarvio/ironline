import { ChevronRightIcon } from "../../components/icons";

// A row that opens: its chevron right after its title, pointing right, down once open (21 Oct, Alex:
// as Training's sessions, the same on every log). Styles: `.rd-fold` in training/draft.css.
export function Fold({ open }: { open: boolean }) {
  return (
    <span className={`rd-fold${open ? " open" : ""}`} aria-hidden="true">
      <ChevronRightIcon />
    </span>
  );
}
