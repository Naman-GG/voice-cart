"use client";

import { COMMAND_REFERENCE, T } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

interface Props {
  lang: Lang;
  onRun: (command: string) => void;
  onClose: () => void;
}

/**
 * The command reference opened by "help". A spoken one-liner is easy to miss,
 * so the reference is shown on screen too, with every example runnable.
 */
export function HelpPanel({ lang, onRun, onClose }: Props) {
  return (
    <section
      aria-label={T.helpTitle[lang]}
      className="animate-rise rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{T.helpTitle[lang]}</h2>
          <p className="mt-0.5 text-xs text-text-muted">{T.helpHint[lang]}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-line px-3 py-1 text-xs text-text-muted transition hover:text-text"
        >
          {T.close[lang]}
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {COMMAND_REFERENCE[lang].map((section) => (
          <div key={section.group}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              {section.group}
            </p>
            <ul className="space-y-1">
              {section.examples.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => onRun(example)}
                    className="w-full rounded-lg px-2 py-1 text-left text-sm text-text transition hover:bg-surface-muted"
                  >
                    “{example}”
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
