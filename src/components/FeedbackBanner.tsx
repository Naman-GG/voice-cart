"use client";

import type { Feedback } from "@/lib/store";
import type { Lang } from "@/lib/types";

const TONE_STYLES: Record<Feedback["tone"], string> = {
  success: "border-accent/40 bg-accent-soft text-text",
  info: "border-line bg-surface-muted text-text",
  warning: "border-warning/40 bg-warning/10 text-text",
  error: "border-danger/40 bg-danger/10 text-text",
};

const TONE_ICONS: Record<Feedback["tone"], string> = {
  success: "✓",
  info: "ℹ",
  warning: "!",
  error: "×",
};

interface Props {
  feedback: Feedback | null;
  lang: Lang;
  onDismiss: () => void;
}

/** Real-time visual confirmation of whatever the assistant just did. */
export function FeedbackBanner({ feedback, lang, onDismiss }: Props) {
  if (!feedback) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-rise flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${TONE_STYLES[feedback.tone]}`}
    >
      <span aria-hidden className="mt-px font-semibold">
        {TONE_ICONS[feedback.tone]}
      </span>
      <p className="flex-1 leading-relaxed">{feedback.message[lang]}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-full px-2 text-text-muted transition hover:text-text"
      >
        ×
      </button>
    </div>
  );
}
