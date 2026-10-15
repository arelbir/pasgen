export interface Entry {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  tags: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  passwordUpdatedAt: number;
}

export interface HistoryItem {
  value: string;
  at: number;
}

export interface VaultData {
  entries: Entry[];
  history: HistoryItem[];
}

export const EMPTY_VAULT: VaultData = { entries: [], history: [] };

export function newId(): string {
  return crypto.randomUUID();
}

export function hostOf(url: string): string {
  if (!url) return "";
  try {
    return new URL(/^[a-z]+:\/\//i.test(url) ? url : "https://" + url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Map of password -> number of entries using it (for reuse detection). */
export function reuseCounts(entries: Entry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) if (e.password) m.set(e.password, (m.get(e.password) ?? 0) + 1);
  return m;
}

/** Parse a browser-exported CSV (Chrome/Firefox/Bitwarden-ish columns). */
export function parseCSV(text: string): Partial<Entry>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!head) return [];
  const h = head.map((x) => x.trim().toLowerCase());
  const col = (...names: string[]) => h.findIndex((x) => names.includes(x));
  const ci = {
    title: col("name", "title"),
    url: col("url", "login_uri", "website"),
    username: col("username", "login_username", "user", "email"),
    password: col("password", "login_password"),
    notes: col("note", "notes", "extra"),
  };
  return body
    .map((r) => ({
      title: r[ci.title] ?? "",
      url: r[ci.url] ?? "",
      username: r[ci.username] ?? "",
      password: r[ci.password] ?? "",
      notes: r[ci.notes] ?? "",
    }))
    .filter((e) => e.password || e.username);
}

export function toCSV(entries: Entry[]): string {
  const esc = (s: string) => (/[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
  const lines = ["name,url,username,password,note"];
  for (const e of entries) lines.push([e.title, e.url, e.username, e.password, e.notes].map(esc).join(","));
  return lines.join("\n");
}
