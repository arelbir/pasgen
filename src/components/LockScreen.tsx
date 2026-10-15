import { useState } from "react";
import { Loader2 } from "lucide-react";
import { WrongPasswordError } from "../lib/crypto";
import { generatePassphrase } from "../lib/generator";
import { useT } from "../lib/i18n";
import { estimateBits } from "../lib/strength";
import { pickFile } from "../lib/storage";
import { useVault } from "../store";
import { PasswordInput, StrengthMeter, useDialog } from "./ui";

export function LockScreen() {
  const { t } = useT();
  const { status, create, unlock, restoreBackup, wipe, toast } = useVault();
  const { askPassword, confirm } = useDialog();
  const isNew = status === "none";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const bits = estimateBits(pw);

  const fail = (msg: string) => {
    setError(msg);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (isNew) {
      if (pw.length < 8) return fail(t("lock.tooShort"));
      if (pw !== pw2) return fail(t("lock.mismatch"));
    }
    setBusy(true);
    try {
      if (isNew) await create(pw);
      else await unlock(pw);
    } catch (err) {
      fail(err instanceof WrongPasswordError ? t("lock.wrong") : String(err));
      setPw("");
    } finally {
      setBusy(false);
    }
  };

  const suggest = () => {
    const p = generatePassphrase({ words: 6, separator: "-", capitalize: true, includeNumber: true });
    setPw(p);
    setPw2(p);
  };

  const restore = async () => {
    const text = await pickFile(".json,application/json");
    if (!text) return;
    let blob: unknown;
    try {
      blob = JSON.parse(text);
    } catch {
      return toast(t("set.invalidFile"), "error");
    }
    const p = await askPassword(t("set.backupPassword"));
    if (p == null) return;
    setBusy(true);
    try {
      await restoreBackup(blob, p);
      toast(t("set.restored"));
    } catch (err) {
      toast(err instanceof WrongPasswordError ? t("lock.wrong") : t("set.invalidFile"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lock-screen">
      <form className="lock-card" onSubmit={submit}>
        <h1>{isNew ? t("lock.createTitle") : t("lock.unlockTitle")}</h1>
        <p className="muted">{isNew ? t("lock.createBody") : t("lock.unlockBody")}</p>

        <label className="field">
          <span>{t("lock.master")}</span>
          <PasswordInput value={pw} onChange={setPw} autoFocus autoComplete={isNew ? "new-password" : "current-password"} invalid={!!error} />
        </label>

        {isNew && (
          <>
            {pw && <StrengthMeter bits={bits} compact />}
            {pw && bits < 52 && <p className="hint warn">{t("lock.weak")}</p>}
            <label className="field">
              <span>{t("lock.confirm")}</span>
              <PasswordInput value={pw2} onChange={setPw2} autoComplete="new-password" />
            </label>
            <button type="button" className="btn subtle sm self-start" onClick={suggest}>
              {t("lock.suggest")}
            </button>
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button className="btn primary lg block" disabled={busy || !pw}>
          {busy && <Loader2 size={18} className="spinning" />}
          {busy ? t("lock.working") : isNew ? t("lock.create") : t("lock.unlock")}
        </button>

        <div className="lock-links">
          <button type="button" className="link" onClick={restore} disabled={busy}>
            {t("lock.importBackup")}
          </button>
          {!isNew && (
            <button type="button" className="link" onClick={() => setShowForgot((s) => !s)}>
              {t("lock.forgot")}
            </button>
          )}
        </div>
        {showForgot && (
          <div className="forgot">
            <p className="small">{t("lock.forgotBody")}</p>
            <button
              type="button"
              className="btn danger sm"
              onClick={async () => {
                if (await confirm(t("set.wipeConfirm"), true)) await wipe();
              }}
            >
              {t("lock.reset")}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
