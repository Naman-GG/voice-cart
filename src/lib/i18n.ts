import type { Lang } from "./types";

export const LANGUAGES: { code: Lang; label: string; nativeLabel: string; speechCode: string }[] = [
  { code: "en", label: "English", nativeLabel: "English", speechCode: "en-US" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", speechCode: "hi-IN" },
];

type Dict = Record<Lang, string>;

export const T = {
  appName: { en: "Voice Cart", hi: "वॉइस कार्ट" },
  tagline: { en: "Speak your shopping list", hi: "बोलिए, लिस्ट बन जाएगी" },
  tapToSpeak: { en: "Tap to speak", hi: "बोलने के लिए दबाएँ" },
  listening: { en: "Listening…", hi: "सुन रहे हैं…" },
  processing: { en: "Working on it…", hi: "प्रोसेस हो रहा है…" },
  stop: { en: "Stop", hi: "रोकें" },
  typeInstead: { en: "or type a command", hi: "या कमांड टाइप करें" },
  send: { en: "Send", hi: "भेजें" },
  yourList: { en: "Your list", hi: "आपकी लिस्ट" },
  emptyList: { en: "Nothing here yet", hi: "अभी लिस्ट खाली है" },
  emptyHint: { en: "Try saying “Add 2 litres of milk”", hi: "बोलिए “दो लीटर दूध जोड़ो”" },
  suggestions: { en: "Smart suggestions", hi: "स्मार्ट सुझाव" },
  searchResults: { en: "Search results", hi: "खोज परिणाम" },
  noResults: { en: "No matching products", hi: "कोई उत्पाद नहीं मिला" },
  clearSearch: { en: "Clear search", hi: "खोज हटाएँ" },
  items: { en: "items", hi: "चीज़ें" },
  estimatedTotal: { en: "Est. total", hi: "अनुमानित कुल" },
  clearAll: { en: "Clear all", hi: "सब हटाएँ" },
  undo: { en: "Undo", hi: "वापस" },
  add: { en: "Add", hi: "जोड़ें" },
  swap: { en: "Swap", hi: "बदलें" },
  onSale: { en: "On sale", hi: "सेल पर" },
  inSeason: { en: "In season", hi: "मौसमी" },
  organic: { en: "Organic", hi: "ऑर्गेनिक" },
  language: { en: "Language", hi: "भाषा" },
  voiceReplies: { en: "Voice replies", hi: "आवाज़ में जवाब" },
  history: { en: "Recent commands", hi: "हाल की कमांड" },
  helpTitle: { en: "What you can say", hi: "आप क्या बोल सकते हैं" },
  helpHint: {
    en: "Tap any line to run it, or say it out loud.",
    hi: "किसी भी लाइन को दबाएँ, या बोलकर आज़माएँ।",
  },
  close: { en: "Close", hi: "बंद करें" },
  tryTheseCommands: { en: "Try saying", hi: "ऐसे बोलें" },
  micUnsupported: {
    en: "This browser cannot record audio. Chrome, Edge or Safari work best — you can still type commands below.",
    hi: "यह ब्राउज़र ऑडियो रिकॉर्ड नहीं कर सकता। Chrome, Edge या Safari आज़माएँ — आप नीचे टाइप भी कर सकते हैं।",
  },
  micDenied: {
    en: "Microphone access was blocked. Enable it in your browser settings to use voice.",
    hi: "माइक्रोफ़ोन की अनुमति नहीं मिली। ब्राउज़र सेटिंग में इसे चालू करें।",
  },
  micError: { en: "Could not reach the microphone. Please try again.", hi: "माइक्रोफ़ोन नहीं मिला। दोबारा कोशिश करें।" },
  micIdleOff: {
    en: "Microphone switched off after a minute of silence. Tap the mic to carry on.",
    hi: "एक मिनट तक कुछ न बोलने पर माइक्रोफ़ोन बंद कर दिया। जारी रखने के लिए माइक दबाएँ।",
  },
  noSpeech: { en: "I didn't catch that — try again.", hi: "समझ नहीं आया — फिर से बोलिए।" },
  transcribeFailed: {
    en: "Transcription failed. Check your connection and try again.",
    hi: "ट्रांसक्रिप्शन विफल रहा। कनेक्शन जाँचें और फिर कोशिश करें।",
  },
  transcribeUnconfigured: {
    en: "Speech recognition isn't configured. Add GROQ_API_KEY to .env.local and restart the server.",
    hi: "स्पीच पहचान सेट नहीं है। .env.local में GROQ_API_KEY जोड़कर सर्वर दोबारा शुरू करें।",
  },

  // Live capture states
  statusIdle: { en: "Tap to speak", hi: "बोलने के लिए दबाएँ" },
  statusOpening: { en: "Starting the microphone…", hi: "माइक्रोफ़ोन शुरू हो रहा है…" },
  statusListening: { en: "Listening — just start talking", hi: "सुन रहे हैं — बस बोलिए" },
  statusRecording: { en: "Recording…", hi: "रिकॉर्ड हो रहा है…" },
  statusTranscribing: { en: "Transcribing with Whisper…", hi: "व्हिस्पर से समझ रहे हैं…" },
  statusSpeaking: { en: "Speaking…", hi: "बोल रहे हैं…" },
  handsFree: { en: "Hands-free", hi: "हैंड्स-फ़्री" },
  handsFreeStop: { en: "Stop listening", hi: "सुनना बंद करें" },
  handsFreeIdleHint: { en: "or go hands-free", hi: "या हैंड्स-फ़्री चालू करें" },
  handsFreeHint: {
    en: "Hands-free is on — speak any time, no tapping needed.",
    hi: "हैंड्स-फ़्री चालू है — कभी भी बोलिए, दबाने की ज़रूरत नहीं।",
  },
  poweredBy: { en: "Whisper large-v3", hi: "व्हिस्पर large-v3" },
  usuallyBuy: { en: "You usually buy", hi: "आप आमतौर पर लेते हैं" },
  addIt: { en: "Yes, add it", hi: "हाँ, जोड़ें" },
  notNow: { en: "Not now", hi: "अभी नहीं" },
} satisfies Record<string, Dict>;

export type TranslationKey = keyof typeof T;

export function t(key: TranslationKey, lang: Lang): string {
  return T[key][lang];
}

/** Localised example commands shown as tappable chips. */
export const EXAMPLE_COMMANDS: Record<Lang, string[]> = {
  en: [
    "Add 2 litres of milk",
    "I need apples and bread",
    "Remove milk from my list",
    "Find organic apples",
    "Find toothpaste under $5",
    "What's on my list",
  ],
  hi: [
    "दो लीटर दूध जोड़ो",
    "मुझे सेब और ब्रेड चाहिए",
    "दूध हटा दो",
    "टूथपेस्ट ढूंढो",
    "पाँच किलो चावल चाहिए",
    "लिस्ट में क्या है",
  ],
};

/** Grouped command reference shown by the "help" command. */
export const COMMAND_REFERENCE: Record<
  Lang,
  { group: string; examples: string[] }[]
> = {
  en: [
    { group: "Add", examples: ["Add milk", "I need 2 kg apples", "Add bread and 6 eggs", "Buy 2 bottles of water"] },
    { group: "Change", examples: ["Remove milk from my list", "Change milk to 3", "I bought the eggs", "Clear my list"] },
    { group: "Find", examples: ["Find organic apples", "Find toothpaste under $5", "Show me juice between $2 and $4"] },
    { group: "Ask", examples: ["What's on my list", "How much is milk", "Undo"] },
  ],
  hi: [
    { group: "जोड़ें", examples: ["दूध जोड़ो", "मुझे दो किलो सेब चाहिए", "ब्रेड और छह अंडे जोड़ो", "दो बोतल पानी लेना है"] },
    { group: "बदलें", examples: ["दूध हटा दो", "दूध तीन कर दो", "अंडे खरीद लिए", "पूरी लिस्ट हटाओ"] },
    { group: "खोजें", examples: ["टूथपेस्ट ढूंढो", "चीनी की कीमत क्या है", "ऑर्गेनिक सेब ढूंढो"] },
    { group: "पूछें", examples: ["लिस्ट में क्या है", "वापस करो"] },
  ],
};

export function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}
