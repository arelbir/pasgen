import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, FolderLock, Lock, LockOpen, Settings as SettingsIcon, ShieldCheck, Wand2, XCircle } from "lucide-react";
import { Generator } from "./components/Generator";
import { Health } from "./components/Health";
import { LockScreen } from "./components/LockScreen";
import { Settings } from "./components/Settings";
import { DialogProvider } from "./components/ui";
import { Vault } from "./components/Vault";
import type { Draft } from "./components/EntryEditor";
import { I18nContext, makeT, type Key } from "./lib/i18n";
import { prefs } from "./lib/storage";
import { useVault } from "./store";

type Tab = "generator" | "vault" | "health" | "settings";

const TABS: { id: Tab; icon: typeof Wand2; key: Key }[] = [
  { id: "generator", icon: Wand2, key: "nav.generator" },
  { id: "vault", icon: FolderLock, key: "nav.vault" },
  { id: "health", icon: ShieldCheck, key: "nav.health" },
  { id: "settings", icon: SettingsIcon, key: "nav.settings" },
];

export default function App() {
  const v = useVault();
  const { lang, theme } = v.settings;
  const i18n = useMemo(() => ({ t: makeT(lang), lang }), [lang]);
  const { t } = i18n;
  const [tab, setTabState] = useState<Tab>(() => prefs.get("ui", { tab: "generator" as Tab }).tab);
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const setTab = (tb: Tab) => {
    setTabState(tb);
    prefs.set("ui", { tab: tb });
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      root.dataset.theme = dark ? "dark" : "light";
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0a0a0a" : "#ffffff");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l" && v.status === "unlocked") {
        e.preventDefault();
        v.lock();
        v.toast(t("toast.locked"));
      }
      if ((e.ctrlKey || e.metaKey) && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        setTab(TABS[Number(e.key) - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [v, t]);

  const saveGenerated = (password: string) => {
    setPendingDraft({ password });
    setTab("vault");
  };

  const clearPending = useCallback(() => setPendingDraft(null), []);
  const clearFocus = useCallback(() => setFocusId(null), []);

  const needsUnlock = (tab === "vault" || tab === "health") && v.status !== "unlocked";

  return (
    <I18nContext.Provider value={i18n}>
      <DialogProvider>
        <div className="app">
          <aside className="sidebar">
            <div className="brand">
              <img src="./icon.svg" alt="" width={32} height={32} />
              <span>Kasa</span>
            </div>
            <nav className="nav">
              {TABS.map(({ id, icon: Icon, key }, i) => (
                <button key={id} className={"nav-item" + (tab === id ? " is-active" : "")} onClick={() => setTab(id)} title={`${t(key)} (Ctrl+${i + 1})`}>
                  <Icon size={20} />
                  <span>{t(key)}</span>
                  {id === "vault" && v.status === "unlocked" && v.data.entries.length > 0 && <span className="nav-count">{v.data.entries.length}</span>}
                </button>
              ))}
              {v.status === "unlocked" && (
                <button
                  className="nav-item nav-lock"
                  onClick={() => {
                    v.lock();
                    v.toast(t("toast.locked"));
                  }}
                >
                  <Lock size={20} />
                  <span>{t("nav.lock")}</span>
                </button>
              )}
            </nav>
            <div className="sidebar-foot">
              <div className={"vault-status " + v.status}>
                {v.status === "unlocked" ? <LockOpen size={14} /> : <Lock size={14} />}
                <span>{v.status === "unlocked" ? t("status.unlocked") : v.status === "none" ? t("status.none") : t("status.locked")}</span>
              </div>
              {v.status === "unlocked" && (
                <button
                  className="btn block"
                  onClick={() => {
                    v.lock();
                    v.toast(t("toast.locked"));
                  }}
                  title="Ctrl+L"
                >
                  <Lock size={16} /> {t("nav.lock")}
                </button>
              )}
            </div>
          </aside>

          <main className="main">
            {v.status === "loading" ? null : needsUnlock ? (
              <LockScreen />
            ) : tab === "generator" ? (
              <Generator onSave={saveGenerated} />
            ) : tab === "vault" ? (
              <Vault pendingDraft={pendingDraft} clearPending={clearPending} focusId={focusId} clearFocus={clearFocus} />
            ) : tab === "health" ? (
              <Health
                onOpen={(id) => {
                  setFocusId(id);
                  setTab("vault");
                }}
              />
            ) : (
              <Settings />
            )}
          </main>

          <div className="toasts" aria-live="polite">
            {v.toasts.map((x) => (
              <div key={x.id} className={"toast " + (x.tone ?? "ok")}>
                {x.tone === "error" ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                {x.text}
              </div>
            ))}
          </div>
        </div>
      </DialogProvider>
    </I18nContext.Provider>
  );
}
