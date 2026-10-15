import { describe, expect, it } from "vitest";
import { encryptJSON, newKeyMaterial, unlockBlob, WrongPasswordError } from "../src/lib/crypto";
import { DEFAULT_OPTIONS, generatePassphrase, generatePassword, generatePin, generatorEntropy } from "../src/lib/generator";
import { randomInt } from "../src/lib/random";
import { estimateBits, levelFromBits } from "../src/lib/strength";
import { parseCSV, reuseCounts, toCSV, type Entry } from "../src/lib/vault";

describe("generator", () => {
  it("respects length and includes every enabled class", () => {
    for (let i = 0; i < 200; i++) {
      const p = generatePassword({ ...DEFAULT_OPTIONS.password, length: 12 });
      expect(p).toHaveLength(12);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).toMatch(/[^a-zA-Z0-9]/);
      expect(p).not.toMatch(/[Il1O0o]/);
    }
  });
  it("only uses enabled classes", () => {
    const p = generatePassword({ length: 50, lower: false, upper: false, digits: true, symbols: false, avoidAmbiguous: false });
    expect(p).toMatch(/^[0-9]{50}$/);
  });
  it("returns empty when nothing enabled", () => {
    expect(generatePassword({ length: 10, lower: false, upper: false, digits: false, symbols: false, avoidAmbiguous: false })).toBe("");
  });
  it("passphrase and pin shapes", () => {
    expect(generatePassphrase({ words: 4, separator: "-", capitalize: false, includeNumber: false }).split("-")).toHaveLength(4);
    expect(generatePin({ length: 6 })).toMatch(/^\d{6}$/);
  });
  it("entropy is sane", () => {
    expect(generatorEntropy(DEFAULT_OPTIONS)).toBeGreaterThan(110);
    expect(generatorEntropy({ ...DEFAULT_OPTIONS, mode: "passphrase" })).toBeGreaterThan(55);
  });
  it("randomInt is unbiased-ish", () => {
    const counts = new Array(6).fill(0);
    for (let i = 0; i < 60000; i++) counts[randomInt(6)]++;
    for (const c of counts) expect(Math.abs(c - 10000)).toBeLessThan(500);
  });
});

describe("strength", () => {
  it("ranks common/weak vs strong", () => {
    expect(levelFromBits(estimateBits("password"))).toBe(0);
    expect(levelFromBits(estimateBits("aaaaaaaa"))).toBe(0);
    expect(levelFromBits(estimateBits("Xk#9vQ!2pL@7wR$m"))).toBeGreaterThanOrEqual(3);
  });
});

describe("crypto", () => {
  it("round-trips and rejects wrong password", async () => {
    const km = await newKeyMaterial("correct horse");
    const blob = await encryptJSON(km, { hello: "dünya" });
    const { value } = await unlockBlob<{ hello: string }>(blob, "correct horse");
    expect(value.hello).toBe("dünya");
    await expect(unlockBlob(blob, "wrong")).rejects.toBeInstanceOf(WrongPasswordError);
  }, 30_000);
});

describe("csv", () => {
  it("parses chrome export with quotes and round-trips", () => {
    const csv = 'name,url,username,password,note\n"Git, Hub",https://github.com,me,"p""w,1",\nx,,u,p2,"multi\nline"\n';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ title: "Git, Hub", password: 'p"w,1' });
    expect(rows[1].notes).toBe("multi\nline");
    const entries = rows.map((r, i) => ({ ...r, id: String(i), tags: [] }) as unknown as Entry);
    expect(parseCSV(toCSV(entries))).toEqual(rows);
  });
  it("counts reuse", () => {
    const m = reuseCounts([{ password: "a" }, { password: "a" }, { password: "b" }] as Entry[]);
    expect(m.get("a")).toBe(2);
  });
});
