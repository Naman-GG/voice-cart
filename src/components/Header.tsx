"use client";

import { LANGUAGES, T } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

interface Props {
  lang: Lang;
  speakReplies: boolean;
  onLangChange: (lang: Lang) => void;
  onSpeakChange: (value: boolean) => void;
}

/** The printed header of the pad: a stamped title and a hairline. */
export function Header({ lang, speakReplies, onLangChange, onSpeakChange }: Props) {
  return (
    <header className="flex items-baseline justify-between gap-4">
      <div>
        <h1 className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink">{T.appName[lang]}</h1>
        <p className="mt-0.5 text-[13px] text-pencil">{T.tagline[lang]}</p>
      </div>

      <div className="flex items-center gap-4">
        <div role="radiogroup" aria-label={T.language[lang]} className="flex items-baseline gap-2">
          {LANGUAGES.map((option, index) => (
            <span key={option.code} className="flex items-baseline gap-2">
              {index > 0 && <span aria-hidden className="font-mono text-[11px] text-rule">/</span>}
              <button
                type="button"
                role="radio"
                aria-checked={lang === option.code}
                onClick={() => onLangChange(option.code)}
                className={`font-mono text-[11px] uppercase tracking-[0.12em] underline-offset-4 transition ${
                  lang === option.code ? "text-ink underline" : "text-pencil hover:text-pen"
                }`}
              >
                {option.nativeLabel}
              </button>
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onSpeakChange(!speakReplies)}
          aria-pressed={speakReplies}
          aria-label={T.voiceReplies[lang]}
          title={T.voiceReplies[lang]}
          className={`transition ${speakReplies ? "text-pen" : "text-pencil hover:text-ink"}`}
        >
          {speakReplies ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
        </button>
      </div>
    </header>
  );
}

function SpeakerOnIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4H4Z" />
      <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4H4Z" />
      <path d="m16 10 4 4M20 10l-4 4" />
    </svg>
  );
}
