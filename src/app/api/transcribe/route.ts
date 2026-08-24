import { NextResponse } from "next/server";

export const runtime = "nodejs";
/** Whisper calls are short but not instant; give them room. */
export const maxDuration = 60;

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3";
const MAX_BYTES = 24 * 1024 * 1024;
const SUPPORTED_LANGUAGES = new Set(["en", "hi"]);

/**
 * A short prompt biases Whisper towards the vocabulary this app cares about.
 * It measurably improves recall of Indian grocery terms and command verbs.
 */
const DOMAIN_PROMPTS: Record<string, string> = {
  en: "Shopping list commands: add, remove, buy, find, clear my list. Groceries: milk, bread, eggs, apples, bananas, onion, potato, tomato, rice, atta, dal, paneer, curd, ghee, toothpaste, shampoo, detergent.",
  hi: "खरीदारी की सूची: जोड़ो, हटाओ, चाहिए, ढूंढो, लिस्ट। सामान: दूध, ब्रेड, अंडे, सेब, केला, प्याज, आलू, टमाटर, चावल, आटा, दाल, पनीर, दही, घी, टूथपेस्ट, शैम्पू।",
};

interface GroqSegment {
  text?: string;
  no_speech_prob?: number;
  avg_logprob?: number;
}

interface GroqTranscription {
  text?: string;
  segments?: GroqSegment[];
  error?: { message?: string };
}

/**
 * Whisper hallucinates stock phrases when handed silence or noise — usually
 * fragments of the subtitle corpora it was trained on. The domain prompt makes
 * it *confident* about those, so no_speech_prob alone is not enough and
 * avg_logprob has to carry the decision.
 *
 * Measured on this endpoint: silence scores no_speech 0.17 / avg_logprob -1.04,
 * real speech scores 0.002 / -0.24.
 */
const HALLUCINATION_PATTERNS = [
  /^you$/,
  /^thank(s| you)\.?$/,
  /^(bye|okay|oh|hmm|uh|um)$/,
  /thank(s| you)? for watching/,
  /please subscribe/,
  /subscribe to (our|the) channel/,
  /amara\.?org/,
  /transcription by/,
  /subtitles? by/,
  /^(धन्यवाद|शुक्रिया)$/,
];

/** Above this the model itself reports the clip contains no speech. */
const NO_SPEECH_LIMIT = 0.6;
/** Whisper's own "failed decode" heuristic sits at -1.0; -0.95 adds margin. */
const LOW_CONFIDENCE_LOGPROB = -0.95;

/** Letters or digits in any script, so Devanagari counts as real content. */
function hasRealContent(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}

function isLikelySilence(text: string, segments: GroqSegment[] | undefined): boolean {
  if (!hasRealContent(text)) return true;

  const stripped = text
    .toLowerCase()
    .replace(/[.,!?;:"'`\-–—…।॥]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return true;
  if (HALLUCINATION_PATTERNS.some((pattern) => pattern.test(stripped))) return true;

  if (!segments?.length) return false;
  if (segments.every((segment) => (segment.no_speech_prob ?? 0) > NO_SPEECH_LIMIT)) return true;

  const scored = segments.filter((segment) => typeof segment.avg_logprob === "number");
  if (!scored.length) return false;
  const meanLogprob = scored.reduce((sum, segment) => sum + (segment.avg_logprob ?? 0), 0) / scored.length;
  return meanLogprob < LOW_CONFIDENCE_LOGPROB;
}

function fail(message: string, status: number, code: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/** Accepts a recorded audio clip and returns the Whisper large-v3 transcript. */
export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return fail(
      "Speech recognition is not configured. Add GROQ_API_KEY to .env.local and restart the server.",
      503,
      "missing_key",
    );
  }

  let audio: File;
  let language: string;
  try {
    const form = await request.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) return fail("An 'audio' file field is required.", 400, "bad_request");
    audio = file;
    const requested = String(form.get("language") ?? "en");
    language = SUPPORTED_LANGUAGES.has(requested) ? requested : "en";
  } catch {
    return fail("Could not read the uploaded audio.", 400, "bad_request");
  }

  if (audio.size === 0) return fail("The recording was empty.", 400, "empty_audio");
  if (audio.size > MAX_BYTES) return fail("That recording is too long.", 413, "too_large");

  const upstream = new FormData();
  upstream.set("file", audio, audio.name || "speech.webm");
  upstream.set("model", MODEL);
  upstream.set("language", language);
  upstream.set("response_format", "verbose_json");
  upstream.set("temperature", "0");
  upstream.set("prompt", DOMAIN_PROMPTS[language] ?? DOMAIN_PROMPTS.en);

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
      signal: AbortSignal.timeout(45_000),
    });

    const payload = (await response.json().catch(() => ({}))) as GroqTranscription;

    if (!response.ok) {
      const detail = payload.error?.message ?? `Groq responded with ${response.status}`;
      console.error("Whisper transcription failed", response.status, detail);
      if (response.status === 401) return fail("The Groq API key was rejected.", 502, "bad_key");
      if (response.status === 429) return fail("Rate limited by Groq — wait a moment.", 429, "rate_limited");
      return fail("Transcription failed upstream.", 502, "upstream_error");
    }

    const text = (payload.text ?? "").trim();
    // An empty string tells the client "no speech", which it reports gently
    // instead of pushing a nonsense command through the parser.
    const usable = isLikelySilence(text, payload.segments) ? "" : text;
    return NextResponse.json({ text: usable, model: MODEL, language });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error("Whisper transcription errored", error);
    return fail(
      timedOut ? "Transcription timed out." : "Could not reach the transcription service.",
      504,
      timedOut ? "timeout" : "network",
    );
  }
}
