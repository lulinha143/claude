import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Critter } from '../../art/Critter';
import { shapeFor } from '../../art/critterShapes';
import { EmployeeSprite } from '../../art/EmployeeSprite';
import { employeeSprite, VECTOR_CRITTER_CARD_SIZE } from '../../art/employeeSprites';
import { MoodEmoji } from '../../art/EmployeeMoodBadge';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { affinityPercent, roomAffinity } from '../../sim/affinity';
import { MOOD_POSITIVE, MOOD_TONE, employeeMood, moodProductivityMultiplier } from '../../sim/mood';
import { ROOMS_BY_ID } from '../../content/rooms';
import { resolveEmployeeRoom } from '../../sim/rooms';
import { evaluateTalkNode, type TalkRequirementFailure } from '../../sim/talks';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';

/**
 * The full-screen employee interaction mode.
 *
 * This is a MODE, not a popup: it takes the whole surface, the employee is drawn as
 * large as their artwork supports, and the office is dimmed behind rather than
 * replaced, so it reads as leaning in to talk to someone at their desk rather than as
 * a dialog box appearing over a game.
 *
 * A note on the artwork: the sprite is asked for a much larger height than the office
 * uses, and `EmployeeSprite` answers that by serving the DENSER retained build and
 * downscaling it. So the character is genuinely sharp here rather than an enlarged
 * office sprite — which is the whole reason the resolution choice lives in the
 * component instead of in fixed srcSet density labels.
 *
 * Everything shown is read from real state: the mood chip is the same derived mood the
 * office shows, the trust bar is the persisted `friendship`, and the "what changed"
 * readout is the engine's MEASURED before/after diff, not a restatement of the
 * authored effects. A talk that claims +6 trust and delivers +2 because of a cap says
 * +2 here.
 */
export function EmployeeTalk() {
  const { t } = useTranslation();
  const fmt = useFmt();
  const { engine, state } = useGame();
  const audio = useStore((s) => s.audio);
  const reducedMotion = state.settings.reducedMotion;
  const active = engine.activeTalk;
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Escape always leaves. A conversation is never modal in the trapping sense —
  // whatever has been agreed is already applied and saved.
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') engine.closeTalk();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, engine]);

  // Move focus into the mode when it opens, so a keyboard player is not stranded
  // behind it, and so a screen reader announces the conversation. Keyed on the
  // conversation's identity rather than the object: the engine mutates `activeTalk` in
  // place as the conversation advances, so depending on `active` would re-grab focus on
  // every exchange and yank it off the option the player is about to click.
  const talkInstanceId = active?.instanceId ?? null;
  useEffect(() => {
    if (talkInstanceId) closeRef.current?.focus();
  }, [talkInstanceId]);

  if (!active) return null;

  const def = EMPLOYEES_BY_ID[active.employeeId];
  const rt = state.employees[active.employeeId];
  if (!def || !rt) return null;

  const sprite = employeeSprite(def.id);
  const shape = shapeFor(def.id);
  const mood = employeeMood(state, def.id);
  const moodPct = Math.round((moodProductivityMultiplier(mood) - 1) * 100);
  const roomId = resolveEmployeeRoom(state, def.id);
  const room = ROOMS_BY_ID[roomId];
  const affinity = roomAffinity(def.id, roomId);
  const node = active.nodeId ? active.topic.nodes[active.nodeId] : null;
  const finished = !node;
  const evaluated = node ? evaluateTalkNode(state, def.id, node.choices, Date.now()) : [];

  const requirementText = (f: TalkRequirementFailure): string =>
    t(f.messageKey, { value: f.required !== undefined ? fmt.num(f.required) : '' });

  // The measured deltas from the option just taken. Only non-zero rows are shown, so
  // a choice that genuinely changed one thing does not pad itself out to look busy.
  const change = active.report;
  const mine = change?.employees.find((e) => e.id === def.id);
  const deltas: Array<{ key: string; label: string; value: string; tone: 'pos' | 'neg' }> = [];
  const pushDelta = (key: string, label: string, raw: number, suffix = '') => {
    if (!raw) return;
    deltas.push({
      key,
      label,
      value: `${raw > 0 ? '+' : ''}${fmt.num(Math.round(raw * 10) / 10)}${suffix}`,
      tone: raw > 0 ? 'pos' : 'neg',
    });
  };
  if (change) {
    pushDelta('nuts', t('resource.nuts'), change.nuts);
    pushDelta('golden', t('resource.goldenNuts'), change.goldenNuts);
    pushDelta('morale', t('resource.morale'), change.morale);
    pushDelta('reputation', t('resource.reputation'), change.reputation);
    if (mine) pushDelta('trust', t('talk.trust'), mine.friendshipDelta);
  }

  return (
    <div
      className="talk"
      role="dialog"
      aria-modal="true"
      aria-labelledby="talk-name"
      data-employee={def.id}
      data-topic={active.topic.id}
      data-node={active.nodeId || 'end'}
    >
      <div className="talk__scrim" onClick={() => engine.closeTalk()} aria-hidden="true" />
      <div className="talk__sheet">
        {/* An internal-memo header, so the mode belongs to the same company as
            everything else rather than looking like a visual-novel overlay. */}
        <header className="talk__masthead">
          <span className="talk__dot" aria-hidden="true" />
          <span className="talk__file">{t('talk.fileLabel')}</span>
          <span className="talk__ref">
            {t('talk.ref', { id: def.id.toUpperCase(), n: (rt.talks?.count ?? 0) + 1 })}
          </span>
          <button
            ref={closeRef}
            className="talk__close"
            onClick={() => engine.closeTalk()}
            aria-label={t('common.close')}
          >
            ×
          </button>
        </header>

        <div className="talk__body">
          {/* --- who you are talking to ------------------------------------ */}
          <div className="talk__figure">
            <div className="talk__portrait" data-kind={sprite ? 'sprite' : 'vector'}>
              {sprite ? (
                <EmployeeSprite
                  config={sprite}
                  reducedMotion={reducedMotion}
                  // As large as the ARTWORK actually supports, and not one pixel more.
                  //
                  // The employee should be prominent here, and the obvious way to do
                  // that is to pick a generous height — but `srcHeight` is the densest
                  // build that exists (186px for Pip), so asking for the 280px this
                  // column could hold meant enlarging it 1.5x. Photographing the mode
                  // showed exactly that: a visibly soft founder, which is the defect
                  // the display-size re-encode had just removed everywhere else.
                  // Capping here keeps the portrait pixel-exact; the sense of scale
                  // comes from the layout giving it a whole column instead.
                  height={Math.min(Math.round(sprite.cardHeight * 1.75), sprite.srcHeight)}
                  className="talk__sprite"
                />
              ) : (
                <Critter
                  species={shape.species}
                  color={def.color}
                  accent={def.accent}
                  state="talk"
                  hasGlasses={shape.hasGlasses}
                  size={Math.round(VECTOR_CRITTER_CARD_SIZE * 1.75)}
                />
              )}
            </div>
            <h2 id="talk-name" className="talk__name">
              {rt.nickname ?? t(def.nameKey)}
            </h2>
            <p className="talk__role">{t(def.roleKey)}</p>

            <dl className="talk__vitals">
              <div className="talk__vital">
                <dt>{t('talk.mood')}</dt>
                <dd className="talk__mood" style={{ ['--mood-tone' as string]: MOOD_TONE[mood] }}>
                  <MoodEmoji mood={mood} color={MOOD_TONE[mood]} />
                  <span>{t(`mood.${mood}`)}</span>
                  <em className={MOOD_POSITIVE[mood] ? 'is-pos' : 'is-neg'}>
                    {moodPct >= 0 ? '+' : ''}
                    {moodPct}%
                  </em>
                </dd>
              </div>
              <div className="talk__vital">
                <dt>{t('talk.trust')}</dt>
                <dd>
                  <div className="talk__bar">
                    <div className="talk__bar-fill" style={{ width: `${rt.friendship}%` }} />
                  </div>
                  <span className="talk__bar-num">{Math.round(rt.friendship)}%</span>
                </dd>
              </div>
              <div className="talk__vital">
                <dt>{t('talk.posting')}</dt>
                <dd>
                  {room ? t(room.nameKey) : roomId}
                  <em className={affinity === 'disliked' ? 'is-neg' : 'is-pos'}>
                    {affinityPercent(def.id, roomId) >= 0 ? '+' : ''}
                    {affinityPercent(def.id, roomId)}%
                  </em>
                </dd>
              </div>
            </dl>
          </div>

          {/* --- the conversation ------------------------------------------ */}
          <div className="talk__convo">
            <div className="talk__topic">
              <h3>{t(active.topic.titleKey)}</h3>
              <p>{t(active.topic.blurbKey)}</p>
            </div>

            {/* The reply to what was just said comes first: it is the payoff for the
                previous choice, and putting it above the new prompt is what makes the
                exchange read as a conversation rather than a list of questions. */}
            {active.lastReplyKey ? (
              <blockquote className="talk__said talk__said--reply">
                {t(active.lastReplyKey)}
              </blockquote>
            ) : null}

            {node ? <blockquote className="talk__said">{t(node.promptKey)}</blockquote> : null}

            {deltas.length > 0 ? (
              <div className="talk__changed" data-count={deltas.length}>
                <span className="talk__changed-label">{t('talk.whatChanged')}</span>
                <ul>
                  {deltas.map((d) => (
                    <li key={d.key} className={`is-${d.tone}`}>
                      <span>{d.label}</span>
                      <b>{d.value}</b>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {node ? (
              <div className="talk__choices">
                {evaluated.map(({ choice, enabled, failures }) => (
                  <button
                    key={choice.id}
                    className={`talk-choice talk-choice--${choice.tone ?? 'warm'}`}
                    data-option-id={choice.id}
                    data-eligible={enabled}
                    aria-disabled={!enabled}
                    onClick={() => {
                      if (!enabled) return;
                      audio.play(enabled ? 'click' : 'error');
                      engine.chooseTalkOption(choice.id, active.instanceId);
                    }}
                  >
                    <span className="talk-choice__label">{t(choice.labelKey)}</span>
                    {failures.length > 0 ? (
                      <span className="talk-choice__req">
                        {failures.map(requirementText).join(' · ')}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <div className="talk__end">
                <p className="talk__end-note">{t('talk.ended')}</p>
                <button className="buy-btn talk__done" onClick={() => engine.closeTalk()}>
                  {t('talk.backToWork')}
                </button>
              </div>
            )}
          </div>
        </div>

        {finished ? null : (
          <footer className="talk__foot">
            <span className="talk__stamp">{t('talk.confidential')}</span>
          </footer>
        )}
      </div>
    </div>
  );
}
