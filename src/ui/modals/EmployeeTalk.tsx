import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeepsakeArt } from '../../art/KeepsakeArt';
import { GiftArt } from '../../art/GiftArt';
import { Critter } from '../../art/Critter';
import { shapeFor } from '../../art/critterShapes';
import { EmployeeSprite } from '../../art/EmployeeSprite';
import { employeeSprite, VECTOR_CRITTER_CARD_SIZE } from '../../art/employeeSprites';
import { RoomDressing } from '../../art/RoomDressing';
import { DEPT } from '../../art/roomStyle';
import { STICKER_FOR_MOOD, StickerArt } from '../../art/EmotionSticker';
import { speakAloud } from '../../art/voice';
import { Icon } from '../../art/UiIcon';
import { Glyph, type GlyphName } from '../../art/Glyph';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { GIFTS, type GiftId } from '../../content/employeeGifts';
import { employeeMood } from '../../sim/mood';
import { resolveEmployeeRoom } from '../../sim/rooms';
import {
  BOND_TIERS,
  giftHint,
  journalFor,
  keepsakeOnDisplay,
  knownFavorite,
  knownReactions,
  storyState,
  type JournalEntry,
} from '../../sim/bonds';
import {
  checkTalkRequirement,
  eligibleTopics,
  evaluateTalkNode,
  nodePrompt,
  talkCooldownRemaining,
  type TalkRequirementFailure,
} from '../../sim/talks';
import type { VisitTab } from '../../sim/engine';
import { cancelTransientInteractions } from '../interactionLifecycle';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { BondMeter } from '../BondMeter';
import type { GiftReaction } from '../../content/employeeGifts';

// A visit: going over to someone's desk to spend a moment with them.
//
// This is a game mode, not a dialog. The teammate stands large in their OWN room
// (the same room dressing the office draws), with their mood sticker above them,
// and reacts to what you say: a hop when something lands, a wobble when it
// stings, their sticker changing as they change. Three things to do:
//
//   Talk       their story, their keepsake, how they are doing
//   Gifts      a little guessing game: learn what they like, find their favourite
//   Scrapbook  everything the two of you have been through
//
// Everything shown is read from real state, and every choice is applied (and
// saved) the moment it is made: leaving early never undoes anything.

const REACTION_GLYPH: Record<GiftReaction, GlyphName> = {
  loved: 'heart',
  liked: 'plus',
  polite: 'tilde',
  odd: 'question',
};

/** The visit stage's size, so the teammate can be as large as it allows (never enlarged). */
function useStageHeight(ref: React.RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => setHeight(element.clientHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

export function EmployeeTalk() {
  const { t } = useTranslation();
  const fmt = useFmt();
  const { engine, state } = useGame();
  const audio = useStore((s) => s.audio);
  const reducedMotion = state.settings.reducedMotion;
  const active = engine.activeTalk;
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const stageHeight = useStageHeight(stageRef);
  const employeeId = active?.employeeId;
  const talkInstanceId = active?.instanceId ?? null;
  const [tab, setTab] = useState<VisitTab>('talk');
  const pageRef = useRef<HTMLDivElement | null>(null);
  const moreBelow = useMoreBelow(
    pageRef,
    `${tab}:${talkInstanceId ?? ''}:${active?.exchanges ?? 0}`,
  );

  // Each visit opens on the part it was opened for (a hint opens the gift notebook).
  useEffect(() => {
    if (talkInstanceId) setTab(active?.tab ?? 'talk');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talkInstanceId]);

  // Escape always leaves. Whatever has been agreed is already applied and saved.
  useEffect(() => {
    if (!employeeId) return undefined;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelTransientInteractions('popup-open');
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        engine.closeTalk();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [employeeId, engine]);

  useEffect(() => {
    if (talkInstanceId) closeRef.current?.focus();
  }, [talkInstanceId]);

  // They speak: a short babble in their own voice whenever a new line appears.
  const node = active?.nodeId ? active.topic.nodes[active.nodeId] : null;
  const promptKey = node ? nodePrompt(state, node) : null;
  const line = active?.lastReplyKey ?? promptKey;
  useEffect(() => {
    if (!employeeId || !line) return;
    speakAloud(audio, employeeId, t(line));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, talkInstanceId]);

  // A hint counts as read once the notebook showing it has been opened.
  const hintNow = employeeId ? giftHint(state, employeeId) : null;
  useHintSeen(tab === 'gifts' && Boolean(hintNow), () => {
    if (employeeId) engine.noteHintSeen(employeeId);
  });

  if (!active) return null;
  const def = EMPLOYEES_BY_ID[active.employeeId];
  const rt = state.employees[active.employeeId];
  if (!def || !rt) return null;

  const now = Date.now();
  const name = rt.nickname ?? t(def.nameKey);
  const sprite = employeeSprite(def.id);
  const shape = shapeFor(def.id);
  const mood = employeeMood(state, def.id, now);
  const roomId = resolveEmployeeRoom(state, def.id);
  const finished = !node;
  const cooldown = talkCooldownRemaining(state, def.id, now);
  const evaluated = node ? evaluateTalkNode(state, def.id, node.choices, now) : [];
  const otherTopics =
    active.exchanges === 0 && !active.profileOnly
      ? eligibleTopics(state, def.id, now).filter((topic) => topic.id !== active.topic.id)
      : [];
  const story = storyState(state, def.id, now);
  const keepsake = keepsakeOnDisplay(state, def.id);

  // How the last thing said landed: a hop, a wobble, or a thoughtful tilt.
  const mine = active.report?.employees.find((e) => e.id === def.id);
  const react = !active.report
    ? 'idle'
    : (mine?.friendshipDelta ?? 0) > 0
      ? 'joy'
      : (mine?.friendshipDelta ?? 0) < 0
        ? 'hurt'
        : 'think';

  // The art is shown as large as the stage allows, and never larger than the
  // densest build that exists (enlarging it is what makes a sprite soft).
  const spriteHeight = sprite
    ? Math.max(80, Math.min(sprite.srcHeight, Math.round((stageHeight || 360) * 0.74)))
    : 0;
  const vectorSize = Math.round(VECTOR_CRITTER_CARD_SIZE * 1.75);
  const actorHeight = sprite ? spriteHeight : vectorSize;

  const requirementText = (f: TalkRequirementFailure): string =>
    f.kind === 'later'
      ? t('talk.req.later', { time: fmt.dur(f.required ?? 0) })
      : t(f.messageKey, { value: f.required !== undefined ? fmt.num(f.required) : '' });

  // The measured deltas from the option just taken.
  const change = active.report;
  const deltas: Array<{ key: string; label: string; value: string; tone: 'pos' | 'neg' }> = [];
  const pushDelta = (key: string, label: string, raw: number) => {
    if (!raw) return;
    deltas.push({
      key,
      label,
      value: `${raw > 0 ? '+' : ''}${fmt.num(Math.round(raw * 10) / 10)}`,
      tone: raw > 0 ? 'pos' : 'neg',
    });
  };
  if (change) {
    if (mine) pushDelta('trust', t('talk.trust'), mine.friendshipDelta);
    pushDelta('nuts', t('resource.nuts'), change.nuts);
    pushDelta('golden', t('resource.goldenNuts'), change.goldenNuts);
    pushDelta('morale', t('resource.morale'), change.morale);
    pushDelta('reputation', t('resource.reputation'), change.reputation);
  }

  const milestone = active.milestone ?? null;
  const tierName = (tier: number) => t(`bond.tier.${BOND_TIERS[tier]}`);

  function give(gift: GiftId) {
    if (!engine.openTalk(def.id, 'gift', true)) return;
    const instance = engine.activeTalk?.instanceId;
    if (engine.chooseTalkOption(gift, instance)) {
      audio.play(gift === 'coffee' ? 'coffee' : 'reward');
      setTab('talk');
    }
  }

  // ---- the stage --------------------------------------------------------------
  const stage = (
    <section
      className="visit__stage"
      ref={stageRef}
      style={{
        ['--dept' as string]: DEPT[roomId] ?? 'var(--dept-founder)',
        ['--actor-h' as string]: `${actorHeight}px`,
      }}
    >
      <RoomDressing roomId={roomId} />
      <span className="visit__spot" aria-hidden />
      <div
        className="visit__actor"
        data-react={react}
        key={`${active.instanceId}:${active.exchanges}`}
      >
        <div className="talk__portrait" data-kind={sprite ? 'sprite' : 'vector'}>
          {sprite ? (
            <EmployeeSprite
              config={sprite}
              reducedMotion={reducedMotion}
              height={spriteHeight}
              className="talk__sprite"
            />
          ) : (
            <Critter
              species={shape.species}
              color={def.color}
              accent={def.accent}
              state="talk"
              hasGlasses={shape.hasGlasses}
              size={vectorSize}
            />
          )}
        </div>
        {keepsake ? (
          <span className="visit__keepsake" title={t(def.favoriteItemKey)} aria-hidden>
            <KeepsakeArt employeeId={def.id} />
          </span>
        ) : null}
      </div>
      <span
        className="visit__sticker"
        key={STICKER_FOR_MOOD[mood]}
        data-sticker={STICKER_FOR_MOOD[mood]}
        title={t(`mood.${mood}`)}
      >
        <StickerArt kind={STICKER_FOR_MOOD[mood]} />
      </span>
      <header className="visit__plate">
        <h2 id="talk-name" className="talk__name">
          {name}
        </h2>
        <p className="talk__role">{t(def.roleKey)}</p>
      </header>
      <BondMeter friendship={rt.friendship} celebrate={Boolean(milestone)} />
      <button
        ref={closeRef}
        className="talk__close"
        onClick={() => engine.closeTalk()}
        aria-label={t('visit.close')}
        title={t('visit.close')}
      >
        <Icon name="close" size={16} />
      </button>
    </section>
  );

  // ---- talk ---------------------------------------------------------------------
  // A new stage of the friendship, said in one breath so the conversation keeps
  // the room. (The story it opens is already the topic right below.)
  const milestoneNote = milestone ? (
    <p className="visit__milestone" role="status" data-tier={milestone}>
      <strong>
        <Glyph name="heart" size={12} /> {t('bond.milestone.title', { tier: tierName(milestone) })}
      </strong>{' '}
      <span>{t(`bond.milestone.${BOND_TIERS[milestone]}`, { name })}</span>
      {milestone === 3 ? <span> {t('bond.milestone.unlockClose', { name })}</span> : null}
    </p>
  ) : null;
  const talkPage = (
    <>
      {milestoneNote}
      {active.profileOnly ? (
        <div className="talk__end">
          <p className="talk__end-note">{t('gifts.quietVisit')}</p>
          <p className="visit__note">{t('visit.breakNote', { name, time: fmt.dur(cooldown) })}</p>
        </div>
      ) : (
        <>
          <div className="talk__topic">
            <h3>{t(active.topic.titleKey)}</h3>
            {active.topic.part ? <span>{t('visit.part', { n: active.topic.part })}</span> : null}
            {/* Something else on their mind: a small menu, so it never pushes the
                conversation down. */}
            {otherTopics.length > 0 ? (
              <details className="talk__agenda" key={active.topic.id}>
                <summary title={t('talk.otherTopics')} aria-label={t('talk.otherTopics')}>
                  <Glyph name="dots" size={14} />
                </summary>
                <div>
                  <strong>{t('talk.otherTopics')}</strong>
                  {otherTopics.map((topic) => (
                    <button key={topic.id} onClick={() => engine.openTalk(def.id, topic.id, true)}>
                      {t(topic.titleKey)}
                      {topic.part ? ` · ${t('visit.part', { n: topic.part })}` : ''}
                    </button>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
          {/* What they say: their answer to you and, when the conversation goes
              on, what they say next, in one breath (one bubble). */}
          <div className="visit__speech">
            {active.lastReplyKey ? (
              <blockquote className="talk__said talk__said--reply" aria-live="polite">
                <span className="talk__reply">{t(active.lastReplyKey)}</span>
                {node && promptKey ? <span className="talk__next">{t(promptKey)}</span> : null}
              </blockquote>
            ) : node && promptKey ? (
              <blockquote className="talk__said">{t(promptKey)}</blockquote>
            ) : null}
          </div>
          {deltas.length > 0 ? (
            <div className="talk__changed" data-count={deltas.length}>
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
                    if (engine.chooseTalkOption(choice.id, active.instanceId)) audio.play('paper');
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
              {active.topic.id === 'gift' &&
              state.flags[`favorite.${def.id}.giftMemory`] !== undefined &&
              knownFavorite(state, def.id) ? (
                <p className="talk__gift-filed">{t('gifts.memoryFiled')}</p>
              ) : null}
              <p className="talk__end-note">{t('talk.ended')}</p>
              <button className="buy-btn talk__done" onClick={() => engine.closeTalk()}>
                {t('visit.close')}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );

  // ---- gifts --------------------------------------------------------------------
  const reactions = knownReactions(state, def.id);
  const favorite = knownFavorite(state, def.id);
  const hint = giftHint(state, def.id);
  const busy = !active.profileOnly && active.exchanges > 0 && !finished;
  const giftLocked = cooldown > 0 || active.profileOnly || busy;
  const giftsPage = (
    <div className="visit__gifts">
      <p className="visit__gift-favorite talk__gift-preference">
        <strong>{t('gifts.notebook')}</strong>
        <span>
          {favorite
            ? t('gifts.favorite', { gift: t(`gifts.preferenceNames.${favorite}`) })
            : t('gifts.favoriteUnknown')}
        </span>
      </p>
      {hint ? <p className="visit__hint">{t(`gifts.hint.${hint}`, { name })}</p> : null}
      <ul className="visit__gift-grid">
        {GIFTS.map((gift) => {
          const known = reactions[gift.id];
          const failures = checkTalkRequirement(
            state,
            def.id,
            { nuts: gift.cost.nuts, goldenNuts: gift.cost.goldenNuts },
            now,
          );
          const cost = gift.cost.goldenNuts
            ? t('talk.req.goldenNuts', { value: gift.cost.goldenNuts })
            : gift.cost.nuts
              ? fmt.int(gift.cost.nuts)
              : t('gifts.cost.free');
          return (
            <li key={gift.id}>
              <button
                className={`visit-gift ${known ? `is-${known}` : ''}`}
                data-gift={gift.id}
                data-reaction={known ?? 'untried'}
                disabled={giftLocked || failures.length > 0}
                onClick={() => give(gift.id)}
                aria-label={`${t(`gifts.preferenceNames.${gift.id}`)}. ${
                  known ? t(`gifts.reaction.${known}`) : t('gifts.untried')
                }. ${cost}`}
              >
                <span className="visit-gift__art">
                  <GiftArt gift={gift.id} />
                  {known ? (
                    <span className="visit-gift__badge" aria-hidden>
                      <Glyph name={REACTION_GLYPH[known]} size={10} />
                    </span>
                  ) : null}
                </span>
                <span className="visit-gift__name">{t(`gifts.short.${gift.id}`)}</span>
                <span className="visit-gift__meta">
                  {known ? t(`gifts.reaction.${known}`) : cost}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {giftLocked ? (
        <p className="visit__note" role="status">
          {busy
            ? t('visit.finishFirst')
            : t('visit.breakNote', { name, time: fmt.dur(Math.max(1, cooldown)) })}
        </p>
      ) : null}
    </div>
  );

  // ---- scrapbook ------------------------------------------------------------------
  const entries = journalFor(state, def.id);
  const entryText = (entry: JournalEntry): { title: string; quote?: string; icon: GlyphName } => {
    switch (entry.kind) {
      case 'tier':
        return {
          title: t('scrapbook.tier', { tier: tierName(entry.tier) }),
          // What that stage meant, kept here for good (the visit says it only once).
          quote: [
            t(`bond.milestone.${BOND_TIERS[entry.tier]}`, { name }),
            entry.tier === 3 ? t('bond.milestone.unlockClose', { name }) : '',
          ]
            .filter(Boolean)
            .join(' '),
          icon: 'heart',
        };
      case 'story':
        return {
          title: t('scrapbook.story', { title: t(entry.titleKey), n: entry.part }),
          quote: t(entry.quoteKey),
          icon: entry.part === 3 ? 'star' : 'note',
        };
      case 'talk':
        return { title: t(entry.titleKey), icon: 'note' };
      case 'gift':
        return {
          title: t('scrapbook.gift', { gift: t(`gifts.preferenceNames.${entry.gift}`) }),
          quote: t(`gifts.reaction.${entry.reaction}`),
          icon: REACTION_GLYPH[entry.reaction],
        };
      case 'find':
        return { title: t('scrapbook.find'), quote: t(entry.quoteKey), icon: 'sparkle' };
      case 'moment':
        return { title: t('scrapbook.moment'), quote: t(entry.caption), icon: 'sparkle' };
      case 'pair': {
        const other =
          state.employees[entry.other]?.nickname ??
          t(EMPLOYEES_BY_ID[entry.other]?.nameKey ?? entry.other);
        const kind = entry.pairKind === 'mentor' && !entry.mentor ? 'mentee' : entry.pairKind;
        return { title: t(`scrapbook.pair.${kind}`, { name: other }), icon: 'smile' };
      }
    }
  };
  const storyLine =
    story.told === 3
      ? t('visit.storyWaiting.done')
      : story.waitingFor === 'friendship' && story.next
        ? t('visit.storyWaiting.friendship', {
            tier: tierName(story.next === 1 ? 1 : story.next === 2 ? 2 : 3),
          })
        : story.waitingFor === 'time'
          ? t('visit.storyWaiting.time')
          : story.readyTopicId
            ? t('visit.storyWaiting.ready')
            : null;
  const scrapbookPage = (
    <div className="visit__scrapbook">
      <p className="visit__story-line">
        <strong>{t(`arc.${def.id}.title`)}</strong>
        <span>{t('visit.storyTold', { n: story.told })}</span>
        {storyLine ? <em>{storyLine}</em> : null}
      </p>
      {entries.length ? (
        <ol className="talk__memories">
          {entries.map((entry, index) => {
            const text = entryText(entry);
            return (
              <li
                key={`${entry.kind}-${entry.at}-${index}`}
                className={`scrap scrap--${entry.kind}`}
              >
                <span className="scrap__icon" aria-hidden>
                  <Glyph name={text.icon} size={12} />
                </span>
                <span className="scrap__body">
                  <span className="scrap__title">{text.title}</span>
                  {text.quote ? <q className="scrap__quote">{text.quote}</q> : null}
                </span>
                <time dateTime={new Date(entry.at).toISOString()}>{fmt.date(entry.at)}</time>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="visit__note">{t('scrapbook.empty')}</p>
      )}
    </div>
  );

  const tabs: Array<{ id: VisitTab; icon: 'employees' | 'golden' | 'moment' }> = [
    { id: 'talk', icon: 'employees' },
    { id: 'gifts', icon: 'golden' },
    { id: 'scrapbook', icon: 'moment' },
  ];
  // A gentle signal on a tab with something new for you.
  const tabNews: Partial<Record<VisitTab, boolean>> = {
    gifts: Boolean(hint) && !(`${def.id}.hint` in state.flags),
  };

  return (
    <div
      className="talk talk--destination visit"
      role="region"
      aria-labelledby="talk-name"
      data-employee={def.id}
      data-topic={active.topic.id}
      data-node={active.nodeId || 'end'}
      data-step={active.exchanges > 0 ? 'later' : 'first'}
      data-tab={tab}
    >
      <div className="talk__sheet visit__frame">
        {stage}
        <section className="visit__panel">
          <div className="visit__tabs" role="tablist" aria-label={t('gifts.visitActions')}>
            {tabs.map((item) => (
              <button
                key={item.id}
                role="tab"
                className={`visit__tab ${tab === item.id ? 'is-active' : ''}`}
                aria-selected={tab === item.id}
                data-tab={item.id}
                data-news={tabNews[item.id] ? 'true' : undefined}
                onClick={() => {
                  audio.play('click');
                  setTab(item.id);
                }}
              >
                <Icon name={item.icon} size={14} />
                <span>{t(`visit.tab.${item.id}`)}</span>
              </button>
            ))}
          </div>
          <div
            className="visit__page"
            role="tabpanel"
            data-page={tab}
            data-more={moreBelow ? 'true' : undefined}
            ref={pageRef}
          >
            {tab === 'talk' ? talkPage : tab === 'gifts' ? giftsPage : scrapbookPage}
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Whether the page has more below what is in view, so its foot can fade out as a
 * hint to scroll (re-measured after every render and on scroll).
 */
function useMoreBelow(ref: React.RefObject<HTMLElement | null>, content: string): boolean {
  const [more, setMore] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () =>
      setMore(element.scrollTop + element.clientHeight < element.scrollHeight - 4);
    measure();
    element.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [ref, content]);
  return more;
}

/** Mark the hint read once the notebook showing it has actually been opened. */
function useHintSeen(open: boolean, mark: () => void): void {
  const markRef = useRef(mark);
  markRef.current = mark;
  useEffect(() => {
    if (open) markRef.current();
  }, [open]);
}
