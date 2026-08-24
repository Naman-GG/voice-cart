"use client";

import { COMMAND_REFERENCE, T } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

interface Props {
  lang: Lang;
  onRun: (command: string) => void;
  onClose: () => void;
}

/** The command reference. A spoken one-liner is too easy to miss. */
export function HelpPanel({ lang, onRun, onClose }: Props) {
  return (
    <section aria-label={T.helpTitle[lang]} className="animate-write">
      <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
        <h2 className="label">{T.helpTitle[lang]}</h2>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[11px] text-pencil underline-offset-4 transition hover:text-pen hover:underline"
        >
          {T.close[lang]}
        </button>
      </div>

      <p className="pt-2 font-mono text-[11px] text-pencil">{T.helpHint[lang]}</p>

      <div className="mt-2 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {COMMAND_REFERENCE[lang].map((section) => (
          <div key={section.group}>
            <p className="label mb-1">{section.group}</p>
            <ul className="space-y-0.5">
              {section.examples.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => onRun(example)}
                    className="text-left text-[14px] text-ink underline-offset-4 transition hover:text-pen hover:underline"
                  >
                    {example}
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
