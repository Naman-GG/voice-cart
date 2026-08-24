"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Speaks assistant replies aloud so the app is usable without looking at it.
 * Voice selection waits for `voiceschanged`, which Chrome fires asynchronously.
 */
export function useSpeechSynthesis(lang: string, enabled: boolean) {
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !text) return;
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        const voice =
          voicesRef.current.find((option) => option.lang === lang) ??
          voicesRef.current.find((option) => option.lang.startsWith(lang.split("-")[0]));
        if (voice) utterance.voice = voice;
        utterance.rate = 1;
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.warn("Speech synthesis failed", error);
      }
    },
    [enabled, lang],
  );

  return { speak, cancel };
}
