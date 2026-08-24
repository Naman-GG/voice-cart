"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { CommandBar } from "@/components/CommandBar";
import { FeedbackBanner } from "@/components/FeedbackBanner";
import { Header } from "@/components/Header";
import { MicButton } from "@/components/MicButton";
import { SearchPanel } from "@/components/SearchPanel";
import { SuggestionRail } from "@/components/SuggestionRail";
import { useSpeechRecognition, type RecognitionErrorCode } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { LANGUAGES, T } from "@/lib/i18n";
import { parseCommand } from "@/lib/nlp/parser";
import { searchCatalog } from "@/lib/search";
import { searchFeedback } from "@/lib/search-feedback";
import { ShoppingList } from "@/components/ShoppingList";
import { buildSuggestions } from "@/lib/suggestions";
import {
  initialState,
  loadPersisted,
  persist,
  reducer,
  type Feedback,
} from "@/lib/store";
import type { SearchFilters, SearchResult } from "@/lib/types";

const ERROR_FEEDBACK: Record<RecognitionErrorCode, keyof typeof T> = {
  unsupported: "micUnsupported",
  denied: "micDenied",
  "no-speech": "noSpeech",
  audio: "micError",
  network: "micError",
  unknown: "micError",
};

export default function Page() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [handsFree, setHandsFree] = useState(false);
  const searchToken = useRef(0);
  const hydrated = state.hydrated;
  // Captured once at hydration so suggestion ranking stays render-pure.
  const now = state.hydratedAt;

  const speechCode = LANGUAGES.find((option) => option.code === state.lang)?.speechCode ?? "en-US";
  const { speak, cancel } = useSpeechSynthesis(speechCode, state.speakReplies);

  // Restore the saved list before the first paint of real content.
  useEffect(() => {
    dispatch({ type: "hydrate", payload: { ...loadPersisted(), hydratedAt: Date.now() } });
  }, []);

  useEffect(() => {
    if (hydrated) persist(state);
  }, [hydrated, state]);

  const runSearch = useCallback(async (filters: SearchFilters) => {
    const token = ++searchToken.current;
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });
      if (!response.ok) throw new Error(`Search failed with ${response.status}`);
      const data = (await response.json()) as { results: SearchResult[] };
      if (token !== searchToken.current) return;
      dispatch({
        type: "search-results",
        filters,
        results: data.results,
        feedback: searchFeedback(filters, data.results, false),
      });
    } catch (error) {
      // The catalog also lives client-side, so search still works offline.
      console.warn("Falling back to local search", error);
      if (token !== searchToken.current) return;
      const results = searchCatalog(filters);
      dispatch({
        type: "search-results",
        filters,
        results,
        feedback: searchFeedback(filters, results, true),
      });
    }
  }, []);

  const handleTranscript = useCallback(
    (transcript: string) => {
      const command = parseCommand(transcript, state.lang);
      dispatch({ type: "command", command, at: Date.now() });
      if (command.intent === "search" && command.filters) void runSearch(command.filters);
    },
    [runSearch, state.lang],
  );

  const handleRecognitionError = useCallback(
    (code: RecognitionErrorCode) => {
      const key = ERROR_FEEDBACK[code];
      const feedback: Feedback = {
        tone: code === "no-speech" ? "warning" : "error",
        message: T[key],
      };
      dispatch({ type: "set-feedback", feedback });
    },
    [],
  );

  const { supported, listening, interim, toggle, stop } = useSpeechRecognition({
    lang: speechCode,
    handsFree,
    onResult: handleTranscript,
    onError: handleRecognitionError,
  });

  // Speak every reply except the transient "…" progress messages.
  const lastSpoken = useRef<Feedback | null>(null);
  useEffect(() => {
    const feedback = state.feedback;
    if (!feedback || lastSpoken.current === feedback) return;
    lastSpoken.current = feedback;
    const message = feedback.message[state.lang];
    if (message.endsWith("…")) return;
    speak(message);
  }, [speak, state.feedback, state.lang]);

  useEffect(() => () => cancel(), [cancel]);

  // "m" anywhere outside a text field toggles the microphone.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (event.key.toLowerCase() !== "m" || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const suggestions = useMemo(
    () => (now === null ? [] : buildSuggestions({ list: state.items, history: state.history, now })),
    [now, state.history, state.items],
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
      <Header
        lang={state.lang}
        speakReplies={state.speakReplies}
        handsFree={handsFree}
        onLangChange={(lang) => {
          stop();
          dispatch({ type: "set-lang", lang });
        }}
        onSpeakChange={(value) => dispatch({ type: "set-speak", value })}
        onHandsFreeChange={setHandsFree}
      />

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="rounded-3xl border border-line bg-surface px-5 py-7 shadow-[var(--shadow)]">
            <MicButton
              listening={listening}
              disabled={!supported}
              lang={state.lang}
              interim={interim}
              onToggle={toggle}
            />
            {!supported && hydrated && (
              <p className="mx-auto mt-4 max-w-sm text-center text-xs leading-relaxed text-text-muted">
                {T.micUnsupported[state.lang]}
              </p>
            )}
          </section>

          <FeedbackBanner
            feedback={state.feedback}
            lang={state.lang}
            onDismiss={() => dispatch({ type: "dismiss-feedback" })}
          />

          <CommandBar lang={state.lang} onSubmit={handleTranscript} />

          {hydrated ? (
            <ShoppingList
              items={state.items}
              lang={state.lang}
              canUndo={state.past !== null}
              onToggle={(rowId) => dispatch({ type: "toggle-row", rowId })}
              onRemove={(rowId) => dispatch({ type: "remove-row", rowId })}
              onQuantity={(rowId, delta) => dispatch({ type: "change-quantity", rowId, delta })}
              onAddProduct={(productId) => dispatch({ type: "add-product", productId, at: Date.now() })}
              onClear={() => dispatch({ type: "clear" })}
              onUndo={() => dispatch({ type: "undo" })}
            />
          ) : (
            <ListSkeleton />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {state.search && (
            state.search.loading ? (
              <SearchSkeleton label={T.searchResults[state.lang]} />
            ) : (
              <SearchPanel
                filters={state.search.filters}
                results={state.search.results}
                lang={state.lang}
                onAdd={(productId) => dispatch({ type: "add-product", productId, at: Date.now() })}
                onClose={() => dispatch({ type: "clear-search" })}
              />
            )
          )}

          <SuggestionRail
            suggestions={suggestions}
            lang={state.lang}
            onAdd={(productId) => dispatch({ type: "add-product", productId, at: Date.now() })}
          />

          {state.log.length > 0 && (
            <section aria-label={T.history[state.lang]} className="space-y-2">
              <h2 className="px-1 text-sm font-semibold">{T.history[state.lang]}</h2>
              <ul className="scrollbar-thin max-h-56 space-y-1.5 overflow-y-auto rounded-2xl border border-line bg-surface p-3">
                {state.log.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2 text-xs">
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        entry.tone === "success" ? "bg-accent" : entry.tone === "warning" ? "bg-warning" : "bg-text-muted"
                      }`}
                    />
                    <span className="truncate text-text-muted">“{entry.transcript}”</span>
                    <span className="ml-auto shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
                      {entry.intent.replace("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <footer className="pb-2 pt-4 text-center text-[11px] text-text-muted">
        Voice recognition runs on-device via the Web Speech API. Press <kbd className="rounded border border-line px-1">M</kbd> to toggle the mic.
      </footer>
    </main>
  );
}

function ListSkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-3xl border border-line bg-surface p-5" aria-hidden>
      <div className="h-4 w-28 rounded bg-surface-muted" />
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-full bg-surface-muted" />
          <div className="h-4 flex-1 rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

function SearchSkeleton({ label }: { label: string }) {
  return (
    <section className="space-y-3 rounded-3xl border border-line bg-surface p-4" aria-label={label} aria-busy>
      <div className="h-4 w-24 animate-pulse rounded bg-surface-muted" />
      <div className="grid gap-2 sm:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-14 animate-pulse rounded-2xl bg-surface-muted" />
        ))}
      </div>
    </section>
  );
}
