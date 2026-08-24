"use client";

import type { Lang } from "@/lib/types";
import { T } from "@/lib/i18n";

interface Props {
  listening: boolean;
  disabled?: boolean;
  busy?: boolean;
  lang: Lang;
  interim: string;
  onToggle: () => void;
}

/** The primary control: a large, thumb-friendly push-to-talk button. */
export function MicButton({ listening, disabled, busy, lang, interim, onToggle }: Props) {
  const label = busy ? T.processing[lang] : listening ? T.listening[lang] : T.tapToSpeak[lang];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex h-28 w-28 items-center justify-center">
        {listening && (
          <>
            <span className="animate-pulse-ring absolute inset-0 rounded-full bg-accent/30" />
            <span className="animate-pulse-ring absolute inset-0 rounded-full bg-accent/20 [animation-delay:600ms]" />
          </>
        )}
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-pressed={listening}
          aria-label={label}
          className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
            listening
              ? "bg-danger text-white shadow-lg"
              : "bg-accent text-[color:var(--accent-contrast)] shadow-[var(--shadow)] hover:brightness-105"
          }`}
        >
          {listening ? (
            <span className="flex h-8 items-end gap-1" aria-hidden>
              {[0, 1, 2, 3, 4].map((index) => (
                <span
                  key={index}
                  className="animate-bar block h-8 w-1.5 rounded-full bg-white"
                  style={{ animationDelay: `${index * 110}ms` }}
                />
              ))}
            </span>
          ) : (
            <MicIcon />
          )}
        </button>
      </div>

      <p className="text-sm font-medium text-text-muted" aria-live="polite">
        {label}
      </p>

      <p className="min-h-6 max-w-md text-center text-base text-text" aria-live="polite">
        {interim && <span className="italic text-text-muted">“{interim}”</span>}
      </p>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
    </svg>
  );
}
