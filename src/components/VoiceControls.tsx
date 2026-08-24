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
  onMicToggle: () => void;
  onHandsFreeToggle: () => void;
}

/** Per-bar multipliers give the waveform a natural centre-weighted shape. */
const BAR_WEIGHTS = [0.45, 0.78, 1, 0.78, 0.45];

type Visual = "idle" | "opening" | "listening" | "recording" | "transcribing" | "speaking";

function resolveVisual(status: CaptureStatus, speaking: boolean): Visual {
  // Recording wins over speaking: if the user talks over the assistant,
  // show what the microphone is actually doing.
  if (status === "recording") return "recording";
  if (speaking) return "speaking";
  if (status === "opening") return "opening";
  if (status === "transcribing") return "transcribing";
  if (status === "listening") return "listening";
  return "idle";
}

const LABEL_KEYS: Record<Visual, keyof typeof T> = {
  idle: "statusIdle",
  opening: "statusOpening",
  listening: "statusListening",
  recording: "statusRecording",
  transcribing: "statusTranscribing",
  speaking: "statusSpeaking",
};

const ORB_STYLES: Record<Visual, string> = {
  idle: "bg-accent text-[color:var(--accent-contrast)]",
  opening: "bg-accent/70 text-[color:var(--accent-contrast)]",
  listening: "bg-accent text-[color:var(--accent-contrast)]",
  recording: "bg-danger text-white",
  transcribing: "bg-warning text-white",
  speaking: "bg-accent-soft text-text ring-2 ring-accent",
};

/**
 * The two voice controls, side by side.
 *
 * Activating either one collapses the other, so the active mode always has a
 * single obvious off switch — previously hands-free could only be stopped
 * from a small toggle in the header.
 */
export function VoiceControls({
  status,
  speaking,
  level,
  handsFree,
  supported,
  lang,
  lastTranscript,
  onMicToggle,
  onHandsFreeToggle,
}: Props) {
  const visual = resolveVisual(status, speaking);
  // Push-to-talk is mid-command: hide the hands-free control until it settles.
  const micEngaged =
    !handsFree && (status === "recording" || status === "transcribing" || status === "opening");
  const showMic = !handsFree;
  const showHandsFree = !micEngaged;

  const label = handsFree || micEngaged ? T[LABEL_KEYS[visual]][lang] : T.statusIdle[lang];
  const live = visual === "recording" ? Math.min(1, level * 1.6) : 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-32 items-center justify-center">
        <Collapsible visible={showHandsFree}>
          <div className="relative flex items-center justify-center">
            {handsFree && visual === "listening" && (
              <>
                <span aria-hidden className="animate-pulse-ring absolute inset-2 rounded-full bg-accent/25" />
                <span
                  aria-hidden
                  className="animate-pulse-ring absolute inset-2 rounded-full bg-accent/20 [animation-delay:900ms]"
                />
              </>
            )}
            {handsFree && visual === "recording" && (
              <span
                aria-hidden
                className="absolute h-24 w-24 rounded-full bg-danger/25 transition-transform duration-75 ease-out"
                style={{ transform: `scale(${1 + live * 0.45})` }}
              />
            )}
            <button
              type="button"
              onClick={onHandsFreeToggle}
              disabled={!supported}
              aria-pressed={handsFree}
              aria-label={handsFree ? T.handsFreeStop[lang] : T.handsFree[lang]}
              title={handsFree ? T.handsFreeStop[lang] : T.handsFreeHint[lang]}
              className={`relative z-10 flex items-center justify-center rounded-full transition-all duration-300 ease-out active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                handsFree
                  ? `h-24 w-24 shadow-[var(--shadow)] ${ORB_STYLES[visual]}`
                  : "h-14 w-14 border border-line bg-surface text-text-muted hover:border-accent hover:text-text"
              }`}
            >
              {handsFree ? <OrbFace visual={visual} live={live} /> : <InfinityIcon />}
            </button>
          </div>
        </Collapsible>

        <Collapsible visible={showMic}>
          <div className="relative flex items-center justify-center">
            {visual === "recording" && (
              <span
                aria-hidden
                className="absolute h-24 w-24 rounded-full bg-danger/25 transition-transform duration-75 ease-out"
                style={{ transform: `scale(${1 + live * 0.45})` }}
              />
            )}
            <button
              type="button"
              onClick={onMicToggle}
              disabled={!supported}
              aria-pressed={visual === "recording"}
              aria-label={label}
              className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full shadow-[var(--shadow)] transition-all duration-300 ease-out active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${ORB_STYLES[micEngaged ? visual : "idle"]}`}
            >
              <OrbFace visual={micEngaged ? visual : "idle"} live={live} />
            </button>
          </div>
        </Collapsible>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <p className="text-sm font-medium text-text" aria-live="polite">
          {label}
        </p>
        {handsFree ? (
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium">
            {T.handsFree[lang]} · {T.poweredBy[lang]}
          </span>
        ) : (
          showHandsFree && <span className="text-[11px] text-text-muted">{T.handsFreeIdleHint[lang]}</span>
        )}
      </div>

      <p className="min-h-6 max-w-md px-4 text-center text-sm text-text-muted" aria-live="polite">
        {lastTranscript && <span className="italic">“{lastTranscript}”</span>}
      </p>
    </div>
  );
}

/** Collapses width as well as opacity, so the surviving control re-centres. */
function Collapsible({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={!visible}
      className={`overflow-visible transition-all duration-300 ease-out ${
        visible ? "max-w-40 scale-100 opacity-100 mx-2" : "pointer-events-none max-w-0 scale-50 opacity-0 mx-0"
      }`}
    >
      {children}
    </div>
  );
}

function OrbFace({ visual, live }: { visual: Visual; live: number }) {
  if (visual === "recording") {
    return (
      <span className="flex h-9 items-center gap-1" aria-hidden>
        {BAR_WEIGHTS.map((weight, index) => (
          <span
            key={index}
            className="block w-1.5 rounded-full bg-current transition-[height] duration-75 ease-out"
            style={{ height: `${Math.max(6, live * weight * 36 + 6)}px` }}
          />
        ))}
      </span>
    );
  }
  if (visual === "transcribing" || visual === "opening") return <SpinnerIcon />;
  if (visual === "speaking") return <SpeakerIcon />;
  return <MicIcon />;
}

function InfinityIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M6.5 9a3 3 0 1 0 0 6c1.7 0 2.7-1.3 3.6-2.4l1.9-2.2C12.9 9.3 13.9 8 15.6 8a3 3 0 1 1 0 6c-1.7 0-2.7-1.3-3.6-2.4L10.1 9.4C9.2 8.3 8.2 7 6.5 7Z" />
    </svg>
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
