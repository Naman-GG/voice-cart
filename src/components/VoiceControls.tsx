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

/**
 * The two voice controls. Activating either collapses the other, so whichever
 * mode is running always has one obvious off switch.
 *
 * The level meter is drawn as a pen stroke travelling across a ruled line —
 * the same gesture that strikes an item off the list.
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
  const micEngaged =
    !handsFree && (status === "recording" || status === "transcribing" || status === "opening");
  const showMic = !handsFree;
  const showHandsFree = !micEngaged;

  const label = handsFree || micEngaged ? T[LABEL_KEYS[visual]][lang] : T.statusIdle[lang];
  const live = visual === "recording" ? Math.min(1, level * 1.7) : 0;
  const busy = visual === "recording" || visual === "listening" || visual === "transcribing";

  return (
    <div className="flex flex-col items-center gap-2.5 px-5 pb-5 pt-6">
      <div className="flex items-center justify-center">
        <Collapsible visible={showHandsFree}>
          <button
            type="button"
            onClick={onHandsFreeToggle}
            disabled={!supported}
            aria-pressed={handsFree}
            aria-label={handsFree ? T.handsFreeStop[lang] : T.handsFree[lang]}
            title={handsFree ? T.handsFreeStop[lang] : T.handsFreeHint[lang]}
            className={`flex items-center justify-center rounded-full border transition-all duration-300 ease-out active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
              handsFree
                ? "h-14 w-14 border-pen bg-pen text-paper"
                : "h-11 w-11 border-rule text-pencil hover:border-pen hover:text-pen"
            }`}
          >
            {handsFree ? <Glyph visual={visual} /> : <InfinityIcon />}
          </button>
        </Collapsible>

        <Collapsible visible={showMic}>
          <button
            type="button"
            onClick={onMicToggle}
            disabled={!supported}
            aria-pressed={visual === "recording"}
            aria-label={label}
            className={`flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-300 ease-out active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
              micEngaged
                ? "border-pen bg-pen text-paper"
                : "border-pen/60 text-pen hover:bg-pen-soft"
            }`}
          >
            <Glyph visual={micEngaged ? visual : "idle"} />
          </button>
        </Collapsible>
      </div>

      {/* The pen stroke: a ruled line the ink travels along as you speak. */}
      <div className="relative h-3 w-56" aria-hidden>
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule" />
        <span
          className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-ink transition-[width] duration-75 ease-out"
          style={{ width: `${busy ? Math.max(visual === "recording" ? 6 : 0, live * 100) : 0}%` }}
        />
        {busy && visual !== "recording" && (
          <span className="animate-nib absolute left-0 top-1/2 h-[3px] w-[3px] -translate-y-1/2 rounded-full bg-pen" />
        )}
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <p className="font-mono text-[11px] tracking-wide text-pencil" aria-live="polite">
          {label}
        </p>
        {!handsFree && showHandsFree && (
          <p className="font-mono text-[11px] text-pencil/70">{T.handsFreeIdleHint[lang]}</p>
        )}
        {handsFree && <p className="font-mono text-[11px] text-pencil/70">{T.poweredBy[lang]}</p>}
      </div>

      <p className="min-h-5 max-w-sm text-center text-[13px] text-ink/75" aria-live="polite">
        {lastTranscript && <span>“{lastTranscript}”</span>}
      </p>
    </div>
  );
}

/** Collapses width as well as opacity, so the surviving control re-centres. */
function Collapsible({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={!visible}
      className={`transition-all duration-300 ease-out ${
        visible ? "max-w-24 scale-100 opacity-100 mx-2" : "pointer-events-none max-w-0 scale-50 opacity-0 mx-0"
      }`}
    >
      {children}
    </div>
  );
}

function Glyph({ visual }: { visual: Visual }) {
  if (visual === "transcribing" || visual === "opening") return <SpinnerIcon />;
  if (visual === "speaking") return <SpeakerIcon />;
  return <MicIcon />;
}

function InfinityIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M6.5 9a3 3 0 1 0 0 6c1.7 0 2.7-1.3 3.6-2.4l1.9-2.2C12.9 9.3 13.9 8 15.6 8a3 3 0 1 1 0 6c-1.7 0-2.7-1.3-3.6-2.4L10.1 9.4C9.2 8.3 8.2 7 6.5 7Z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4H4Z" />
      <path d="M16 9a4 4 0 0 1 0 6" />
      <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
