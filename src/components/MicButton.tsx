"use client";

import { T } from "@/lib/i18n";
import type { CaptureStatus } from "@/hooks/useVoiceCapture";
import type { Lang } from "@/lib/types";

interface Props {
  status: CaptureStatus;
  speaking: boolean;
  /** Live input level, 0-1. */
  level: number;
  handsFree: boolean;
  supported: boolean;
  lang: Lang;
  lastTranscript: string | null;
  onToggle: () => void;
}

/** Per-bar multipliers give the waveform a natural centre-weighted shape. */
const BAR_WEIGHTS = [0.45, 0.78, 1, 0.78, 0.45];

type Visual = "idle" | "listening" | "recording" | "transcribing" | "speaking";

function resolveVisual(status: CaptureStatus, speaking: boolean): Visual {
  if (speaking) return "speaking";
  if (status === "transcribing") return "transcribing";
  if (status === "recording") return "recording";
  if (status === "listening") return "listening";
  return "idle";
}

const LABEL_KEYS: Record<Visual, keyof typeof T> = {
  idle: "statusIdle",
  listening: "statusListening",
  recording: "statusRecording",
  transcribing: "statusTranscribing",
  speaking: "statusSpeaking",
};

const ORB_STYLES: Record<Visual, string> = {
  idle: "bg-accent text-[color:var(--accent-contrast)]",
  listening: "bg-accent text-[color:var(--accent-contrast)]",
  recording: "bg-danger text-white",
  transcribing: "bg-warning text-white",
  speaking: "bg-accent-soft text-text ring-2 ring-accent",
};

/** The primary control: a large, audio-reactive push-to-talk orb. */
export function MicButton({
  status,
  speaking,
  level,
  handsFree,
  supported,
  lang,
  lastTranscript,
  onToggle,
}: Props) {
  const visual = resolveVisual(status, speaking);
  const label = T[LABEL_KEYS[visual]][lang];
  const live = visual === "recording" ? Math.min(1, level * 1.6) : 0;
  const halo = visual === "recording" ? 1 + live * 0.45 : 1;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex h-32 w-32 items-center justify-center">
        {/* Level-reactive halo — driven by real microphone amplitude. */}
        {visual === "recording" && (
          <span
            aria-hidden
            className="absolute h-24 w-24 rounded-full bg-danger/25 transition-transform duration-75 ease-out"
            style={{ transform: `scale(${halo})` }}
          />
        )}
        {visual === "listening" && (
          <>
            <span aria-hidden className="animate-pulse-ring absolute inset-2 rounded-full bg-accent/25" />
            <span aria-hidden className="animate-pulse-ring absolute inset-2 rounded-full bg-accent/20 [animation-delay:900ms]" />
          </>
        )}

        <button
          type="button"
          onClick={onToggle}
          disabled={!supported}
          aria-label={label}
          aria-pressed={visual === "recording"}
          className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full shadow-[var(--shadow)] transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${ORB_STYLES[visual]}`}
        >
          {visual === "recording" ? (
            <span className="flex h-9 items-center gap-1" aria-hidden>
              {BAR_WEIGHTS.map((weight, index) => (
                <span
                  key={index}
                  className="block w-1.5 rounded-full bg-current transition-[height] duration-75 ease-out"
                  style={{ height: `${Math.max(6, live * weight * 36 + 6)}px` }}
                />
              ))}
            </span>
          ) : visual === "transcribing" ? (
            <SpinnerIcon />
          ) : visual === "speaking" ? (
            <SpeakerIcon />
          ) : (
            <MicIcon />
          )}
        </button>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <p className="text-sm font-medium text-text" aria-live="polite">
          {label}
        </p>
        {handsFree && visual !== "idle" && (
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium">
            {T.handsFree[lang]} · {T.poweredBy[lang]}
          </span>
        )}
      </div>

      <p className="min-h-6 max-w-md px-4 text-center text-sm text-text-muted" aria-live="polite">
        {lastTranscript && <span className="italic">“{lastTranscript}”</span>}
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

function SpeakerIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4H4Z" />
      <path d="M16 9a4 4 0 0 1 0 6" className="animate-pulse" />
      <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" className="animate-pulse [animation-delay:200ms]" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
