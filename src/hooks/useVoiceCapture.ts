"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LEVEL_WORKLET_SOURCE } from "./level-worklet";
import type { Lang } from "@/lib/types";

export type CaptureStatus = "off" | "opening" | "listening" | "recording" | "transcribing";
export type CaptureErrorCode =
  | "unsupported"
  | "denied"
  | "no-audio"
  | "empty"
  | "config"
  | "network"
  | "unknown";

interface Options {
  lang: Lang;
  /** Arm voice-activity detection so speech starts a clip on its own. */
  handsFree: boolean;
  /** True while the assistant is talking, so it never records itself. */
  muted: boolean;
  onTranscript: (text: string) => void;
  onError: (code: CaptureErrorCode, message?: string) => void;
  /** Fires whenever the user starts speaking, used to reset idle timers. */
  onSpeechStart?: () => void;
  /** Fires when hands-free gives up after a long silence. */
  onIdleTimeout?: () => void;
}

export interface VoiceCapture {
  supported: boolean;
  status: CaptureStatus;
  /** True while a clip is being transcribed, independent of `status`. */
  busy: boolean;
  /** Smoothed input level, 0-1, for the waveform. */
  level: number;
  toggle: () => void;
  stop: () => void;
}

/** Voice-activity tuning, in milliseconds unless noted. */
const SPEECH_ONSET_MS = 70; // sustained loudness before a clip opens
const SILENCE_TO_CLOSE = 700;
const MIN_CLIP = 250;
const MAX_CLIP = 20_000;
const FLOOR_ATTACK = 0.02; // how fast the noise floor adapts
/**
 * Sustained sound a clip needs before it is worth uploading. A door click or
 * keyboard tap has a high peak but almost no duration, so peak alone lets
 * transients through. Kept low enough that a one-word reply like "yes" or
 * "हाँ" still qualifies.
 */
const MIN_LOUD_MS = 170;
/** Ignore gaps longer than this between level reports (tab was suspended). */
const MAX_SAMPLE_GAP = 120;
const MIN_THRESHOLD = 0.018;
/** Room reverb of the assistant's own voice outlives the utterance itself. */
const UNMUTE_GRACE = 900;
/** Let the noise floor converge before the detector is allowed to fire. */
const VAD_WARMUP = 700;
/** Keep the mic warm this long after a clip so repeat commands are instant. */
const WARM_RELEASE = 30_000;
/**
 * Hands-free gives up after this much silence. Listening indefinitely keeps
 * the recording indicator lit for no reason; the assistant speaking to itself
 * does not count as activity, only the user actually saying something does.
 */
const IDLE_MIC_TIMEOUT = 60_000;

const subscribeToNothing = () => () => {};
const isSupportedOnClient = () =>
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof window.MediaRecorder !== "undefined";
const isSupportedOnServer = () => false;

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return "";
}

/**
 * Captures microphone audio and transcribes it with Whisper large-v3.
 *
 * The audio session (stream + level worklet + recorder) is opened once and kept
 * warm, so only the first command pays the getUserMedia cost. In hands-free
 * mode an audio-thread worklet watches input level against an adaptive floor:
 * speech opens a clip, a short silence closes it and posts it to
 * /api/transcribe. A tap always opens or closes a clip immediately.
 */
export function useVoiceCapture({
  lang,
  handsFree,
  muted,
  onTranscript,
  onError,
  onSpeechStart,
  onIdleTimeout,
}: Options): VoiceCapture {
  const supported = useSyncExternalStore(subscribeToNothing, isSupportedOnClient, isSupportedOnServer);
  const [status, setStatus] = useState<CaptureStatus>("off");
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  /** In-flight open, so rapid taps share one getUserMedia call. */
  const openRef = useRef<Promise<boolean> | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recordingRef = useRef(false);
  const inflightRef = useRef(0);
  const startedAtRef = useRef(0);
  const silenceSinceRef = useRef<number | null>(null);
  const loudRunMsRef = useRef(0);
  const lastSampleAtRef = useRef(0);
  const noiseFloorRef = useRef(0.01);
  /** Loudest level seen during the current clip. */
  const clipPeakRef = useRef(0);
  /** Accumulated milliseconds above threshold during the current clip. */
  const clipLoudMsRef = useRef(0);
  /** Detector stays disarmed until this timestamp. */
  const vadReadyAtRef = useRef(0);
  /** Last time the user actually spoke, for the hands-free idle cutoff. */
  const lastSpeechAtRef = useRef(0);
  const lastLevelPushRef = useRef(0);
  const mutedUntilRef = useRef(0);
  const vadRef = useRef(handsFree);
  const langRef = useRef(lang);
  const handlersRef = useRef({ onTranscript, onError, onSpeechStart, onIdleTimeout });

  useEffect(() => {
    handlersRef.current = { onTranscript, onError, onSpeechStart, onIdleTimeout };
    langRef.current = lang;
  });

  /**
   * Resting status. A warm-but-unarmed session still reads as "off" to the
   * user, because nothing will be recorded until they tap.
   */
  const restStatus = useCallback((): CaptureStatus => (vadRef.current ? "listening" : "off"), []);

  // Keep a grace period after the assistant stops talking so the tail of its
  // own voice, or a room echo, cannot open a new clip.
  useEffect(() => {
    if (muted) {
      mutedUntilRef.current = Number.POSITIVE_INFINITY;
    } else if (mutedUntilRef.current === Number.POSITIVE_INFINITY) {
      mutedUntilRef.current = performance.now() + UNMUTE_GRACE;
      // Re-warm after speaking: the floor was frozen while muted.
      vadReadyAtRef.current = performance.now() + UNMUTE_GRACE + VAD_WARMUP;
      noiseFloorRef.current = 0.01;
      loudRunMsRef.current = 0;
    }
  }, [muted]);

  const teardown = useCallback(() => {
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = null;
    const worklet = workletRef.current;
    if (worklet) {
      worklet.port.onmessage = null;
      worklet.disconnect();
    }
    workletRef.current = null;

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // Already stopped.
      }
    }
    recorderRef.current = null;
    recordingRef.current = false;
    chunksRef.current = [];

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    void contextRef.current?.close().catch(() => {});
    contextRef.current = null;
    openRef.current = null;

    setLevel(0);
    setStatus("off");
  }, []);

  const cancelRelease = useCallback(() => {
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = null;
  }, []);

  /** Release the mic after a quiet spell so the recording indicator clears. */
  const scheduleRelease = useCallback(() => {
    cancelRelease();
    if (vadRef.current) return; // hands-free stays open by design
    releaseTimerRef.current = setTimeout(() => {
      if (!recordingRef.current && inflightRef.current === 0) teardown();
    }, WARM_RELEASE);
  }, [cancelRelease, teardown]);

  const transcribe = useCallback(
    async (blob: Blob) => {
      inflightRef.current += 1;
      setBusy(true);
      setStatus("transcribing");
      try {
        const form = new FormData();
        const extension = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
        form.append("audio", blob, `speech.${extension}`);
        form.append("language", langRef.current);

        const response = await fetch("/api/transcribe", { method: "POST", body: form });
        const payload = (await response.json().catch(() => ({}))) as {
          text?: string;
          error?: string;
          code?: string;
        };

        if (!response.ok) {
          const code: CaptureErrorCode =
            payload.code === "missing_key" || payload.code === "bad_key" ? "config" : "network";
          handlersRef.current.onError(code, payload.error);
          return;
        }

        const text = (payload.text ?? "").trim();
        if (!text) {
          handlersRef.current.onError("empty");
          return;
        }
        handlersRef.current.onTranscript(text);
      } catch (error) {
        console.warn("Transcription request failed", error);
        handlersRef.current.onError("network");
      } finally {
        inflightRef.current -= 1;
        if (inflightRef.current === 0) setBusy(false);
        // Recording may have restarted while this clip was in flight.
        if (!recordingRef.current) {
          setStatus(restStatus());
          scheduleRelease();
        }
      }
    },
    [restStatus, scheduleRelease],
  );

  const finishClip = useCallback(
    (discard = false) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive" || !recordingRef.current) return;
      const tooShort = performance.now() - startedAtRef.current < MIN_CLIP;
      // A clip that never rose above the noise floor, or that only spiked
      // briefly, is noise rather than speech. Dropping it here saves a round
      // trip and avoids Whisper hallucinating on it.
      const threshold = Math.max(MIN_THRESHOLD, noiseFloorRef.current * 3 + 0.01);
      const silent = clipPeakRef.current < threshold;
      const tooBrief = clipLoudMsRef.current < MIN_LOUD_MS;
      const drop = discard || tooShort || silent || tooBrief;

      recordingRef.current = false;
      silenceSinceRef.current = null;
      loudRunMsRef.current = 0;

      recorder.onstop = () => {
        const chunks = chunksRef.current;
        chunksRef.current = [];
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (drop || blob.size < 1200) {
          setStatus(restStatus());
          scheduleRelease();
          return;
        }
        void transcribe(blob);
      };

      try {
        recorder.stop();
      } catch {
        setStatus(restStatus());
      }
    },
    [restStatus, scheduleRelease, transcribe],
  );

  const beginClip = useCallback(() => {
    const recorder = recorderRef.current;
    // A transcription still in flight must not block a new recording.
    if (!recorder || recorder.state !== "inactive" || recordingRef.current) return;
    cancelRelease();
    chunksRef.current = [];
    recordingRef.current = true;
    clipPeakRef.current = 0;
    clipLoudMsRef.current = 0;
    startedAtRef.current = performance.now();
    lastSpeechAtRef.current = startedAtRef.current;
    silenceSinceRef.current = null;
    try {
      recorder.start(120);
      setStatus("recording");
      handlersRef.current.onSpeechStart?.();
    } catch {
      recordingRef.current = false;
      setStatus(restStatus());
    }
  }, [cancelRelease, restStatus]);

  /**
   * Opens the audio session once. Concurrent callers await the same promise,
   * which is what stops a double tap from opening two microphones.
   */
  const openSession = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true;
    if (openRef.current) return openRef.current;
    if (!supported) {
      handlersRef.current.onError("unsupported");
      return false;
    }

    const opening = (async () => {
      setStatus("opening");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (error) {
        const denied =
          error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
        handlersRef.current.onError(denied ? "denied" : "no-audio");
        setStatus("off");
        return false;
      }

      streamRef.current = stream;

      const context = new AudioContext();
      contextRef.current = context;
      // Created outside the click's task, so Chrome starts it suspended and
      // the worklet would report pure silence until it is resumed.
      if (context.state === "suspended") {
        try {
          await context.resume();
        } catch {
          // Non-fatal: recording still works, only the meter goes flat.
        }
      }

      const source = context.createMediaStreamSource(stream);

      // Level metering runs on the audio thread. requestAnimationFrame is
      // suspended outright in a hidden tab and background timers are clamped
      // to one second, either of which would freeze voice detection the
      // moment the user switches tabs.
      let workletUrl: string | null = null;
      try {
        const blob = new Blob([LEVEL_WORKLET_SOURCE], { type: "application/javascript" });
        workletUrl = URL.createObjectURL(blob);
        await context.audioWorklet.addModule(workletUrl);
      } catch (error) {
        console.error("Could not start the audio level worklet", error);
        handlersRef.current.onError("no-audio");
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        void context.close().catch(() => {});
        contextRef.current = null;
        setStatus("off");
        return false;
      } finally {
        if (workletUrl) URL.revokeObjectURL(workletUrl);
      }

      const worklet = new AudioWorkletNode(context, "level-processor");
      source.connect(worklet);
      // Some engines only pull a node that reaches the destination; a muted
      // gain keeps the graph live without playing anything back.
      const silentSink = context.createGain();
      silentSink.gain.value = 0;
      worklet.connect(silentSink).connect(context.destination);
      workletRef.current = worklet;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorderRef.current = recorder;

      const onLevel = (rms: number) => {
        const scaled = Math.min(1, rms * 6);
        const now = performance.now();
        // Clamped so a suspended tab resuming cannot dump a huge delta into
        // the sustained-speech accumulators.
        const delta = Math.min(now - lastSampleAtRef.current, MAX_SAMPLE_GAP);
        lastSampleAtRef.current = now;

        if (now - lastLevelPushRef.current > 55) {
          lastLevelPushRef.current = now;
          setLevel(scaled);
        }

        if (now < mutedUntilRef.current) {
          if (recordingRef.current) finishClip(true);
          return;
        }

        const threshold = Math.max(MIN_THRESHOLD, noiseFloorRef.current * 3 + 0.01);
        const loud = scaled > threshold;

        if (recordingRef.current) {
          if (scaled > clipPeakRef.current) clipPeakRef.current = scaled;
          if (loud) clipLoudMsRef.current += delta;

          if (now - startedAtRef.current > MAX_CLIP) {
            finishClip();
            return;
          }
          if (!vadRef.current) return;
          if (loud) {
            silenceSinceRef.current = null;
            return;
          }
          if (silenceSinceRef.current === null) silenceSinceRef.current = now;
          else if (now - silenceSinceRef.current > SILENCE_TO_CLOSE) finishClip();
          return;
        }

        // Track the room's noise floor only while nobody is talking.
        noiseFloorRef.current += (scaled - noiseFloorRef.current) * FLOOR_ATTACK;
        if (!vadRef.current) return;

        if (inflightRef.current === 0 && now - lastSpeechAtRef.current > IDLE_MIC_TIMEOUT) {
          teardown();
          handlersRef.current.onIdleTimeout?.();
          return;
        }
        // Firing before the floor has settled turns room tone into a clip.
        if (now < vadReadyAtRef.current) {
          loudRunMsRef.current = 0;
          return;
        }
        loudRunMsRef.current = loud ? loudRunMsRef.current + delta : 0;
        if (loudRunMsRef.current >= SPEECH_ONSET_MS) beginClip();
      };

      worklet.port.onmessage = (event: MessageEvent<number>) => onLevel(event.data);

      const openedAt = performance.now();
      vadReadyAtRef.current = openedAt + VAD_WARMUP;
      lastSpeechAtRef.current = openedAt;
      lastSampleAtRef.current = openedAt;
      setStatus(restStatus());
      return true;
    })();

    openRef.current = opening;
    const ok = await opening;
    if (!ok) openRef.current = null;
    return ok;
  }, [beginClip, finishClip, restStatus, supported, teardown]);

  /** Tap: close an open clip, otherwise open the session and start one. */
  const toggle = useCallback(() => {
    if (recordingRef.current) {
      finishClip();
      return;
    }
    void openSession().then((ok) => {
      if (ok) beginClip();
    });
  }, [beginClip, finishClip, openSession]);

  const stop = useCallback(() => {
    if (recordingRef.current) finishClip();
    else teardown();
  }, [finishClip, teardown]);

  // Hands-free arms the detector and holds the session open.
  // Deferred a tick so opening the audio graph never cascades a render.
  useEffect(() => {
    vadRef.current = handsFree;
    const id = setTimeout(() => {
      if (handsFree) {
        cancelRelease();
        void openSession();
      } else if (recordingRef.current) {
        finishClip();
      } else if (streamRef.current) {
        scheduleRelease();
      }
    }, 0);
    return () => clearTimeout(id);
  }, [cancelRelease, finishClip, handsFree, openSession, scheduleRelease]);

  useEffect(() => teardown, [teardown]);

  return { supported, status, busy, level, toggle, stop };
}
