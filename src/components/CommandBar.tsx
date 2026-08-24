"use client";

import { useState } from "react";
import { EXAMPLE_COMMANDS, T } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

interface Props {
  lang: Lang;
  disabled?: boolean;
  onSubmit: (text: string) => void;
}

/** Typing goes on the next blank rule: an underline, not a box. */
export function CommandBar({ lang, disabled, onSubmit }: Props) {
  const [value, setValue] = useState("");

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className="min-w-0 space-y-2.5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
        className="flex items-center gap-3 border-b border-rule pb-1.5 focus-within:border-pen"
      >
        <span aria-hidden className="font-mono text-sm text-pencil">
          ›
        </span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          placeholder={T.typeInstead[lang]}
          aria-label={T.typeInstead[lang]}
          enterKeyHint="send"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-pencil/70"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-pen transition disabled:opacity-30"
        >
          {T.send[lang]}
        </button>
      </form>

      <ul className="scrollbar-thin flex gap-x-4 gap-y-1 overflow-x-auto pb-1">
        {EXAMPLE_COMMANDS[lang].slice(0, 4).map((example) => (
          <li key={example}>
            <button
              type="button"
              onClick={() => submit(example)}
              className="whitespace-nowrap font-mono text-[11px] text-pencil underline-offset-4 transition hover:text-pen hover:underline"
            >
              {example}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
