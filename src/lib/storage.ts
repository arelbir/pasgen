import type { EncryptedBlob } from "./crypto";

/**
 * Storage backend for the encrypted vault blob.
 * - Desktop (Tauri): a file in the OS app-data dir, written atomically by Rust.
 * - Web: localStorage (the blob is already encrypted; nothing readable is stored).
 */
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const LS_KEY = "kasa.vault.v1";

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export async function loadBlob(): Promise<EncryptedBlob | null> {
  if (isTauri) {
    const raw = await tauriInvoke<string | null>("vault_read");
    return raw ? (JSON.parse(raw) as EncryptedBlob) : null;
  }
  const raw = localStorage.getItem(LS_KEY);
  return raw ? (JSON.parse(raw) as EncryptedBlob) : null;
}

export async function saveBlob(blob: EncryptedBlob): Promise<void> {
  const raw = JSON.stringify(blob);
  if (isTauri) return tauriInvoke("vault_write", { contents: raw });
  localStorage.setItem(LS_KEY, raw);
}

export async function deleteBlob(): Promise<void> {
  if (isTauri) return tauriInvoke("vault_delete");
  localStorage.removeItem(LS_KEY);
}

/** Small, non-secret UI preferences (theme, language, generator options). */
export const prefs = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem("kasa.pref." + key);
      return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem("kasa.pref." + key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

/** Save a file: native "Save as" dialog on desktop, browser download on web. */
export async function downloadFile(name: string, contents: string, type = "application/json"): Promise<void> {
  if (isTauri) {
    await tauriInvoke<boolean>("save_file", { name, contents });
    return;
  }
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = async () => resolve(input.files?.[0] ? await input.files[0].text() : null);
    input.click();
  });
}

/** Clipboard that uses the native clipboard on desktop (no WebKit paste prompts). */
export const clipboard = {
  async write(text: string): Promise<void> {
    if (isTauri) {
      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      return writeText(text);
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  },
  /** Clears the clipboard only if it still holds `text` (don't wipe something the user copied later). */
  async clearIf(text: string): Promise<void> {
    if (isTauri) {
      const { readText, clear } = await import("@tauri-apps/plugin-clipboard-manager");
      const cur = await readText().catch(() => text);
      if (cur === text) await clear();
      return;
    }
    const cur = await navigator.clipboard.readText().catch(() => text);
    if (cur === text) await navigator.clipboard.writeText("");
  },
};
