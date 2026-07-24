/**
 * One accessible single-choice group, shared by the `mcq` and `identify`
 * renderers (they differ only in what an option *looks* like).
 *
 * It follows the WAI-ARIA radiogroup pattern: one tab stop for the whole group,
 * arrows move between options, selection follows focus, Home/End jump to the
 * ends. Number keys 1–9 select directly, which is how anyone answering a quiz
 * with a keyboard actually wants to answer it.
 */
import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface RadioProps {
  /** The runner wraps questions in a `<form>`; options must not submit it. */
  type: "button";
  role: "radio";
  "aria-checked": boolean;
  tabIndex: number;
  disabled?: boolean;
  onClick: () => void;
  ref: (el: HTMLButtonElement | null) => void;
}

export function RadioGroup({
  ariaLabel,
  count,
  value,
  onChange,
  disabled,
  className,
  renderOption,
}: {
  ariaLabel: string;
  count: number;
  /** Selected index, or null when the learner hasn't chosen yet. */
  value: number | null;
  onChange: (index: number) => void;
  /** Locked once the answer is graded — the verdict must stay reproducible. */
  disabled?: boolean;
  className?: string;
  renderOption: (index: number, radioProps: RadioProps) => ReactNode;
}) {
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (to: number) => {
    const i = ((to % count) + count) % count;
    onChange(i);
    items.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const from = value ?? 0;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        return move(from + 1);
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        return move(from - 1);
      case "Home":
        e.preventDefault();
        return move(0);
      case "End":
        e.preventDefault();
        return move(count - 1);
      default: {
        const n = Number.parseInt(e.key, 10);
        if (Number.isInteger(n) && n >= 1 && n <= Math.min(count, 9)) {
          e.preventDefault();
          move(n - 1);
        }
      }
    }
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} onKeyDown={onKeyDown} className={className}>
      {Array.from({ length: count }, (_, i) =>
        renderOption(i, {
          type: "button",
          role: "radio",
          "aria-checked": value === i,
          // Roving tabindex: the group is one tab stop, arrows do the rest.
          tabIndex: (value ?? 0) === i ? 0 : -1,
          disabled,
          onClick: () => !disabled && onChange(i),
          ref: (el) => {
            items.current[i] = el;
          },
        }),
      )}
    </div>
  );
}
