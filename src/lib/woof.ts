const WOOF_ALPHABET: Record<string, string> = {
  A: "Woof",
  B: "wOof",
  C: "woOf",
  D: "wooF",
  E: "WOof",
  F: "WoOf",
  G: "WooF",
  H: "wOOf",
  I: "wOoF",
  J: "woOF",
  K: "WOOf",
  L: "WOoF",
  M: "WoOF",
  N: "wOOF",
  O: "WOOF",
  P: "woof",
  Q: "Woof!",
  R: "wOof!",
  S: "woOf!",
  T: "wooF!",
  U: "WOof!",
  V: "WoOf!",
  W: "WooF!",
  X: "wOOf!",
  Y: "wOoF!",
  Z: "woOF!",
};

const WOOF_TO_LETTER: Record<string, string> = Object.fromEntries(
  Object.entries(WOOF_ALPHABET).map(([letter, code]) => [code, letter])
);

const SPACE_TOKEN = "_";
const NEWLINE_TOKEN = "__";
const WOOF_SEPARATOR = " ";

/** Translates English text into Woof language. Non-alphabetic, non-space, non-newline characters pass through unchanged. */
export function encodeToWoof(input: string): string {
  return input
    .split("")
    .map((char) => {
      if (char === "\n") return NEWLINE_TOKEN;
      if (char === " ") return SPACE_TOKEN;
      const upper = char.toUpperCase();
      const code = WOOF_ALPHABET[upper];
      return code ?? char;
    })
    .join(WOOF_SEPARATOR);
}

export interface WoofDecodeResult {
  text: string;
  invalidTokens: string[];
}

/** Translates Woof language back into English. Unrecognized tokens are kept as-is and reported in invalidTokens. */
export function decodeFromWoof(input: string): WoofDecodeResult {
  const tokens = input.split(/\s+/).filter((token) => token.length > 0);
  const invalidTokens: string[] = [];

  const text = tokens
    .map((token) => {
      if (token === NEWLINE_TOKEN) return "\n";
      if (token === SPACE_TOKEN) return " ";
      const letter = WOOF_TO_LETTER[token];
      if (letter) return letter;
      invalidTokens.push(token);
      return token;
    })
    .join("");

  return { text, invalidTokens };
}

export type DetectedLanguage = "english" | "woof";

const VALID_WOOF_TOKENS = new Set([
  ...Object.keys(WOOF_TO_LETTER),
  SPACE_TOKEN,
  NEWLINE_TOKEN,
]);

/**
 * Detects whether input is Woof language by requiring every *complete* token
 * (split on whitespace) to be a recognized Woof code. A bare "w" or partially
 * typed token like "wo" never matches a full code, so it stays English while
 * the user is still mid-word instead of flipping the moment a w/o/f is typed.
 */
export function detectLanguage(input: string): DetectedLanguage {
  const trimmed = input.trim();
  if (!trimmed) return "english";

  const tokens = trimmed.split(/\s+/);
  const hasLetterToken = tokens.some((token) => token in WOOF_TO_LETTER);
  const allTokensValid = tokens.every((token) => VALID_WOOF_TOKENS.has(token));

  return hasLetterToken && allTokensValid ? "woof" : "english";
}

export interface WoofTranslation {
  direction: DetectedLanguage;
  output: string;
  invalidTokens: string[];
}

/** Auto-detects the input language and translates it to the other side. */
export function translate(input: string): WoofTranslation {
  const direction = detectLanguage(input);

  if (direction === "woof") {
    const { text, invalidTokens } = decodeFromWoof(input);
    return { direction, output: text, invalidTokens };
  }

  return { direction, output: encodeToWoof(input), invalidTokens: [] };
}
