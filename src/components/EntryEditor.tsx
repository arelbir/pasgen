import { useEffect, useState } from "react";
import { Star, Wand2 } from "lucide-react";
import { DEFAULT_OPTIONS, generate, type GeneratorOptions } from "../lib/generator";
import { useT } from "../lib/i18n";
import { prefs } from "../lib/storage";
import { estimateBits } from "../lib/strength";
import { hostOf, newId, type Entry } from "../lib/vault";
import { Modal, PasswordInput, StrengthMeter } from "./ui";

export type Draft = Partial<Entry>;

export function EntryEditor({ draft, onClose, onSave }: { draft: Draft | null; onClose: () => void; onSave: (e: Entry) => void }) {
  const { t } = useT();
  const [f, setF] = useState<Draft>({});
  const [error, setError] = useState("");
  useEffect(() => {
    setF(draft ?? {});
    setError("");
  }, [draft]);

  const set = (p: Draft) => setF((x) => ({ ...x, ...p }));
  const isEdit = !!draft?.id;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = (f.title ?? "").trim() || hostOf(f.url ?? "");
    if (!title) return setError(t("entry.needTitle"));
    const now = Date.now();
    const pwChanged = !draft?.id || draft.password !== f.password;
    onSave({
      id: f.id ?? newId(),
      title,
      username: (f.username ?? "").trim(),
      password: f.password ?? "",
      url: (f.url ?? "").trim(),
      notes: f.notes ?? "",
      tags: f.tags ?? [],
      favorite: !!f.favorite,
      createdAt: f.createdAt ?? now,
      updatedAt: now,
      passwordUpdatedAt: pwChanged ? now : (f.passwordUpdatedAt ?? now),
    });
  };

  const gen = () => {
    const o = prefs.get<GeneratorOptions>("generator", DEFAULT_OPTIONS);
    set({ password: generate({ ...DEFAULT_OPTIONS, ...o, mode: o.mode === "pin" ? "password" : o.mode }) });
  };

  return (
    <Modal
      open={!!draft}
      onClose={onClose}
      title={isEdit ? t("entry.editTitle") : t("entry.newTitle")}
      footer={
        <>
          <button
            type="button"
            className={"btn subtle fav-toggle" + (f.favorite ? " is-on" : "")}
            onClick={() => set({ favorite: !f.favorite })}
            aria-pressed={!!f.favorite}
          >
            <Star size={16} /> {t("entry.favorite")}
          </button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            {t("entry.cancel")}
          </button>
          <button type="submit" form="entry-form" className="btn primary">
            {t("entry.save")}
          </button>
        </>
      }
    >
      <form id="entry-form" className="form" onSubmit={submit}>
        <label className="field">
          <span>{t("entry.title")}</span>
          <input className="input" value={f.title ?? ""} placeholder={t("entry.titlePh")} onChange={(e) => set({ title: e.target.value })} autoFocus />
        </label>
        <label className="field">
          <span>{t("entry.username")}</span>
          <input className="input" value={f.username ?? ""} autoComplete="off" spellCheck={false} onChange={(e) => set({ username: e.target.value })} />
        </label>
        <div className="field">
          <span>{t("entry.password")}</span>
          <div className="row">
            <PasswordInput value={f.password ?? ""} onChange={(password) => set({ password })} autoComplete="new-password" />
            <button type="button" className="btn" onClick={gen} title={t("entry.generate")} aria-label={t("entry.generate")}>
              <Wand2 size={16} /> <span className="hide-sm">{t("entry.generate")}</span>
            </button>
          </div>
          {f.password && <StrengthMeter bits={estimateBits(f.password)} compact />}
        </div>
        <label className="field">
          <span>{t("entry.url")}</span>
          <input className="input" value={f.url ?? ""} placeholder="https://" inputMode="url" spellCheck={false} onChange={(e) => set({ url: e.target.value })} />
        </label>
        <label className="field">
          <span>{t("entry.tags")}</span>
          <input
            className="input"
            defaultValue={(draft?.tags ?? []).join(", ")}
            key={draft?.id ?? "new"}
            placeholder={t("entry.tagsPh")}
            onChange={(e) =>
              set({
                tags: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <label className="field">
          <span>{t("entry.notes")}</span>
          <textarea className="input" rows={3} value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
        </label>
        {error && <p className="error">{error}</p>}
      </form>
    </Modal>
  );
}
