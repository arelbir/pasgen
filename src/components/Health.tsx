import { useMemo } from "react";
import { useT } from "../lib/i18n";
import { estimateBits, levelFromBits } from "../lib/strength";
import { hostOf, reuseCounts, type Entry } from "../lib/vault";
import { useVault } from "../store";
import { Avatar } from "./ui";

const YEAR = 365 * 24 * 3600 * 1000;

export function Health({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useT();
  const { data } = useVault();

  const report = useMemo(() => {
    const reuse = reuseCounts(data.entries);
    const withPw = data.entries.filter((e) => e.password);
    const weak = withPw.filter((e) => levelFromBits(estimateBits(e.password)) <= 1);
    const reused = withPw.filter((e) => (reuse.get(e.password) ?? 0) > 1);
    const old = withPw.filter((e) => Date.now() - e.passwordUpdatedAt > YEAR);
    const bad = new Set([...weak, ...reused].map((e) => e.id));
    const oldOnly = old.filter((e) => !bad.has(e.id)).length;
    const score = withPw.length ? Math.round(((withPw.length - bad.size - oldOnly * 0.3) / withPw.length) * 100) : 100;
    return { weak, reused, old, score: Math.max(0, score), total: withPw.length };
  }, [data.entries]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t("health.title")}</h1>
        <p className="muted">{t("health.subtitle", { n: report.total })}</p>
      </header>

      <section className="score" aria-label={t("health.score")}>
        <div className="score-main">
          <span className="label">{t("health.score")}</span>
          <span className="score-num">
            {report.score}
            <small> / 100</small>
          </span>
          <div className="score-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={report.score} aria-label={t("health.score")}>
            <div className="score-fill" style={{ width: report.score + "%" }} />
          </div>
          <p className="hint">{t("health.scoreHow")}</p>
        </div>
        <div className="stat-strip">
          <Stat n={report.weak.length} label={t("health.weak")} tone="bad" />
          <Stat n={report.reused.length} label={t("health.reused")} tone="mid" />
          <Stat n={report.old.length} label={t("health.old")} tone="" />
        </div>
      </section>

      <Group title={t("health.weak")} body={t("health.weakBody")} items={report.weak} onOpen={onOpen} />
      <Group title={t("health.reused")} body={t("health.reusedBody")} items={report.reused} onOpen={onOpen} />
      <Group title={t("health.old")} body={t("health.oldBody")} items={report.old} onOpen={onOpen} />
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className={"stat " + (n ? tone : "")}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{n}</span>
    </div>
  );
}

function Group({ title, body, items, onOpen }: { title: string; body: string; items: Entry[]; onOpen: (id: string) => void }) {
  const { t } = useT();
  return (
    <section className="section">
      <header className="section-head">
        <div>
          <h2>{title}</h2>
          <p className="muted small">{body}</p>
        </div>
      </header>
      {items.length === 0 ? (
        <p className="all-good">{t("health.allGood")}</p>
      ) : (
        <ul className="health-list">
          {items.map((e) => (
            <li key={e.id}>
              <Avatar name={e.title} size={32} />
              <span className="entry-row-text">
                <strong>{e.title}</strong>
                <small>{e.username || hostOf(e.url)}</small>
              </span>
              <button className="btn sm" onClick={() => onOpen(e.id)}>
                {t("health.fix")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
