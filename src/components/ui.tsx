import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { formatDuration, useT, type Key } from "../lib/i18n";
import { crackSeconds, levelFromBits } from "../lib/strength";

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={"toggle" + (disabled ? " is-disabled" : "")}>
      <span className="toggle-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden>
        <span className="toggle-thumb" />
      </span>
    </label>
  );
}

export function Segmented<V extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  full,
}: {
  value: V;
  options: { value: V; label: ReactNode }[];
  onChange: (v: V) => void;
  ariaLabel?: string;
  full?: boolean;
}) {
  return (
    <div className={"segmented" + (full ? " full" : "")} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? "is-active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider">
      <div className="slider-head">
        <label htmlFor={id}>{label}</label>
        <input
          className="slider-num"
          type="number"
          min={min}
          max={max}
          value={value}
          aria-label={label}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
          }}
        />
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        style={{ ["--pct" as string]: pct + "%" }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/** Password rendered with per-character-class colors. */
export function PasswordText({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span className={"pw " + className}>
      {[...value].map((c, i) => (
        <span key={i} className={/[0-9]/.test(c) ? "pw-d" : /[a-zA-Z]/.test(c) ? "" : "pw-s"}>
          {c}
        </span>
      ))}
    </span>
  );
}

export function StrengthMeter({ bits, compact }: { bits: number; compact?: boolean }) {
  const { t, lang } = useT();
  const level = levelFromBits(bits);
  return (
    <div className={"strength lvl-" + level + (compact ? " is-compact" : "")}>
      <div className="strength-bars" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={i <= level ? "on" : ""} />
        ))}
      </div>
      <div className="strength-meta">
        <strong>{t(("str." + level) as Key)}</strong>
        {!compact && (
          <>
            <span>{t("str.bits", { n: Math.round(bits) })}</span>
            <span>{t("str.crack", { t: formatDuration(crackSeconds(bits), t, lang) })}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  autoComplete = "current-password",
  invalid,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  autoComplete?: string;
  invalid?: boolean;
  id?: string;
}) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  return (
    <div className={"input-wrap" + (invalid ? " is-invalid" : "")}>
      <input
        id={id}
        className="input mono"
        type={show ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" className="icon-btn ghost" onClick={() => setShow((s) => !s)} title={show ? t("entry.hide") : t("entry.show")}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md";
}) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    if (!ref.current?.contains(document.activeElement)) ref.current?.querySelector<HTMLElement>("input,textarea,button.primary")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={"modal modal-" + size} role="dialog" aria-modal="true" ref={ref}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const clean = name.trim() || "?";
  return (
    <span className="avatar" aria-hidden style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {clean[0].toLocaleUpperCase()}
    </span>
  );
}

/* ---------- Promise-based confirm / password prompt (works in Tauri webviews too) ---------- */

type DialogReq =
  | { kind: "confirm"; message: string; danger?: boolean; resolve: (v: boolean) => void }
  | { kind: "password"; message: string; resolve: (v: string | null) => void };

const DialogCtx = createContext<{
  confirm: (message: string, danger?: boolean) => Promise<boolean>;
  askPassword: (message: string) => Promise<string | null>;
} | null>(null);

export function useDialog() {
  const c = useContext(DialogCtx);
  if (!c) throw new Error("DialogProvider missing");
  return c;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const { t } = useT();
  const [req, setReq] = useState<DialogReq | null>(null);
  const [pw, setPw] = useState("");
  const confirm = useCallback((message: string, danger?: boolean) => new Promise<boolean>((resolve) => setReq({ kind: "confirm", message, danger, resolve })), []);
  const askPassword = useCallback((message: string) => {
    setPw("");
    return new Promise<string | null>((resolve) => setReq({ kind: "password", message, resolve }));
  }, []);
  const close = (ok: boolean) => {
    if (!req) return;
    if (req.kind === "confirm") req.resolve(ok);
    else req.resolve(ok ? pw : null);
    setReq(null);
  };
  return (
    <DialogCtx.Provider value={{ confirm, askPassword }}>
      {children}
      <Modal
        open={!!req}
        size="sm"
        onClose={() => close(false)}
        title={req?.kind === "password" ? req.message : t("common.confirm")}
        footer={
          <>
            <button className="btn" onClick={() => close(false)}>
              {t("common.cancel")}
            </button>
            <button className={"btn primary" + (req?.kind === "confirm" && req.danger ? " danger" : "")} onClick={() => close(true)}>
              {t("common.ok")}
            </button>
          </>
        }
      >
        {req?.kind === "confirm" && <p className="dialog-msg">{req.message}</p>}
        {req?.kind === "password" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              close(true);
            }}
          >
            <PasswordInput value={pw} onChange={setPw} autoFocus />
          </form>
        )}
      </Modal>
    </DialogCtx.Provider>
  );
}
