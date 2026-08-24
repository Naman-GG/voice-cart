"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Lang } from "@/lib/types";

export type CaptureStatus = "off" | "listening" | "recording" | "transcribing";
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
}

export interface VoiceCapture {
  supported: boolean;
  active: boolean;
  status: CaptureStatus;
  /** Smoothed input level, 0-1, for the waveform. */
  level: number;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

/** Voice-activity tuning, in milliseconds unless noted. */
const SPEECH_FRAMES_TO_OPEN = 4; // ~65ms above threshold before we start
const SILENCE_TO_CLOSE = 1000;
const MIN_CLIP = 350;
const MAX_CLIP = 20_000;
const FLOOR_ATTACK = 0.02; // how fast the noise floor adapts
const MIN_THRESHOLD = 0.018;
const UNMUTE_GRACE = 350;

const subscribeToNothing = () => () => {};
const isSupportedOnClient = () =>
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof window.MediaRecorder !== "undefined";
const isSupportedOnServer = () => false;

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return "";
}

/**
 * Captures microphone audio and transcribes it with Whisper large-v3.
 *
 * In hands-free mode an analyser node watches the input level against an
 * adaptive noise floor: speech opens a clip, a second of silence closes it,
 * and the clip is posted to /api/transcribe. Push-to-talk skips the detector
 * and records between explicit start and stop calls.
 */
export function useVoiceCapture({
  lang,
  handsFree,
  muted,
  onTranscript,
  onError,
  onSpeechStart,
}: Options): VoiceCapture {
  const supported = useSyncExternalStore(subscribeToNothing, isSupportedOnClient, isSupportedOnServer);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<CaptureStatus>("off");
  const [level, setLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const frameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const recordingRef = useRef(false);
  const busyRef = useRef(false);
  const startedAtRef = useRef(0);
  const silenceSinceRef = useRef<number | null>(null);
  const speechFramesRef = useRef(0);
  const noiseFloorRef = useRef(0.01);
  const lastLevelPushRef = useRef(0);
  const mutedUntilRef = useRef(0);
  const vadRef = useRef(handsFree);
  const langRef = useRef(lang);
  const handlersRef = useRef({ onTranscript, onError, onSpeechStart });

  useEffect(() => {
    handlersRef.current = { onTranscript, onError, onSpeechStart };
    langRef.current = lang;
  });

  // Keep a grace period after the assistant stops talking so the tail of its
  // own voice, or a room echo, cannot open a new clip.
  useEffect(() => {
    if (muted) {
      mutedUntilRef.current = Number.POSITIVE_INFINITY;
    } else if (mutedUntilRef.current === Number.POSITIVE_INFINITY) {
      mutedUntilRef.current = performance.now() + UNMUTE_GRACE;
      noiseFloorRef.current = 0.01;
      speechFramesRef.current = 0;
    }
  }, [muted]);

  const teardown = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;

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
    analyserRef.current = null;

    setLevel(0);
  }, []);

  const transcribe = useCallback(async (blob: Blob) => {
    busyRef.current = true;
    setStatus("transcribing");
    try {
      const form = new FormData();
      const extension = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
      form.append("audio", blob, `speech.${extension}`);
      form.append("language", langRef.current);

      const response = await fetch("/api/transcribe", { method: "POST", body: form });
      const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string; code?: string };

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
      busyRef.current = false;
      if (vadRef.current) {
        setStatus("listening");
      } else {
        // Push-to-talk releases the mic so the browser's recording
        // indicator does not stay lit between commands.
        teardown();
        setActive(false);
        setStatus("off");
      }
    }
  }, [teardown]);

  const finishClip = useCallback(
    (discard = false) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive" || !recordingRef.current) return;
      const tooShort = performance.now() - startedAtRef.current < MIN_CLIP;
      const drop = discard || tooShort;

      recordingRef.current = false;
      silenceSinceRef.current = null;
      speechFramesRef.current = 0;

      recorder.onstop = () => {
        const chunks = chunksRef.current;
        chunksRef.current = [];
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (drop || blob.size < 1200) {
          setStatus(vadRef.current ? "listening" : "off");
          return;
        }
        void transcribe(blob);
      };

      try {
        recorder.stop();
      } catch {
        setStatus(vadRef.current ? "listening" : "off");
      }
    },
    [transcribe],
  );

  const beginClip = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "inactive" || recordingRef.current || busyRef.current) return;
    chunksRef.current = [];
    recordingRef.current = true;
    startedAtRef.current = performance.now();
    silenceSinceRef.current = null;
    try {
      recorder.start(120);
      setStatus("recording");
      handlersRef.current.onSpeechStart?.();
    } catch {
      recordingRef.current = false;
    }
  }, []);

  const start = useCallback(async () => {
    if (!supported) {
      handlersRef.current.onError("unsupported");
      return;
    }
    if (streamRef.current) {
      // Already live — a manual tap opens a clip straight away.
      if (!recordingRef.current && !busyRef.current) beginClip();
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      handlersRef.current.onError(denied ? "denied" : "no-audio");
      return;
    }

    streamRef.current = stream;
    setActive(true);

    const context = new AudioContext();
    contextRef.current = context;
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
    analyserRef.current = analyser;

    const recorder = new MediaRecorder(stream, pickMimeType() ? { mimeType: pickMimeType() } : undefined);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorderRef.current = recorder;

    const samples = new Float32Array(analyser.fftSize);
    const tick = () => {
      frameRef.current = requestAnimationFrame(tick);
      const node = analyserRef.current;
      if (!node) return;

      node.getFloatTimeDomainData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
      const rms = Math.sqrt(sum / samples.length);
      const scaled = Math.min(1, rms * 6);

      const now = performance.now();
      if (now - lastLevelPushRef.current > 55) {
        lastLevelPushRef.current = now;
        setLevel(scaled);
      }

      if (now < mutedUntilRef.current) {
        if (recordingRef.current) finishClip(true);
        return;
      }
      if (busyRef.current) return;

      const threshold = Math.max(MIN_THRESHOLD, noiseFloorRef.current * 2.6 + 0.008);
      const loud = scaled > threshold;

      if (!recordingRef.current) {
        // Track the room's noise floor only while nobody is talking.
        noiseFloorRef.current += (scaled - noiseFloorRef.current) * FLOOR_ATTACK;
        if (!vadRef.current) return;
        speechFramesRef.current = loud ? speechFramesRef.current + 1 : 0;
        if (speechFramesRef.current >= SPEECH_FRAMES_TO_OPEN) beginClip();
        return;
      }

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
    };

    setStatus(vadRef.current ? "listening" : "off");
    frameRef.current = requestAnimationFrame(tick);
    if (!vadRef.current) beginClip();
  }, [beginClip, finishClip, supported]);

  const stop = useCallback(() => {
    if (recordingRef.current) {
      // Let the clip finish; transcribe() tears the session down after.
      finishClip();
      return;
    }
    teardown();
    setActive(false);
    setStatus("off");
  }, [finishClip, teardown]);

  // Hands-free arms the detector; turning it off ends the session.
  // Deferred a tick so opening the audio graph never cascades a render.
  useEffect(() => {
    vadRef.current = handsFree;
    const id = setTimeout(() => {
      if (handsFree) {
        void start();
      } else if (recordingRef.current) {
        // vadRef is already false, so transcribe() will release the mic.
        finishClip();
      } else if (streamRef.current) {
        teardown();
        setActive(false);
        setStatus("off");
      }
    }, 0);
    return () => clearTimeout(id);
  }, [finishClip, handsFree, start, teardown]);

  useEffect(() => teardown, [teardown]);

  const toggle = useCallback(() => {
    if (recordingRef.current) finishClip();
    else void start();
  }, [finishClip, start]);

  return {
    supported,
    active,
    status,
    level,
    start: () => void start(),
    stop,
    toggle,
  };
}
