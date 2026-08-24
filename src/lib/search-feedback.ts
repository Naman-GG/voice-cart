import type { Feedback } from "./store";
import type { SearchFilters, SearchResult } from "./types";

/** Builds the spoken/visual reply for a completed search. */
export function searchFeedback(
  filters: SearchFilters,
  results: SearchResult[],
  offline: boolean,
): Feedback {
  const label = filters.query || "that";
  if (!results.length) {
    return {
      tone: "warning",
      message: {
        en: `No products matched ${label}.`,
        hi: `${label} के लिए कुछ नहीं मिला।`,
      },
    };
  }
  const suffix = offline ? " (offline results)" : "";
  return {
    tone: "info",
    message: {
      en: `Found ${results.length} option${results.length === 1 ? "" : "s"} for ${label}${suffix}.`,
      hi: `${label} के लिए ${results.length} विकल्प मिले${offline ? " (ऑफ़लाइन)" : ""}।`,
    },
  };
}
