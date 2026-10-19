// The restructure ("Pirar na Castanha" / "Go Completely Nuts"): the continuity
// file the player reads before starting the company over.
//
// Everything it states comes from `restructurePreview`, which runs the same
// operation the confirmation performs and reads the result, so what the file says
// is kept, reset and earned is what happens. The decision is two steps: open the
// confirmation (which restates the gain and the losses), then confirm or step back.

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { restructurePreview } from '../../sim/prestige';
import { PRESTIGE_BRANCHES, PRESTIGE_SKILLS } from '../../content/prestige';
import { EMPLOYEES_BY_ID, FOUNDER_ID } from '../../content/employees';
import type { PrestigeBranchDef, PrestigeSkillDef } from '../../content/types';
import type { PrestigeBranchId } from '../../sim/types';
import { BALANCE } from '../../sim/config';
import { Icon } from '../../art/UiIcon';

/** Signed percentage, so a cost reads as a cost rather than as a bare number. */
function signedPercent(value: number): string {
  const percent = Math.round(value * 1000) / 10;
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

/**
 * The effects a branch actually applies, read straight off the definition.
 *
 * Only non-zero terms are listed: a branch with no rare-event bonus should say nothing
 * about rare events rather than advertise "+0%".
 */
function branchEffects(branch: PrestigeBranchDef) {
  const effects: { label: string; value: string; good: boolean }[] = [];
  if (branch.productionMultiplier !== 1) {
    effects.push({
      label: 'prestige.effect.production',
      value: signedPercent(branch.productionMultiplier - 1),
      good: branch.productionMultiplier > 1,
    });
  }
  if (branch.moraleBonus !== 0) {
    effects.push({
      label: 'prestige.effect.morale',
      value: `${branch.moraleBonus > 0 ? '+' : ''}${branch.moraleBonus}`,
      good: branch.moraleBonus > 0,
    });
  }
  if (branch.rareEventChance !== 0) {
    effects.push({
      label: 'prestige.effect.rareEvents',
      value: signedPercent(branch.rareEventChance),
      good: branch.rareEventChance > 0,
    });
  }
  return effects;
}

/** What a skill does at `level`, from the same effect the simulation reads. */
function skillAmount(skill: PrestigeSkillDef, level: number, fmtNum: (n: number) => string) {
  const amount = skill.effect.perLevel * level;
  switch (skill.effect.kind) {
    case 'globalMultiplier':
    case 'kernelGain':
      return signedPercent(amount);
    case 'startNuts':
    case 'moraleFloor':
    case 'offlineCapHours':
      return fmtNum(amount);
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

export function PrestigeView() {
  const { t, i18n } = useTranslation();
  const { state, engine } = useGame();
  const fmt = useFmt();
  const doPrestige = useStore((s) => s.doPrestige);
  const buySkill = useStore((s) => s.buySkill);
  const [selected, setSelected] = useState<PrestigeBranchId>(state.prestige.branch ?? 'industrial');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [skillNote, setSkillNote] = useState<{ id: string; text: string; ok: boolean } | null>(
    null,
  );
  const confirmRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const reopenFocus = useRef(false);

  const preview = restructurePreview(state, selected, Date.now());
  const { keeps, resets } = preview;
  const each = signedPercent(BALANCE.prestige.kernelGlobalBonus);
  const founder = t(EMPLOYEES_BY_ID[FOUNDER_ID]?.nameKey ?? '');

  // Reading the file while the restructure is open retires the guide's suggestion
  // for this cycle (it stays here, in the Archive).
  useEffect(() => {
    if (preview.ready) engine.reviewRestructure();
  }, [preview.ready, engine]);

  // The confirmation takes focus on its safe answer, and Escape steps back to the
  // file instead of closing the Archive.
  useEffect(() => {
    if (!confirming) {
      if (reopenFocus.current) openRef.current?.focus({ preventScroll: true });
      reopenFocus.current = false;
      return undefined;
    }
    const panel = confirmRef.current;
    panel?.scrollIntoView({ block: 'nearest' });
    panel?.querySelector<HTMLButtonElement>('.restructure-confirm__cancel')?.focus({
      preventScroll: true,
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (!panel?.closest('.sheet')?.contains(document.activeElement)) return;
      event.preventDefault();
      reopenFocus.current = true;
      setConfirming(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [confirming]);

  function moveBranch(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    const count = PRESTIGE_BRANCHES.length;
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    const next =
      event.key in step
        ? (index + step[event.key] + count) % count
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? count - 1
            : null;
    if (next === null) return;
    event.preventDefault();
    setSelected(PRESTIGE_BRANCHES[next].id as PrestigeBranchId);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [next]?.focus();
  }

  function cancel() {
    reopenFocus.current = true;
    setConfirming(false);
  }

  function confirm() {
    if (busy) return;
    setBusy(true);
    // On success the sheet closes onto the office; a refusal (the cycle already
    // restructured) leaves the file to say where it stands.
    if (!doPrestige(selected)) {
      setBusy(false);
      setConfirming(false);
    }
  }

  function pressSkill(skill: PrestigeSkillDef) {
    const level = state.prestige.skills[skill.id] ?? 0;
    if (level >= skill.maxLevel) return;
    if (buySkill(skill.id)) {
      setSkillNote({ id: skill.id, text: t('prestige.skillBought'), ok: true });
      return;
    }
    const missing = Math.max(1, skill.cost - state.resources.permanentKernels);
    setSkillNote({
      id: skill.id,
      text: t('prestige.skillShortNote', { count: missing }),
      ok: false,
    });
  }

  const keptLines: { key: string; text: string; tone?: 'gold' }[] = [];
  if (keeps.goldenNuts > 0)
    keptLines.push({
      key: 'golden',
      text: t('prestige.kept.golden', { count: keeps.goldenNuts }),
      tone: 'gold',
    });
  if (keeps.decorations > 0) {
    keptLines.push({
      key: 'decorations',
      text: t('prestige.kept.decorations', { count: keeps.decorations }),
    });
    if (keeps.decorationsWaiting > 0)
      keptLines.push({
        key: 'decorationsWaiting',
        text: t('prestige.kept.decorationsWaiting', { count: keeps.decorationsWaiting }),
      });
  }
  keptLines.push({
    key: 'collections',
    text: t('prestige.kept.collections', {
      nuts: keeps.nuts,
      moments: keeps.moments,
      secrets: keeps.secrets,
    }),
  });
  keptLines.push({
    key: 'achievements',
    text: t('prestige.kept.achievements', { count: keeps.achievements }),
  });
  if (keeps.friends > 0)
    keptLines.push({ key: 'people', text: t('prestige.kept.people', { count: keeps.friends }) });
  if (keeps.records > 0) keptLines.push({ key: 'records', text: t('prestige.kept.records') });
  keptLines.push({ key: 'identity', text: t('prestige.kept.identity') });
  keptLines.push({ key: 'permanent', text: t('prestige.kept.permanent') });

  const resetLines: { key: string; text: string }[] = [
    {
      key: 'nuts',
      text: t('prestige.reset.nuts', {
        value: fmt.num(state.resources.nuts),
        start: fmt.num(preview.startNuts),
      }),
    },
    {
      key: 'hires',
      text:
        resets.hires > 0
          ? t('prestige.reset.hires', { count: resets.hires, founder })
          : t('prestige.reset.hiresNone', { founder }),
    },
  ];
  if (resets.rooms > 0)
    resetLines.push({ key: 'rooms', text: t('prestige.reset.rooms', { count: resets.rooms }) });
  if (resets.upgrades > 0)
    resetLines.push({
      key: 'upgrades',
      text: t('prestige.reset.upgrades', { count: resets.upgrades }),
    });
  resetLines.push({ key: 'standing', text: t('prestige.reset.standing') });
  if (keeps.setsPaused > 0)
    resetLines.push({ key: 'sets', text: t('prestige.reset.sets', { count: keeps.setsPaused }) });
  if (resets.crate >= 1)
    resetLines.push({
      key: 'crate',
      text: t('prestige.reset.crate', { value: fmt.num(resets.crate) }),
    });
  if (resets.waiting > 0)
    resetLines.push({
      key: 'waiting',
      text: t('prestige.reset.waiting', { count: resets.waiting }),
    });
  if (resets.promises > 0)
    resetLines.push({
      key: 'promises',
      text: t('prestige.reset.promises', { count: resets.promises }),
    });
  if (resets.boosts > 0) resetLines.push({ key: 'boosts', text: t('prestige.reset.boosts') });
  if (resets.focus) resetLines.push({ key: 'focus', text: t('prestige.reset.focus') });

  // The confirmation names only what is really lost, as one natural list.
  const lossParts = [
    resets.hires > 0 ? t('prestige.lose.hires', { count: resets.hires }) : null,
    resets.rooms > 0 ? t('prestige.lose.rooms', { count: resets.rooms }) : null,
    resets.upgrades > 0 ? t('prestige.lose.upgrades', { count: resets.upgrades }) : null,
    resets.nuts >= 1 ? t('prestige.lose.nuts', { value: fmt.num(state.resources.nuts) }) : null,
  ].filter((part): part is string => part !== null);
  const losses = lossParts.length
    ? new Intl.ListFormat(i18n.language, { style: 'long', type: 'conjunction' }).format(lossParts)
    : '';

  const progress = Math.min(1, preview.thisCycle / preview.line);
  const branchName = t(preview.branch.nameKey);

  return (
    <section className="view view--prestige restructure">
      <h2>{t('prestige.title')}</h2>

      <article className="restructure-file" aria-labelledby="restructure-file-kind">
        <header className="restructure-file__head">
          <span className="restructure-file__kind" id="restructure-file-kind">
            {t('prestige.transferFile')}
          </span>
          {/* An en dash: U+2192 is not in the bundled Latin subsets (tofu box). */}
          <span className="restructure-file__cycle">
            {t('prestige.cycleShift', {
              from: pad(preview.cycle.now),
              to: pad(preview.cycle.next),
            })}
          </span>
          <span
            className={`restructure-file__stamp ${preview.ready ? 'is-ready' : ''}`}
            aria-hidden
          >
            {t(preview.ready ? 'prestige.stampReady' : 'prestige.stampPending')}
          </span>
        </header>
        <p className="restructure-file__lede">{t('prestige.explain')}</p>

        <section className="restructure-gain" aria-labelledby="restructure-gain-title">
          <h3 id="restructure-gain-title">{t('prestige.gainTitle')}</h3>
          {preview.ready ? (
            <p className="restructure-gain__kernels">
              <Icon name="kernel" size={18} />
              <strong>{t('prestige.kernelsEarned', { count: preview.kernels })}</strong>
            </p>
          ) : (
            <div className="restructure-progress">
              <p>{t('prestige.lockedUntil', { value: fmt.num(preview.line) })}</p>
              <div
                className="restructure-progress__bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.floor(progress * 100)}
                aria-label={t('prestige.progressLabel')}
              >
                <span style={{ width: `${progress * 100}%` }} />
              </div>
              <p className="restructure-progress__numbers">
                {t('prestige.progress', {
                  have: fmt.num(preview.thisCycle),
                  need: fmt.num(preview.line),
                })}
              </p>
              <p>{t('prestige.atLine', { count: preview.kernelsAtLine })}</p>
            </div>
          )}
          <p>
            {t('prestige.kernelWorth', {
              each,
              now: signedPercent(preview.kernelBonus.now),
              after: signedPercent(
                preview.ready
                  ? preview.kernelBonus.after
                  : preview.kernelBonus.now +
                      preview.kernelsAtLine * BALANCE.prestige.kernelGlobalBonus,
              ),
            })}
          </p>
          {preview.startNuts > 0 ? (
            <p>{t('prestige.startNuts', { value: fmt.num(preview.startNuts) })}</p>
          ) : null}
        </section>

        <div className="restructure-columns">
          <section className="restructure-list restructure-list--kept">
            <h3>{t('prestige.keptTitle')}</h3>
            <ul>
              {keptLines.map((line) => (
                <li key={line.key} data-line={line.key} data-tone={line.tone}>
                  {line.text}
                </li>
              ))}
            </ul>
          </section>
          <section className="restructure-list restructure-list--reset">
            <h3>{t('prestige.rebuiltTitle')}</h3>
            <ul>
              {resetLines.map((line) => (
                <li key={line.key} data-line={line.key}>
                  {line.text}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </article>

      <section className="restructure-branches" aria-labelledby="restructure-branch-title">
        <h3 id="restructure-branch-title">{t('prestige.chooseBranch')}</h3>
        <p className="restructure-note">{t('prestige.branchNote')}</p>
        <div className="branch-grid" role="radiogroup" aria-labelledby="restructure-branch-title">
          {PRESTIGE_BRANCHES.map((b, index) => (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={selected === b.id}
              // One stop in the tab order; the arrows move the choice (a radio group).
              tabIndex={selected === b.id ? 0 : -1}
              className={`branch ${selected === b.id ? 'is-active' : ''}`}
              data-branch={b.id}
              onClick={() => setSelected(b.id as PrestigeBranchId)}
              onKeyDown={(event) => moveBranch(event, index)}
            >
              <strong>
                {t(b.nameKey)}
                {preview.currentBranch === b.id ? (
                  <span className="branch__current">{t('prestige.branchCurrent')}</span>
                ) : null}
              </strong>
              <span>{t(b.descriptionKey)}</span>
              {/* The numbers, not just the adjectives, derived from the SAME fields the
                  simulation reads, so a card can never drift from what the branch does. */}
              <span className="branch__effects">
                {branchEffects(b).map((effect) => (
                  <em key={effect.label} className={effect.good ? '' : 'is-cost'}>
                    {t(effect.label, { value: effect.value })}
                  </em>
                ))}
              </span>
            </button>
          ))}
        </div>
      </section>

      {preview.ready ? (
        confirming ? (
          <div
            ref={confirmRef}
            className="restructure-confirm"
            role="group"
            aria-labelledby="restructure-confirm-title"
          >
            <h3 id="restructure-confirm-title">
              {t('prestige.confirmTitle', { company: state.company.name })}
            </h3>
            <p>{t('prestige.confirmBody', { count: preview.kernels, branch: branchName })}</p>
            {losses.length ? <p>{t('prestige.confirmLoses', { list: losses })}</p> : null}
            <p className="restructure-confirm__final">{t('prestige.confirmFinal')}</p>
            <div className="restructure-confirm__actions">
              <button
                type="button"
                className="buy-btn restructure-confirm__go"
                disabled={busy}
                onClick={confirm}
              >
                <Icon name="kernel" size={15} /> {t('prestige.confirmGo')}
              </button>
              <button
                type="button"
                className="ghost-btn restructure-confirm__cancel"
                onClick={cancel}
              >
                {t('prestige.confirmCancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            ref={openRef}
            type="button"
            className="buy-btn buy-btn--big restructure-open"
            onClick={() => setConfirming(true)}
          >
            {t('prestige.open')}
          </button>
        )
      ) : null}

      <section className="restructure-skills" aria-labelledby="restructure-skills-title">
        <h3 className="skill-head" id="restructure-skills-title">
          {t('prestige.skillTree')}
          <span className="kernel-count">
            <Icon name="kernel" size={16} /> {fmt.int(state.resources.permanentKernels)}
          </span>
        </h3>
        <p className="restructure-note">{t('prestige.skillTradeoff', { each })}</p>
        <ul className="restructure-skill-list">
          {PRESTIGE_SKILLS.map((sk) => {
            const level = state.prestige.skills[sk.id] ?? 0;
            const maxed = level >= sk.maxLevel;
            const afford = state.resources.permanentKernels >= sk.cost;
            const note = skillNote?.id === sk.id ? skillNote : null;
            const effect = (lv: number) =>
              t(`prestige.skillEffect.${sk.effect.kind}`, {
                value: skillAmount(sk, lv, fmt.num),
              });
            return (
              <li
                key={sk.id}
                className={`restructure-skill ${maxed ? 'is-maxed' : ''}`}
                data-skill={sk.id}
              >
                <div className="restructure-skill__body">
                  <div className="restructure-skill__title">
                    <strong>{t(sk.nameKey)}</strong>
                    <span className="restructure-skill__level">
                      {t('prestige.skillLevel', { level, max: sk.maxLevel })}
                    </span>
                  </div>
                  <p className="restructure-skill__desc">{t(sk.descriptionKey)}</p>
                  <p className="restructure-skill__effect">
                    {level > 0
                      ? t('prestige.skillNow', { effect: effect(level) })
                      : t('prestige.skillNone')}
                    {!maxed ? (
                      <>
                        {' · '}
                        {t('prestige.skillNext', { effect: effect(level + 1) })}
                      </>
                    ) : null}
                  </p>
                  {note ? (
                    <p
                      className={`restructure-skill__note ${note.ok ? 'is-ok' : 'is-short'}`}
                      role="status"
                    >
                      {note.text}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="buy-btn restructure-skill__buy"
                  disabled={maxed}
                  aria-disabled={!maxed && !afford ? true : undefined}
                  aria-label={
                    maxed
                      ? `${t(sk.nameKey)}: ${t('common.max')}`
                      : `${t('shop.buy')} ${t(sk.nameKey)}: ${t('prestige.skillCost', { count: sk.cost })}${
                          afford
                            ? ''
                            : `. ${t('prestige.skillShortNote', {
                                count: sk.cost - state.resources.permanentKernels,
                              })}`
                        }`
                  }
                  onClick={() => pressSkill(sk)}
                >
                  {maxed ? (
                    t('common.max')
                  ) : (
                    <>
                      <span className="restructure-skill__price">
                        <Icon name="kernel" size={14} /> {sk.cost}
                      </span>
                      {afford ? null : (
                        <span className="restructure-skill__short">
                          {t('shop.short', {
                            amount: fmt.int(sk.cost - state.resources.permanentKernels),
                          })}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}
