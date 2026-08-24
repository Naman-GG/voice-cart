"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Chrome garbles an utterance that starts on the same tick as cancel(),
 * which is what produced the thin, clipped "ghost" voice. A short gap
 * between the two fixes it.
 */
const CANCEL_SETTLE_MS = 90;
/** Chrome silently pauses synthesis after ~15s; nudge it while speaking. */
const RESUME_INTERVAL_MS = 5_000;

/** Voice names that sound markedly better than the platform defaults. */
const PREFERRED = [/google/i, /natural/i, /premium/i, /enhanced/i, /neural/i];
const AVOID = [/compact/i, /eloquence/i, /novelty/i];

function scoreVoice(voice: SpeechSynthesisVoice, lang: string): number {
  const base = lang.split("-")[0];
  let score = 0;
  if (voice.lang === lang) score += 10;
  else if (voice.lang.startsWith(base)) score += 6;
  else return -1;

  if (PREFERRED.some((pattern) => pattern.test(voice.name))) score += 5;
  if (AVOID.some((pattern) => pattern.test(voice.name))) score -= 6;
  // Local voices start instantly and never cut out mid-sentence.
  if (voice.localService) score += 2;
  if (voice.default) score += 1;
  return score;
}

/**
 * Speaks assistant replies aloud so the app is usable without looking at it.
 * Exposes `speaking` so the microphone can be muted while it talks, which
 * stops the recogniser from hearing the app's own voice.
 */
export function useSpeechSynthesis(lang: string, enabled: boolean) {
  const [speaking, setSpeaking] = useState(false);
  const [voiceName, setVoiceName] = useState<string | null>(null);

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;

    const load = () => {
      const voices = synth.getVoices();
      if (!voices.length) return;
      voicesRef.current = voices;
      const best = voices
        .map((voice) => ({ voice, score: scoreVoice(voice, lang) }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => b.score - a.score)[0];
      setVoiceName(best?.voice.name ?? null);
    };

    load();
    synth.addEventListener("voiceschanged", load);
    // Safari populates the list lazily and never fires voiceschanged.
    const retry = setTimeout(load, 400);
    return () => {
      clearTimeout(retry);
      synth.removeEventListener("voiceschanged", load);
    };
  }, [lang]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    keepAliveRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    clearTimers();
    utteranceRef.current = null;
    setSpeaking(false);
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Nothing was queued.
    }
  }, [clearTimers]);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !text) return;
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      const synth = window.speechSynthesis;

      clearTimers();
      try {
        synth.cancel();
      } catch {
        // Nothing was queued.
      }

      // Let the cancel settle before queueing, or Chrome clips the opening.
      timerRef.current = setTimeout(() => {
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = lang;

          const best = voicesRef.current
            .map((voice) => ({ voice, score: scoreVoice(voice, lang) }))
            .filter((entry) => entry.score >= 0)
            .sort((a, b) => b.score - a.score)[0];
          if (best) utterance.voice = best.voice;

          utterance.rate = 1.02;
          utterance.pitch = 1;
          utterance.volume = 1;

          utterance.onstart = () => setSpeaking(true);
          utterance.onend = () => {
            setSpeaking(false);
            clearTimers();
          };
          utterance.onerror = () => {
            setSpeaking(false);
            clearTimers();
          };

          utteranceRef.current = utterance;
          setSpeaking(true);
          synth.speak(utterance);

          keepAliveRef.current = setInterval(() => {
            if (synth.speaking && synth.paused) synth.resume();
            if (!synth.speaking) {
              setSpeaking(false);
              clearTimers();
            }
          }, RESUME_INTERVAL_MS);
        } catch (error) {
          console.warn("Speech synthesis failed", error);
          setSpeaking(false);
        }
      }, CANCEL_SETTLE_MS);
    },
    [clearTimers, enabled, lang],
  );

  useEffect(() => cancel, [cancel]);

  return { speak, cancel, speaking, voiceName };
}
