"use client";

import { useState } from "react";
import { EXAMPLE_COMMANDS, T } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

interface Props {
  lang: Lang;
  disabled?: boolean;
  onSubmit: (text: string) => void;
}

/** Typed fallback for unsupported browsers, plus tappable example commands. */
export function CommandBar({ lang, disabled, onSubmit }: Props) {
  const [value, setValue] = useState("");

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className="min-w-0 space-y-3">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          placeholder={T.typeInstead[lang]}
          aria-label={T.typeInstead[lang]}
          enterKeyHint="send"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none transition placeholder:text-text-muted focus:border-accent"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-[color:var(--accent-contrast)] transition hover:brightness-105 disabled:opacity-40"
        >
          {T.send[lang]}
        </button>
      </form>

      <div>
        <p className="mb-2 px-1 text-xs font-medium text-text-muted">{T.tryTheseCommands[lang]}</p>
        <ul className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {EXAMPLE_COMMANDS[lang].map((example) => (
            <li key={example}>
              <button
                type="button"
                onClick={() => submit(example)}
                className="whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-text-muted transition hover:border-accent hover:text-text"
              >
                “{example}”
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
