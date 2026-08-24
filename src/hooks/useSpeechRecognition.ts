"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export type RecognitionErrorCode = "unsupported" | "denied" | "no-speech" | "audio" | "network" | "unknown";

interface Options {
  /** BCP-47 tag, e.g. "en-US" or "hi-IN". */
  lang: string;
  /** Keep the mic open and restart after every utterance. */
  handsFree?: boolean;
  onResult: (transcript: string) => void;
  onError?: (code: RecognitionErrorCode) => void;
}

interface RecognitionState {
  supported: boolean;
  listening: boolean;
  interim: string;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

/** The recogniser constructor never changes at runtime, so no subscription is needed. */
const subscribeToNothing = () => () => {};
const isSupportedOnClient = () =>
  typeof window !== "undefined" && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
const isSupportedOnServer = () => false;

function mapError(code: string): RecognitionErrorCode {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "denied";
    case "no-speech":
      return "no-speech";
    case "audio-capture":
      return "audio";
    case "network":
      return "network";
    default:
      return "unknown";
  }
}

/**
 * Wraps the Web Speech API in a React-friendly hook.
 * Handles vendor prefixes, permission errors, hands-free restarts and
 * cleaning up the recogniser on unmount or language change.
 */
export function useSpeechRecognition({ lang, handsFree = false, onResult, onError }: Options): RecognitionState {
  const supported = useSyncExternalStore(subscribeToNothing, isSupportedOnClient, isSupportedOnServer);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);
  const handlersRef = useRef({ onResult, onError });

  // Keep the latest callbacks reachable without re-creating the recogniser.
  useEffect(() => {
    handlersRef.current = { onResult, onError };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      let live = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const finalText = transcript.trim();
          if (finalText) handlersRef.current.onResult(finalText);
        } else {
          live += transcript;
        }
      }
      setInterim(live.trim());
    };

    recognition.onerror = (event) => {
      const code = mapError(event.error);
      // A silent utterance in hands-free mode is normal; keep the mic open.
      if (code === "no-speech" && shouldListenRef.current) return;
      shouldListenRef.current = false;
      setListening(false);
      handlersRef.current.onError?.(code);
    };

    recognition.onend = () => {
      setInterim("");
      if (shouldListenRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          shouldListenRef.current = false;
        }
      }
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      shouldListenRef.current = false;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onstart = null;
      try {
        recognition.abort();
      } catch {
        // Recogniser was never started — nothing to abort.
      }
      recognitionRef.current = null;
      setListening(false);
    };
  }, [lang]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      handlersRef.current.onError?.("unsupported");
      return;
    }
    shouldListenRef.current = handsFree;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() throws if it is already running — treat that as listening.
      setListening(true);
    }
  }, [handsFree]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // Already stopped.
    }
    setListening(false);
    setInterim("");
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, interim, start, stop, toggle };
}
