export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface Strength {
  bits: number;
  level: StrengthLevel;
  crackTime: string; // localized later via key
  crackSeconds: number;
}

const COMMON = new Set(
  "123456 123456789 12345678 password qwerty 111111 12345 1234567 123123 abc123 password1 iloveyou admin welcome monkey dragon letmein football 000000 qwerty123 1q2w3e4r sifre parola galatasaray fenerbahce besiktas trabzonspor".split(
    " ",
  ),
);

/** Heuristic entropy estimate for a user-typed password (pools + pattern penalties). */
export function estimateBits(pw: string): number {
  if (!pw) return 0;
  if (COMMON.has(pw.toLowerCase())) return 4;
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  // Effective length: penalize repeats and sequences.
  let eff = 0;
  for (let i = 0; i < pw.length; i++) {
    const c = pw.charCodeAt(i);
    const p = pw.charCodeAt(i - 1);
    const pp = pw.charCodeAt(i - 2);
    if (i > 0 && c === p) eff += 0.25;
    else if (i > 1 && c - p === p - pp && Math.abs(c - p) === 1) eff += 0.35;
    else eff += 1;
  }
  const unique = new Set(pw).size;
  const diversity = Math.min(1, unique / Math.max(4, pw.length * 0.6));
  return eff * Math.log2(Math.max(pool, 2)) * (0.5 + 0.5 * diversity);
}

export function levelFromBits(bits: number): StrengthLevel {
  if (bits < 36) return 0;
  if (bits < 52) return 1;
  if (bits < 70) return 2;
  if (bits < 100) return 3;
  return 4;
}

/** Offline attack at 1e10 guesses/s, average case (half the keyspace). */
export function crackSeconds(bits: number): number {
  return 2 ** (bits - 1) / 1e10;
}

export function strengthOf(bits: number): Strength {
  const s = crackSeconds(bits);
  return { bits, level: levelFromBits(bits), crackSeconds: s, crackTime: "" };
}
