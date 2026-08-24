"use client";

import { LANGUAGES, T } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

interface Props {
  lang: Lang;
  speakReplies: boolean;
  onLangChange: (lang: Lang) => void;
  onSpeakChange: (value: boolean) => void;
}

export function Header({ lang, speakReplies, onLangChange, onSpeakChange }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          <span aria-hidden className="mr-1.5">🛒</span>
          {T.appName[lang]}
        </h1>
        <p className="text-xs text-text-muted">{T.tagline[lang]}</p>
      </div>

      <div className="flex items-center gap-2">
        <div
          role="radiogroup"
          aria-label={T.language[lang]}
          className="flex rounded-full border border-line bg-surface p-0.5"
        >
          {LANGUAGES.map((option) => (
            <button
              key={option.code}
              type="button"
              role="radio"
              aria-checked={lang === option.code}
              onClick={() => onLangChange(option.code)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                lang === option.code
                  ? "bg-accent text-[color:var(--accent-contrast)]"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {option.nativeLabel}
            </button>
          ))}
        </div>

        <Toggle
          active={speakReplies}
          onClick={() => onSpeakChange(!speakReplies)}
          label={T.voiceReplies[lang]}
          title={T.voiceReplies[lang]}
        >
          {speakReplies ? "🔊" : "🔇"}
        </Toggle>
      </div>
    </header>
  );
}

function Toggle({
  active,
  onClick,
  label,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={title}
      className={`h-9 w-9 rounded-full border text-sm transition ${
        active ? "border-accent bg-accent-soft text-text" : "border-line bg-surface text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
