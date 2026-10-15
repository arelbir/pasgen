import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { formatDate, useT } from "../lib/i18n";
import { estimateBits, levelFromBits } from "../lib/strength";
import { hostOf, reuseCounts, type Entry } from "../lib/vault";
import { useVault } from "../store";
import { EntryEditor, type Draft } from "./EntryEditor";
import { Avatar, PasswordText, StrengthMeter, useDialog } from "./ui";

type Filter = "all" | "favorites" | "weak" | "reused";

export function Vault({
  pendingDraft,
  clearPending,
  focusId,
  clearFocus,
}: {
  pendingDraft: Draft | null;
  clearPending: () => void;
  focusId: string | null;
  clearFocus: () => void;
}) {
  const { t, lang } = useT();
  const { data, update, copy, toast } = useVault();
  const { confirm } = useDialog();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pendingDraft) {
      setDraft(pendingDraft);
      clearPending();
    }
  }, [pendingDraft, clearPending]);

  useEffect(() => {
    if (focusId) {
      setSelectedId(focusId);
      setFilter("all");
      setQ("");
      clearFocus();
    }
  }, [focusId, clearFocus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setDraft({});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const reuse = useMemo(() => reuseCounts(data.entries), [data.entries]);
  const isWeak = (e: Entry) => !!e.password && levelFromBits(estimateBits(e.password)) <= 1;
  const isReused = (e: Entry) => (reuse.get(e.password) ?? 0) > 1;

  const list = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase(lang);
    return data.entries
      .filter((e) => {
        if (filter === "favorites" && !e.favorite) return false;
        if (filter === "weak" && !isWeak(e)) return false;
        if (filter === "reused" && !isReused(e)) return false;
        if (!needle) return true;
        return [e.title, e.username, e.url, e.notes, ...e.tags].some((x) => x.toLocaleLowerCase(lang).includes(needle));
      })
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.title.localeCompare(b.title, lang));
  }, [data.entries, q, filter, reuse, lang]);

  const selected = data.entries.find((e) => e.id === selectedId) ?? null;

  const save = async (e: Entry) => {
    await update((d) => {
      const exists = d.entries.some((x) => x.id === e.id);
      return { ...d, entries: exists ? d.entries.map((x) => (x.id === e.id ? e : x)) : [...d.entries, e] };
    });
    setDraft(null);
    setSelectedId(e.id);
    toast(t("toast.saved"));
  };

  const remove = async (e: Entry) => {
    if (!(await confirm(t("entry.confirmDelete", { t: e.title }), true))) return;
    await update((d) => ({ ...d, entries: d.entries.filter((x) => x.id !== e.id) }));
    setSelectedId(null);
    toast(t("toast.deleted"));
  };

  const toggleFav = (e: Entry) => update((d) => ({ ...d, entries: d.entries.map((x) => (x.id === e.id ? { ...x, favorite: !x.favorite } : x)) }));

  const counts = {
    all: data.entries.length,
    favorites: data.entries.filter((e) => e.favorite).length,
    weak: data.entries.filter(isWeak).length,
    reused: data.entries.filter(isReused).length,
  };

  return (
    <div className={"vault" + (selected ? " has-selection" : "")}>
      <section className="vault-list">
        <header className="vault-list-head">
          <div className="row">
            <div className="search">
              <Search size={16} />
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("vault.search")} type="search" />
              <kbd>Ctrl K</kbd>
            </div>
            <button className="btn primary icon-only" onClick={() => setDraft({})} title={t("vault.new") + " (Ctrl+N)"} aria-label={t("vault.new")}>
              <Plus size={18} />
            </button>
          </div>
          <div className="filters">
            {(["all", "favorites", "weak", "reused"] as Filter[]).map((f) => (
              <button key={f} className={"filter" + (filter === f ? " is-active" : "")} onClick={() => setFilter(f)}>
                {t(("vault." + f) as "vault.all")}
                <span className="count">{counts[f]}</span>
              </button>
            ))}
          </div>
        </header>

        {data.entries.length === 0 ? (
          <div className="empty">
            <h3>{t("vault.empty")}</h3>
            <p className="muted small">{t("vault.emptyBody")}</p>
            <button className="btn primary" onClick={() => setDraft({})}>
              <Plus size={16} /> {t("vault.new")}
            </button>
          </div>
        ) : list.length === 0 ? (
          <div className="empty">
            <p className="muted">{t("vault.noResults")}</p>
          </div>
        ) : (
          <ul className="entries" role="listbox">
            {list.map((e) => (
              <li key={e.id}>
                <button
                  className={"entry-row" + (e.id === selectedId ? " is-selected" : "")}
                  role="option"
                  aria-selected={e.id === selectedId}
                  onClick={() => setSelectedId(e.id)}
                  onDoubleClick={() => copy(e.password)}
                >
                  <Avatar name={e.title} />
                  <span className="entry-row-text">
                    <strong>
                      {e.title}
                      {e.favorite && <Star size={12} className="star" />}
                    </strong>
                    <small>{e.username || hostOf(e.url)}</small>
                  </span>
                  {(isWeak(e) || isReused(e)) && <AlertTriangle size={15} className="warn-icon" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="vault-detail">
        {selected ? (
          <Detail
            key={selected.id}
            entry={selected}
            reused={reuse.get(selected.password) ?? 0}
            onBack={() => setSelectedId(null)}
            onEdit={() => setDraft(selected)}
            onDelete={() => remove(selected)}
            onFav={() => toggleFav(selected)}
            lang={lang}
          />
        ) : (
          <div className="empty detail-empty">
            <p className="muted">{t("vault.select")}</p>
          </div>
        )}
      </section>

      <EntryEditor draft={draft} onClose={() => setDraft(null)} onSave={save} />
    </div>
  );
}

function Detail({
  entry: e,
  reused,
  onBack,
  onEdit,
  onDelete,
  onFav,
  lang,
}: {
  entry: Entry;
  reused: number;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFav: () => void;
  lang: "tr" | "en";
}) {
  const { t } = useT();
  const { copy } = useVault();
  const [show, setShow] = useState(false);
  const bits = estimateBits(e.password);
  const href = e.url ? (/^[a-z]+:\/\//i.test(e.url) ? e.url : "https://" + e.url) : "";

  return (
    <div className="detail">
      <header className="detail-head">
        <button className="icon-btn ghost back" onClick={onBack} aria-label="back">
          <ArrowLeft size={18} />
        </button>
        <Avatar name={e.title} size={48} />
        <div className="detail-title">
          <h2>{e.title}</h2>
          {e.url && <span className="muted small">{hostOf(e.url)}</span>}
        </div>
        <button className={"icon-btn ghost fav" + (e.favorite ? " is-on" : "")} onClick={onFav} aria-pressed={e.favorite} title={t("entry.favorite")}>
          <Star size={18} />
        </button>
        <button className="btn" onClick={onEdit} aria-label={t("entry.edit")}>
          <Pencil size={16} /> <span className="hide-sm">{t("entry.edit")}</span>
        </button>
      </header>

      {reused > 1 && (
        <div className="banner warn">
          <AlertTriangle size={16} /> {t("entry.reusedWarn", { n: reused })}
        </div>
      )}
      {e.password && levelFromBits(bits) <= 1 && (
        <div className="banner warn">
          <AlertTriangle size={16} /> {t("entry.weakWarn")}
        </div>
      )}

      <div className="fields">
        {e.username && (
          <div className="dfield">
            <div className="dfield-body">
              <span className="label">{t("entry.username")}</span>
              <span className="value">{e.username}</span>
            </div>
            <button className="icon-btn" onClick={() => copy(e.username, false)} title={t("gen.copy")}>
              <Copy size={16} />
            </button>
          </div>
        )}
        <div className="dfield">
          <div className="dfield-body">
            <span className="label">{t("entry.password")}</span>
            <span className="value mono">{show ? <PasswordText value={e.password} /> : "•".repeat(Math.min(16, e.password.length || 8))}</span>
            {e.password && <StrengthMeter bits={bits} compact />}
          </div>
          <button className="icon-btn" onClick={() => setShow((s) => !s)} title={show ? t("entry.hide") : t("entry.show")}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button className="icon-btn" onClick={() => copy(e.password)} title={t("gen.copy")}>
            <Copy size={16} />
          </button>
        </div>
        {e.url && (
          <div className="dfield">
            <div className="dfield-body">
              <span className="label">{t("entry.url")}</span>
              <a className="value link" href={href} target="_blank" rel="noreferrer noopener">
                {e.url}
              </a>
            </div>
            <button className="icon-btn" onClick={() => copy(e.url, false)} title={t("gen.copy")}>
              <Copy size={16} />
            </button>
          </div>
        )}
      </div>

      {e.tags.length > 0 && (
        <div className="tags">
          {e.tags.map((tg) => (
            <span key={tg} className="tag">
              {tg}
            </span>
          ))}
        </div>
      )}

      {e.notes && (
        <div className="notes">
          <span className="label">{t("entry.notes")}</span>
          <p>{e.notes}</p>
        </div>
      )}

      <dl className="meta">
        <div>
          <dt>{t("entry.created")}</dt>
          <dd>{formatDate(e.createdAt, lang)}</dd>
        </div>
        <div>
          <dt>{t("entry.updated")}</dt>
          <dd>{formatDate(e.updatedAt, lang)}</dd>
        </div>
        <div>
          <dt>{t("entry.pwChanged")}</dt>
          <dd>{formatDate(e.passwordUpdatedAt, lang)}</dd>
        </div>
      </dl>

      <button className="btn danger-ghost self-start" onClick={onDelete}>
        <Trash2 size={16} /> {t("entry.delete")}
      </button>
    </div>
  );
}
