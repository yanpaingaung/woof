import { describe, expect, it } from "vitest";
import { decodeFromWoof, detectLanguage, encodeToWoof, translate } from "./woof";

describe("encodeToWoof", () => {
  it("encodes a single letter", () => {
    expect(encodeToWoof("A")).toBe("Woof");
  });

  it("is case-insensitive", () => {
    expect(encodeToWoof("a")).toBe(encodeToWoof("A"));
  });

  it("encodes spaces as the underscore token", () => {
    expect(encodeToWoof("HI THERE")).toBe(
      "wOOf wOoF _ wooF! wOOf WOof wOof! WOof"
    );
  });

  it("passes through punctuation untouched", () => {
    expect(encodeToWoof("HI!")).toBe("wOOf wOoF !");
  });

  it("encodes a newline as the double-underscore token", () => {
    expect(encodeToWoof("Hi\nBye")).toBe("wOOf wOoF __ wOof wOoF! WOof");
  });

  it("encodes a blank line as two consecutive newline tokens", () => {
    expect(encodeToWoof("Hi\n\nBuild on Base")).toBe(
      [
        "wOOf",
        "wOoF",
        "__",
        "__",
        "wOof",
        "WOof!",
        "wOoF",
        "WOoF",
        "wooF",
        "_",
        "WOOF",
        "wOOF",
        "_",
        "wOof",
        "Woof",
        "woOf!",
        "WOof",
      ].join(" ")
    );
  });
});

describe("decodeFromWoof", () => {
  it("decodes a single woof code", () => {
    expect(decodeFromWoof("Woof").text).toBe("A");
  });

  it("decodes the underscore token back into a space", () => {
    const { text } = decodeFromWoof("Woof _ wOof");
    expect(text).toBe("A B");
  });

  it("flags unrecognized tokens instead of throwing", () => {
    const result = decodeFromWoof("Woof bogus wOof");
    expect(result.text).toBe("AbogusB");
    expect(result.invalidTokens).toEqual(["bogus"]);
  });

  it("decodes the double-underscore token back into a newline", () => {
    const { text } = decodeFromWoof("wOOf wOoF __ wOof wOoF! WOof");
    expect(text).toBe("HI\nBYE");
  });

  it("round-trips arbitrary text through encode and decode", () => {
    const original = "HELLO WORLD";
    const { text, invalidTokens } = decodeFromWoof(encodeToWoof(original));
    expect(text).toBe(original);
    expect(invalidTokens).toHaveLength(0);
  });

  it("round-trips multi-line text including blank lines", () => {
    const original = "HI\n\nBUILD ON BASE";
    const { text, invalidTokens } = decodeFromWoof(encodeToWoof(original));
    expect(text).toBe(original);
    expect(invalidTokens).toHaveLength(0);
  });
});

describe("detectLanguage", () => {
  it("detects plain English text", () => {
    expect(detectLanguage("Hello there")).toBe("english");
  });

  it("detects Woof text made only of w/o/f/!/_ tokens", () => {
    expect(detectLanguage("Woof wOof _ woOf!")).toBe("woof");
  });

  it("treats empty input as English", () => {
    expect(detectLanguage("   ")).toBe("english");
  });

  it("does not flip to Woof on a bare 'w' keystroke", () => {
    expect(detectLanguage("w")).toBe("english");
  });

  it("does not flip to Woof while a word is only partially typed", () => {
    expect(detectLanguage("wo")).toBe("english");
    expect(detectLanguage("woo")).toBe("english");
  });

  it("keeps an in-progress sentence English even if an earlier word is woof-shaped", () => {
    expect(detectLanguage("wow w")).toBe("english");
  });
});

describe("translate", () => {
  it("auto-translates English input into Woof", () => {
    const result = translate("Hi");
    expect(result.direction).toBe("english");
    expect(result.output).toBe(encodeToWoof("Hi"));
  });

  it("auto-translates Woof input into English", () => {
    const result = translate(encodeToWoof("Hi"));
    expect(result.direction).toBe("woof");
    expect(result.output).toBe("HI");
  });
});
