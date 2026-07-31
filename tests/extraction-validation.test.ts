import { describe, expect, it } from "vitest";
import { parseExtractionRequest } from "../src/main/extraction/validation";
import { parsePageSelection } from "../src/shared/extraction";

describe("parsePageSelection", () => {
  it("expande rangos entre parentesis y paginas sueltas", () => {
    expect(parsePageSelection("(4-8),15")).toEqual([4, 5, 6, 7, 8, 15]);
  });

  it("ordena y deduplica paginas mezcladas", () => {
    expect(parsePageSelection("15,(4-8),6")).toEqual([4, 5, 6, 7, 8, 15]);
  });

  it("rechaza rangos sin parentesis", () => {
    expect(parsePageSelection("4-8,15")).toEqual([]);
  });
});

describe("parseExtractionRequest", () => {
  it("normaliza paginas ordenando y deduplicando", () => {
    const result = parseExtractionRequest({
      bookcode: "00119000",
      pages: [3, 1, 3, 2],
    });

    expect(result.pages).toEqual([1, 2, 3]);
  });

  it("acepta paginas como rango textual", () => {
    const result = parseExtractionRequest({
      bookcode: "00119000",
      pages: "(4-8),15",
    });

    expect(result.pages).toEqual([4, 5, 6, 7, 8, 15]);
  });

  it("rechaza requests sin bookcode ni title", () => {
    expect(() => parseExtractionRequest({ pages: [1] })).toThrow();
  });

  it("rechaza mas de 250 paginas unicas", () => {
    expect(() =>
      parseExtractionRequest({
        bookcode: "00119000",
        pages: Array.from({ length: 251 }, (_, index) => index + 1),
      }),
    ).toThrow("máximo de 250 páginas");
  });
});
