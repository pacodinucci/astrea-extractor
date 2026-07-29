import { describe, expect, it } from "vitest";
import { parseExtractionRequest } from "../src/main/extraction/validation";

describe("parseExtractionRequest", () => {
  it("normaliza páginas ordenando y deduplicando", () => {
    const result = parseExtractionRequest({
      bookcode: "00119000",
      pages: [3, 1, 3, 2],
    });

    expect(result.pages).toEqual([1, 2, 3]);
  });

  it("rechaza requests sin bookcode ni title", () => {
    expect(() => parseExtractionRequest({ pages: [1] })).toThrow();
  });

  it("rechaza más de 100 páginas únicas", () => {
    expect(() =>
      parseExtractionRequest({
        bookcode: "00119000",
        pages: Array.from({ length: 101 }, (_, index) => index + 1),
      }),
    ).toThrow("máximo de 100 páginas");
  });
});
