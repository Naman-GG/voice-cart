import { NextResponse } from "next/server";
import { searchCatalog } from "@/lib/search";
import type { CategoryId, SearchFilters } from "@/lib/types";

export const runtime = "nodejs";

interface RequestBody {
  filters?: Partial<SearchFilters>;
  limit?: number;
}

function coerceNumber(value: unknown): number | undefined {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined;
}

function coerceFilters(input: Partial<SearchFilters> | undefined): SearchFilters | null {
  if (!input || typeof input.query !== "string") return null;
  return {
    query: input.query.slice(0, 120),
    maxPrice: coerceNumber(input.maxPrice),
    minPrice: coerceNumber(input.minPrice),
    brand: typeof input.brand === "string" ? input.brand.slice(0, 60) : undefined,
    organicOnly: input.organicOnly === true,
    size: typeof input.size === "string" ? input.size.slice(0, 30) : undefined,
    category: typeof input.category === "string" ? (input.category as CategoryId) : undefined,
  };
}

/** Voice-activated catalog search. Keeps the product data server-side. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const filters = coerceFilters(body.filters);
    if (!filters) {
      return NextResponse.json({ error: "A 'filters.query' string is required." }, { status: 400 });
    }
    const limit = Math.min(Math.max(coerceNumber(body.limit) ?? 12, 1), 30);
    return NextResponse.json({ filters, results: searchCatalog(filters, limit) });
  } catch (error) {
    console.error("Search request failed", error);
    return NextResponse.json({ error: "Could not process the search request." }, { status: 500 });
  }
}

/** Convenience GET so the endpoint is easy to try from a browser or curl. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q");
  if (!query) {
    return NextResponse.json({ error: "Provide a ?q= query." }, { status: 400 });
  }
  const filters: SearchFilters = {
    query,
    maxPrice: coerceNumber(params.get("maxPrice")),
    minPrice: coerceNumber(params.get("minPrice")),
    brand: params.get("brand") ?? undefined,
    organicOnly: params.get("organic") === "true",
  };
  return NextResponse.json({ filters, results: searchCatalog(filters) });
}
