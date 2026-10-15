import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  encryptJSON,
  isEncryptedBlob,
  newKeyMaterial,
  unlockBlob,
  type EncryptedBlob,
  type KeyMaterial,
} from "./lib/crypto";
import { clipboard, deleteBlob, loadBlob, prefs, saveBlob } from "./lib/storage";
import { EMPTY_VAULT, type VaultData } from "./lib/vault";
import { makeT, type Lang } from "./lib/i18n";

export type Status = "loading" | "none" | "locked" | "unlocked";
export type Theme = "system" | "light" | "dark";

export interface Settings {
  theme: Theme;
  lang: Lang;
  autoLockMin: number; // 0 = never
  clipClearSec: number; // 0 = never
}

const defaultLang: Lang = typeof navigator !== "undefined" && !navigator.language.startsWith("tr") ? "en" : "tr";
const DEFAULT_SETTINGS: Settings = { theme: "system", lang: defaultLang, autoLockMin: 5, clipClearSec: 30 };

interface Toast {
  id: number;
  text: string;
  tone?: "ok" | "error";
}

interface Ctx {
  status: Status;
  data: VaultData;
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
  create: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  update: (fn: (d: VaultData) => VaultData) => Promise<void>;
  changeMaster: (current: string, next: string) => Promise<void>;
  exportBackup: () => Promise<EncryptedBlob | null>;
  restoreBackup: (blob: unknown, password: string) => Promise<void>;
  wipe: () => Promise<void>;
  copy: (text: string, secret?: boolean) => Promise<void>;
  toast: (text: string, tone?: Toast["tone"]) => void;
  toasts: Toast[];
}

const VaultContext = createContext<Ctx | null>(null);

export function useVault(): Ctx {
  const c = useContext(VaultContext);
  if (!c) throw new Error("VaultProvider missing");
  return c;
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<VaultData>(EMPTY_VAULT);
  const [settings, setSettingsState] = useState<Settings>(() => prefs.get("settings", DEFAULT_SETTINGS));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const km = useRef<KeyMaterial | null>(null);
  const dataRef = useRef<VaultData>(EMPTY_VAULT);
  const saveChain = useRef<Promise<void>>(Promise.resolve());

  const t = useMemo(() => makeT(settings.lang), [settings.lang]);

  useEffect(() => {
    loadBlob()
      .then((b) => setStatus(b ? "locked" : "none"))
      .catch(() => setStatus("none"));
  }, []);

  const setSettings = useCallback((p: Partial<Settings>) => {
    setSettingsState((s) => {
      const next = { ...s, ...p };
      prefs.set("settings", next);
      return next;
    });
  }, []);

  const toast = useCallback((text: string, tone?: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.filter((x) => x.text !== text).slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 2600);
  }, []);

  const persist = useCallback((next: VaultData) => {
    // Serialize writes so an older snapshot never overwrites a newer one.
    saveChain.current = saveChain.current.then(async () => {
      if (!km.current) return;
      await saveBlob(await encryptJSON(km.current, next));
    });
    return saveChain.current;
  }, []);

  const applyUnlocked = (k: KeyMaterial, d: VaultData) => {
    km.current = k;
    const merged = { ...EMPTY_VAULT, ...d };
    dataRef.current = merged;
    setData(merged);
    setStatus("unlocked");
  };

  const create = useCallback(
    async (password: string) => {
      const k = await newKeyMaterial(password);
      await saveBlob(await encryptJSON(k, EMPTY_VAULT));
      applyUnlocked(k, EMPTY_VAULT);
    },
    [],
  );

  const unlock = useCallback(async (password: string) => {
    const blob = await loadBlob();
    if (!blob) throw new Error("no-vault");
    const { km: k, value } = await unlockBlob<VaultData>(blob, password);
    applyUnlocked(k, value);
  }, []);

  const lock = useCallback(() => {
    km.current = null;
    dataRef.current = EMPTY_VAULT;
    setData(EMPTY_VAULT);
    setStatus((s) => (s === "unlocked" ? "locked" : s));
  }, []);

  const update = useCallback(
    async (fn: (d: VaultData) => VaultData) => {
      const next = fn(dataRef.current);
      dataRef.current = next;
      setData(next);
      await persist(next);
    },
    [persist],
  );

  const changeMaster = useCallback(
    async (current: string, next: string) => {
      const blob = await loadBlob();
      if (!blob) throw new Error("no-vault");
      await unlockBlob(blob, current); // throws WrongPasswordError
      const k = await newKeyMaterial(next);
      await saveChain.current;
      await saveBlob(await encryptJSON(k, dataRef.current));
      km.current = k;
    },
    [],
  );

  const exportBackup = useCallback(async () => {
    await saveChain.current;
    return loadBlob();
  }, []);

  const restoreBackup = useCallback(async (blob: unknown, password: string) => {
    if (!isEncryptedBlob(blob)) throw new Error("invalid");
    const { km: k, value } = await unlockBlob<VaultData>(blob, password);
    await saveBlob(blob);
    applyUnlocked(k, value);
  }, []);

  const wipe = useCallback(async () => {
    await deleteBlob();
    km.current = null;
    dataRef.current = EMPTY_VAULT;
    setData(EMPTY_VAULT);
    setStatus("none");
  }, []);

  // Clipboard with auto-clear (only clears if the clipboard still holds our value).
  const clipTimer = useRef<number | undefined>(undefined);
  const copy = useCallback(
    async (text: string, secret = true) => {
      await clipboard.write(text);
      const sec = settings.clipClearSec;
      if (secret && sec > 0) {
        window.clearTimeout(clipTimer.current);
        clipTimer.current = window.setTimeout(() => {
          clipboard.clearIf(text).catch(() => {
            /* window not focused; best effort */
          });
        }, sec * 1000);
        toast(t("toast.copiedClear", { n: sec }));
      } else toast(t("toast.copied"));
    },
    [settings.clipClearSec, t, toast],
  );

  // Auto-lock on inactivity.
  useEffect(() => {
    if (status !== "unlocked" || settings.autoLockMin <= 0) return;
    let last = Date.now();
    const bump = () => (last = Date.now());
    const evs = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const iv = window.setInterval(() => {
      if (Date.now() - last > settings.autoLockMin * 60_000) {
        lock();
        toast(t("toast.locked"));
      }
    }, 5000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(iv);
    };
  }, [status, settings.autoLockMin, lock, toast, t]);

  const value: Ctx = {
    status,
    data,
    settings,
    setSettings,
    create,
    unlock,
    lock,
    update,
    changeMaster,
    exportBackup,
    restoreBackup,
    wipe,
    copy,
    toast,
    toasts,
  };
  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}
