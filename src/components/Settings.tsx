import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { KDF_ITERATIONS, WrongPasswordError } from "../lib/crypto";
import { useT } from "../lib/i18n";
import { estimateBits } from "../lib/strength";
import { downloadFile, isTauri, pickFile } from "../lib/storage";
import { newId, parseCSV, toCSV, type Entry } from "../lib/vault";
import { useVault, type Theme } from "../store";
import { PasswordInput, Segmented, StrengthMeter, useDialog } from "./ui";

export function Settings() {
  const { t } = useT();
  const v = useVault();
  const { confirm, askPassword } = useDialog();
  const unlocked = v.status === "unlocked";
  const stamp = () => new Date().toISOString().slice(0, 10);

  const exportBackup = async () => {
    const blob = await v.exportBackup();
    if (blob) await downloadFile(`kasa-yedek-${stamp()}.json`, JSON.stringify(blob, null, 2));
  };

  const restore = async () => {
    const text = await pickFile(".json,application/json");
    if (!text) return;
    let blob: unknown;
    try {
      blob = JSON.parse(text);
    } catch {
      return v.toast(t("set.invalidFile"), "error");
    }
    if (v.status !== "none" && !(await confirm(t("set.restoreConfirm"), true))) return;
    const pw = await askPassword(t("set.backupPassword"));
    if (pw == null) return;
    try {
      await v.restoreBackup(blob, pw);
      v.toast(t("set.restored"));
    } catch (err) {
      v.toast(err instanceof WrongPasswordError ? t("lock.wrong") : t("set.invalidFile"), "error");
    }
  };

  const importCsv = async () => {
    const text = await pickFile(".csv,text/csv");
    if (!text) return;
    const rows = parseCSV(text);
    if (!rows.length) return v.toast(t("set.invalidFile"), "error");
    const now = Date.now();
    const entries: Entry[] = rows.map((r) => ({
      id: newId(),
      title: r.title || r.url || r.username || "",
      username: r.username ?? "",
      password: r.password ?? "",
      url: r.url ?? "",
      notes: r.notes ?? "",
      tags: [],
      favorite: false,
      createdAt: now,
      updatedAt: now,
      passwordUpdatedAt: now,
    }));
    await v.update((d) => ({ ...d, entries: [...d.entries, ...entries] }));
    v.toast(t("set.imported", { n: entries.length }));
  };

  const exportCsv = async () => {
    if (!(await confirm(t("set.exportCsvWarn"), true))) return;
    await downloadFile(`kasa-${stamp()}.csv`, toCSV(v.data.entries), "text/csv");
  };

  return (
    <div className="page settings">
      <header className="page-head">
        <h1>{t("set.title")}</h1>
      </header>

      <section className="section">
        <h2>{t("set.appearance")}</h2>
        <div className="setting-list">
          <div className="setting">
            <span>{t("set.theme")}</span>
            <Segmented<Theme>
              value={v.settings.theme}
              onChange={(theme) => v.setSettings({ theme })}
              options={[
                { value: "system", label: t("set.theme.system") },
                { value: "light", label: t("set.theme.light") },
                { value: "dark", label: t("set.theme.dark") },
              ]}
            />
          </div>
          <div className="setting">
            <span>{t("set.language")}</span>
            <Segmented
              value={v.settings.lang}
              onChange={(lang) => v.setSettings({ lang })}
              options={[
                { value: "tr", label: "Türkçe" },
                { value: "en", label: "English" },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="section">
        <h2>{t("set.security")}</h2>
        <div className="setting-list">
          <div className="setting">
            <span>
              {t("set.autoLock")}
              <small>{t("set.autoLockHint")}</small>
            </span>
            <select className="input select" aria-label={t("set.autoLock")} value={v.settings.autoLockMin} onChange={(e) => v.setSettings({ autoLockMin: Number(e.target.value) })}>
              {[1, 5, 15, 30, 60].map((n) => (
                <option key={n} value={n}>
                  {t("set.minutes", { n })}
                </option>
              ))}
              <option value={0}>{t("set.never")}</option>
            </select>
          </div>
          <div className="setting">
            <span>
              {t("set.clipboard")}
              <small>{t("set.clipboardHint")}</small>
            </span>
            <select className="input select" aria-label={t("set.clipboard")} value={v.settings.clipClearSec} onChange={(e) => v.setSettings({ clipClearSec: Number(e.target.value) })}>
              {[10, 30, 60, 120].map((n) => (
                <option key={n} value={n}>
                  {t("set.seconds", { n })}
                </option>
              ))}
              <option value={0}>{t("set.never")}</option>
            </select>
          </div>
          {unlocked && <ChangeMaster />}
        </div>
      </section>

      <section className="section">
        <h2>{t("set.data")}</h2>
        {!unlocked && v.status !== "none" && <p className="muted small">{t("set.unlockFirst")}</p>}
        <div className="setting-list">
          <div className="setting">
            <span>
              {t("set.exportBackup")}
              <small>{t("set.exportBackupHint")}</small>
            </span>
            <button className="btn" onClick={exportBackup} disabled={!unlocked}>
              <Download size={16} /> {t("set.download")}
            </button>
          </div>
          <div className="setting">
            <span>
              {t("set.importBackup")}
              <small>{t("set.importBackupHint")}</small>
            </span>
            <button className="btn" onClick={restore}>
              <Upload size={16} /> {t("set.choose")}
            </button>
          </div>
          <div className="setting">
            <span>
              {t("set.importCsv")}
              <small>{t("set.importCsvHint")}</small>
            </span>
            <button className="btn" onClick={importCsv} disabled={!unlocked}>
              <Upload size={16} /> {t("set.choose")}
            </button>
          </div>
          <div className="setting">
            <span>
              {t("set.exportCsv")}
              <small>{t("set.exportCsvHint")}</small>
            </span>
            <button className="btn" onClick={exportCsv} disabled={!unlocked || v.data.entries.length === 0}>
              <Download size={16} /> {t("set.download")}
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>{t("set.about")}</h2>
        <dl className="about">
          <div>
            <dt>{t("set.storage")}</dt>
            <dd>{isTauri ? t("set.storageDesktop") : t("set.storageWeb")}</dd>
          </div>
          <div>
            <dt>{t("set.crypto")}</dt>
            <dd>AES-256-GCM, PBKDF2-SHA256, {KDF_ITERATIONS.toLocaleString(v.settings.lang === "tr" ? "tr-TR" : "en-US")} {t("set.iterations")}</dd>
          </div>
          <div>
            <dt>{t("set.version")}</dt>
            <dd className="num">1.0.0</dd>
          </div>
        </dl>
      </section>

      {v.status !== "none" && (
        <section className="section">
          <h2>{t("set.danger")}</h2>
          <div className="setting-list">
            <div className="setting">
              <span>
                {t("set.wipe")}
                <small>{t("set.wipeHint")}</small>
              </span>
              <button
                className="btn danger"
                onClick={async () => {
                  if (await confirm(t("set.wipeConfirm"), true)) await v.wipe();
                }}
              >
                {t("set.wipeAction")}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ChangeMaster() {
  const { t } = useT();
  const { changeMaster, toast } = useVault();
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open)
    return (
      <div className="setting">
        <span>
          {t("set.changeMaster")}
          <small>{t("set.changeMasterHint")}</small>
        </span>
        <button className="btn" onClick={() => setOpen(true)}>
          {t("set.change")}
        </button>
      </div>
    );

  return (
    <form
      className="form change-master"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr("");
        if (next.length < 8) return setErr(t("lock.tooShort"));
        if (next !== next2) return setErr(t("lock.mismatch"));
        setBusy(true);
        try {
          await changeMaster(cur, next);
          toast(t("set.changed"));
          setOpen(false);
          setCur("");
          setNext("");
          setNext2("");
        } catch (e2) {
          setErr(e2 instanceof WrongPasswordError ? t("lock.wrong") : String(e2));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        <span>{t("set.current")}</span>
        <PasswordInput value={cur} onChange={setCur} autoFocus />
      </label>
      <label className="field">
        <span>{t("set.newMaster")}</span>
        <PasswordInput value={next} onChange={setNext} autoComplete="new-password" />
      </label>
      {next && <StrengthMeter bits={estimateBits(next)} compact />}
      <label className="field">
        <span>{t("lock.confirm")}</span>
        <PasswordInput value={next2} onChange={setNext2} autoComplete="new-password" />
      </label>
      {err && <p className="error">{err}</p>}
      <div className="row end">
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </button>
        <button className="btn primary" disabled={busy || !cur || !next}>
          {busy ? t("lock.working") : t("entry.save")}
        </button>
      </div>
    </form>
  );
}
