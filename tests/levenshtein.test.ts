import { describe, it, expect } from "vitest";
import { levenshteinDistance } from "../src/utils/levenshtein.js";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("hello", "hello")).toBe(0);
  });

  it("returns correct distance for single edit", () => {
    expect(levenshteinDistance("SUPABASE_KEY", "SUPABASE_KY")).toBe(1);
  });

  it("returns correct distance for transposition", () => {
    expect(levenshteinDistance("API_KEY", "API_KYE")).toBe(2);
  });

  it("returns full length for empty vs non-empty", () => {
    expect(levenshteinDistance("", "hello")).toBe(5);
  });

  it("handles both empty strings", () => {
    expect(levenshteinDistance("", "")).toBe(0);
  });
});
