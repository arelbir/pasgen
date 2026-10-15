import { wordlist } from "@scure/bip39/wordlists/english.js";
import { pick, randomInt, shuffle } from "./random";

export type Mode = "password" | "passphrase" | "pin";

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
}

export interface PassphraseOptions {
  words: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
}

export interface PinOptions {
  length: number;
}

export interface GeneratorOptions {
  mode: Mode;
  password: PasswordOptions;
  passphrase: PassphraseOptions;
  pin: PinOptions;
}

export const DEFAULT_OPTIONS: GeneratorOptions = {
  mode: "password",
  password: { length: 20, lower: true, upper: true, digits: true, symbols: true, avoidAmbiguous: true },
  passphrase: { words: 6, separator: "-", capitalize: true, includeNumber: true },
  pin: { length: 6 },
};

const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/~",
} as const;

const AMBIGUOUS = new Set("Il1O0o|`'\"");

function charsets(o: PasswordOptions): string[] {
  const keys = (["lower", "upper", "digits", "symbols"] as const).filter((k) => o[k]);
  return keys
    .map((k) => (o.avoidAmbiguous ? [...SETS[k]].filter((c) => !AMBIGUOUS.has(c)).join("") : SETS[k]))
    .filter((s) => s.length > 0);
}

export function generatePassword(o: PasswordOptions): string {
  const sets = charsets(o);
  if (sets.length === 0) return "";
  const all = sets.join("");
  const length = Math.max(o.length, sets.length);
  // Guarantee at least one char from every enabled set, then fill and shuffle.
  const chars = sets.map((s) => pick([...s]));
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  return shuffle(chars).join("");
}

export function generatePassphrase(o: PassphraseOptions): string {
  const words = Array.from({ length: o.words }, () => {
    const w = pick(wordlist);
    return o.capitalize ? w[0].toUpperCase() + w.slice(1) : w;
  });
  if (o.includeNumber) {
    const i = randomInt(words.length);
    words[i] = words[i] + randomInt(10);
  }
  return words.join(o.separator);
}

export function generatePin(o: PinOptions): string {
  return Array.from({ length: o.length }, () => randomInt(10)).join("");
}

export function generate(o: GeneratorOptions): string {
  switch (o.mode) {
    case "password":
      return generatePassword(o.password);
    case "passphrase":
      return generatePassphrase(o.passphrase);
    case "pin":
      return generatePin(o.pin);
  }
}

/** Exact entropy (bits) of the generation process for the chosen options. */
export function generatorEntropy(o: GeneratorOptions): number {
  switch (o.mode) {
    case "password": {
      const pool = charsets(o.password).join("").length;
      return pool ? Math.max(o.password.length, 1) * Math.log2(pool) : 0;
    }
    case "passphrase": {
      const base = o.passphrase.words * Math.log2(wordlist.length);
      const num = o.passphrase.includeNumber ? Math.log2(10 * o.passphrase.words) : 0;
      return base + num;
    }
    case "pin":
      return o.pin.length * Math.log2(10);
  }
}
