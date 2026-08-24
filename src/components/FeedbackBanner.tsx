"use client";

import type { Feedback } from "@/lib/store";
import type { Lang } from "@/lib/types";

const TONE_RULE: Record<Feedback["tone"], string> = {
  success: "border-pen",
  info: "border-rule",
  warning: "border-margin",
  error: "border-erase",
};

const TONE_TEXT: Record<Feedback["tone"], string> = {
  success: "text-ink",
  info: "text-ink",
  warning: "text-ink",
  error: "text-erase",
};

interface Props {
  feedback: Feedback | null;
  lang: Lang;
  onDismiss: () => void;
}

/** A note in the margin: a coloured rule and a line of text, nothing more. */
export function FeedbackBanner({ feedback, lang, onDismiss }: Props) {
  if (!feedback) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-write flex items-start gap-3 border-l-2 pl-3 ${TONE_RULE[feedback.tone]}`}
    >
      <p className={`flex-1 text-sm leading-relaxed ${TONE_TEXT[feedback.tone]}`}>
        {feedback.message[lang]}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 font-mono text-sm text-pencil transition hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}
