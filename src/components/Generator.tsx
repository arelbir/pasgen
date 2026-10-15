import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, RefreshCw, Save } from "lucide-react";
import { DEFAULT_OPTIONS, generate, generatorEntropy, type GeneratorOptions, type Mode } from "../lib/generator";
import { formatDate, useT } from "../lib/i18n";
import { prefs } from "../lib/storage";
import { useVault } from "../store";
import { PasswordText, Segmented, Slider, StrengthMeter, Toggle } from "./ui";

export function Generator({ onSave }: { onSave: (password: string) => void }) {
  const { t, lang } = useT();
  const { copy, status, data, update } = useVault();
  const [opts, setOpts] = useState<GeneratorOptions>(() => {
    const saved = prefs.get<GeneratorOptions>("generator", DEFAULT_OPTIONS);
    return {
      mode: saved.mode,
      password: { ...DEFAULT_OPTIONS.password, ...saved.password },
      passphrase: { ...DEFAULT_OPTIONS.passphrase, ...saved.passphrase },
      pin: { ...DEFAULT_OPTIONS.pin, ...saved.pin },
    };
  });
  const [value, setValue] = useState(() => generate(opts));
  
  const regen = useCallback(() => {
    setValue(generate(opts));
  }, [opts]);

  useEffect(() => {
    prefs.set("generator", opts);
    setValue(generate(opts));
  }, [opts]);

  const bits = useMemo(() => generatorEntropy(opts), [opts]);
  const noSets = opts.mode === "password" && !["lower", "upper", "digits", "symbols"].some((k) => opts.password[k as "lower"]);

  const doCopy = useCallback(async () => {
    if (!value) return;
    await copy(value);
    if (status === "unlocked") {
      update((d) => ({
        ...d,
        history: [{ value, at: Date.now() }, ...d.history.filter((h) => h.value !== value)].slice(0, 20),
      }));
    }
  }, [value, copy, status, update]);

  // Keyboard: Space regenerates, Ctrl/Cmd+C copies (when nothing else is selected/focused).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable], .modal")) return;
      if (e.code === "Space" && !el.closest("button")) {
        e.preventDefault();
        regen();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
        e.preventDefault();
        doCopy();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [regen, doCopy]);

  const setMode = (mode: Mode) => setOpts((o) => ({ ...o, mode }));
  const setPw = (p: Partial<GeneratorOptions["password"]>) => setOpts((o) => ({ ...o, password: { ...o.password, ...p } }));
  const setPp = (p: Partial<GeneratorOptions["passphrase"]>) => setOpts((o) => ({ ...o, passphrase: { ...o.passphrase, ...p } }));

  return (
    <div className="page gen-page">
      <header className="page-head">
        <div>
          <h1>{t("gen.title")}</h1>
          <p className="muted">{t("gen.subtitle")}</p>
        </div>
      </header>

      <section className="gen-output" aria-label={t("gen.title")}>
        <div className={"gen-value" + (value.length > 32 ? " is-long" : "")} aria-live="polite">
          {noSets ? <span className="muted small">{t("gen.pickOne")}</span> : <PasswordText value={value} />}
        </div>
        <div className="gen-bar">
          <StrengthMeter bits={noSets ? 0 : bits} />
          <div className="gen-actions">
            <button className="btn lg icon-only" onClick={regen} title={t("gen.regenerate")} aria-label={t("gen.regenerate")}>
              <RefreshCw size={18} />
            </button>
            <button className="btn lg" onClick={() => onSave(value)} disabled={noSets} aria-label={t("gen.saveToVault")}>
              <Save size={16} /> <span className="hide-sm">{t("gen.saveToVault")}</span>
            </button>
            <button className="btn primary lg" onClick={doCopy} disabled={noSets}>
              <Copy size={16} /> {t("gen.copy")}
            </button>
          </div>
        </div>
      </section>

      <div className="gen-grid">
        <section>
          <h3>{t("gen.options")}</h3>
          <Segmented<Mode>
            value={opts.mode}
            onChange={setMode}
            ariaLabel="mode"
            full
            options={[
              { value: "password", label: t("gen.mode.password") },
              { value: "passphrase", label: t("gen.mode.passphrase") },
              { value: "pin", label: t("gen.mode.pin") },
            ]}
          />

          {opts.mode === "password" && (
            <div className="stack">
              <Slider label={t("gen.length")} min={6} max={64} value={opts.password.length} onChange={(length) => setPw({ length })} />
              <div className="chip-toggles">
                {(
                  [
                    ["lower", "abc"],
                    ["upper", "ABC"],
                    ["digits", "123"],
                    ["symbols", "#$&"],
                  ] as const
                ).map(([k, sample]) => (
                  <button
                    key={k}
                    type="button"
                    className={"chip-toggle" + (opts.password[k] ? " is-on" : "")}
                    aria-pressed={opts.password[k]}
                    onClick={() => setPw({ [k]: !opts.password[k] })}
                  >
                    <span className="mono">{sample}</span>
                    <small>{t(("gen." + k) as "gen.lower")}</small>
                  </button>
                ))}
              </div>
              <Toggle
                label={t("gen.avoidAmbiguous")}
                hint={t("gen.avoidAmbiguousHint")}
                checked={opts.password.avoidAmbiguous}
                onChange={(avoidAmbiguous) => setPw({ avoidAmbiguous })}
              />
            </div>
          )}

          {opts.mode === "passphrase" && (
            <div className="stack">
              <Slider label={t("gen.words")} min={3} max={12} value={opts.passphrase.words} onChange={(words) => setPp({ words })} />
              <div className="field-row">
                <span>{t("gen.separator")}</span>
                <Segmented<string>
                  value={opts.passphrase.separator}
                  onChange={(separator) => setPp({ separator })}
                  options={["-", ".", "_", " ", "/"].map((s) => ({ value: s, label: <span className="mono">{s === " " ? "␣" : s}</span> }))}
                />
              </div>
              <Toggle label={t("gen.capitalize")} checked={opts.passphrase.capitalize} onChange={(capitalize) => setPp({ capitalize })} />
              <Toggle label={t("gen.includeNumber")} checked={opts.passphrase.includeNumber} onChange={(includeNumber) => setPp({ includeNumber })} />
            </div>
          )}

          {opts.mode === "pin" && (
            <div className="stack">
              <Slider
                label={t("gen.digitsCount")}
                min={4}
                max={16}
                value={opts.pin.length}
                onChange={(length) => setOpts((o) => ({ ...o, pin: { length } }))}
              />
            </div>
          )}
          <p className="hint">{t("gen.shortcut")}</p>
        </section>

        <section>
          <header className="section-head">
            <h3>{t("gen.history")}</h3>
            {data.history.length > 0 && (
              <button className="btn subtle sm" onClick={() => update((d) => ({ ...d, history: [] }))}>
                {t("gen.clearHistory")}
              </button>
            )}
          </header>
          {data.history.length === 0 ? (
            <p className="muted small">{t("gen.historyEmpty")}</p>
          ) : (
            <ul className="history-list">
              {data.history.map((h) => (
                <li key={h.at + h.value}>
                  <button className="history-item" onClick={() => copy(h.value)} title={t("gen.copy")}>
                    <PasswordText value={h.value} className="truncate" />
                    <time>{formatDate(h.at, lang)}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
