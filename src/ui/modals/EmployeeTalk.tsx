import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { KeepsakeArt } from '../../art/KeepsakeArt';
import { GiftArt } from '../../art/GiftArt';
import { Critter } from '../../art/Critter';
import { shapeFor } from '../../art/critterShapes';
import { EmployeeSprite } from '../../art/EmployeeSprite';
import {
  castScaleFor,
  employeeSprite,
  VECTOR_CRITTER_OFFICE_SIZE,
} from '../../art/employeeSprites';
import { RoomDressing } from '../../art/RoomDressing';
import { DEPT } from '../../art/roomStyle';
import { STICKER_FOR_MOOD, StickerArt } from '../../art/EmotionSticker';
import { speakAloud } from '../../art/voice';
import { Icon } from '../../art/UiIcon';
import { Glyph } from '../../art/Glyph';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { ROOMS_BY_ID } from '../../content/rooms';
import { GIFTS, type GiftId } from '../../content/employeeGifts';
import { employeeMood, MOOD_POSITIVE } from '../../sim/mood';
import { isRoomIdUnlocked, resolveEmployeeRoom, roomHasSpace } from '../../sim/rooms';
import { affinityPercent, roomAffinity } from '../../sim/affinity';
import {
  BOND_TIERS,
  giftHint,
  keepsakeOnDisplay,
  knownFavorite,
  knownReactions,
  storyState,
  talkChoiceCost,
} from '../../sim/bonds';
import { CHARACTERS } from '../../content/characters';
import { REACTION_GLYPH, VisitScrapbook, keepsakeCardId } from './VisitScrapbook';
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
import { moodWord } from '../moodWord';

// A visit: going over to someone's desk to spend a moment with them.
//
// This is a game mode, not a dialog. The teammate stands large in their OWN room
// (the same room dressing the office draws, in their department's light), at the
// same scale as the rest of the cast, with their mood stuck by their head. They
// speak from where they stand: in a roomy window their words float beside them in
// the scene and your answers wait on the notepad; in a corner window the notepad
// takes the lower half and their line heads it, its tail pointing up at them.
// They hop, wobble or tilt with how each answer lands. Three things to do:
//
//   Talk       their story, their keepsake, how they are doing
//   Gifts      a little guessing game: learn what they like, find their favourite
//   Scrapbook  everything the two of you have been through
//
// Everything shown is read from real state, and every choice is applied (and
// saved) the moment it is made: leaving early never undoes anything.

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Layers that own Escape while they are up (a popup over the visit). */
const OVER_LAYERS = '.popup-backdrop, .modal-backdrop, .opening-seq, .photo-mode';

/** The first thing to do in the visit: an open answer, else the way out. */
function focusInside(root: HTMLElement | null): void {
  (
    root?.querySelector<HTMLElement>('.visit__page .talk-choice[data-eligible="true"]') ??
    root?.querySelector<HTMLElement>('.visit__page .talk__done') ??
    root?.querySelector<HTMLElement>('.visit__tab.is-active') ??
    root?.querySelector<HTMLElement>('.talk__close')
  )?.focus({ preventScroll: true });
}

/** The stage's size, so the teammate can be as large as it allows (never enlarged). */
function useBoxSize(ref: React.RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () =>
      setSize((current) =>
        current.width === element.clientWidth && current.height === element.clientHeight
          ? current
          : { width: element.clientWidth, height: element.clientHeight },
      );
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

export function EmployeeTalk() {
  const { t } = useTranslation();
  const fmt = useFmt();
  const { engine, state } = useGame();
  const audio = useStore((s) => s.audio);
  const view = useStore((s) => s.view);
  const reducedMotion = state.settings.reducedMotion;
  const active = engine.activeTalk;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const stage = useBoxSize(stageRef);
  const employeeId = active?.employeeId;
  const talkInstanceId = active?.instanceId ?? null;
  const [tab, setTab] = useState<VisitTab>('talk');
  // Where the visit was opened from, read while that button is still on screen
  // (the Team sheet gives way to the visit in the same update).
  const [opener] = useState(() =>
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const [cheer, setCheer] = useState(0);
  const [slip, setSlip] = useState<{ key: number; text: string; tone: 'good' | 'bad' } | null>(
    null,
  );
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

  useEffect(() => {
    if (!slip) return undefined;
    const timer = window.setTimeout(() => setSlip(null), 3200);
    return () => window.clearTimeout(timer);
  }, [slip]);

  // Keyboard: Escape leaves (a menu that is open closes first; a popup over the
  // visit keeps its own Escape), and on the way out focus goes back to where the
  // visit was opened from. It listens in the capture phase so the sheet behind it
  // never takes the same key and closes as well.
  useEffect(() => {
    if (!employeeId) return undefined;
    const previous = opener;
    const openedFromTeam = Boolean(previous?.closest('.employee-card'));
    cancelTransientInteractions('popup-open');
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector(OVER_LAYERS)) return;
      const menu = rootRef.current?.querySelector<HTMLDetailsElement>('details[open]');
      e.preventDefault();
      if (menu) {
        menu.open = false;
        menu.querySelector<HTMLElement>('summary')?.focus();
        return;
      }
      engine.closeTalk();
    };
    // The visit is the whole screen: focus that wanders behind it (the office
    // handing focus back to a teammate, a sheet settling) is brought back in.
    const onFocusIn = (e: FocusEvent) => {
      const root = rootRef.current;
      const target = e.target;
      if (!root || !(target instanceof Element) || root.contains(target)) return;
      if (target.closest(`${OVER_LAYERS}, .toasts, .tooltip`)) return;
      focusInside(root);
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocusIn);
      window.requestAnimationFrame(() => {
        // The Team sheet is rebuilt when a visit closes, so its Visit button is a
        // new element: find this teammate's again. From the office, their own
        // critter (a waving balloon or a speech note may be gone by now).
        const target =
          (previous?.isConnected ? previous : null) ??
          (openedFromTeam
            ? document.querySelector<HTMLElement>(
                `.employee-card__talk[data-employee="${employeeId}"]`,
              )
            : null) ??
          document.querySelector<HTMLElement>(`.critter-btn[data-employee="${employeeId}"]`) ??
          document.querySelector<HTMLElement>('.dock__item[data-dock="team"]');
        if (!target) return;
        target.focus({ preventScroll: true });
        if (openedFromTeam) target.scrollIntoView({ block: 'nearest' });
      });
    };
  }, [employeeId, engine, opener]);

  // Focus follows the conversation: when it opens and after every answer (the
  // answered button is gone), the first answer still open — or the way out.
  const exchanges = active?.exchanges ?? 0;
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const current = document.activeElement;
    if (current instanceof HTMLElement && root.contains(current) && current !== root) return;
    focusInside(root);
  }, [talkInstanceId, exchanges, tab]);

  // They speak: a short babble in their own voice whenever a new line appears.
  const node = active?.nodeId ? active.topic.nodes[active.nodeId] : null;
  const promptKey = node ? (active?.promptKey ?? nodePrompt(state, node)) : null;
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
  const moodLabel = moodWord(t, mood, def.id);
  const roomId = resolveEmployeeRoom(state, def.id);
  const roomName = t(ROOMS_BY_ID[roomId]?.nameKey ?? roomId);
  const fit = roomAffinity(def.id, roomId);
  const finished = !node;
  const cooldown = talkCooldownRemaining(state, def.id, now);
  const evaluated = node ? evaluateTalkNode(state, def.id, node.choices, now) : [];
  const otherTopics =
    active.exchanges === 0 && !active.profileOnly
      ? eligibleTopics(state, def.id, now).filter((topic) => topic.id !== active.topic.id)
      : [];
  const story = storyState(state, def.id, now);
  const keepsake = keepsakeOnDisplay(state, def.id);

  // Where they speak from: beside them in the scene when it has the room for both,
  // otherwise at the head of the notepad below them.
  const sceneSpeech = stage.width >= 420 && stage.height >= 400;

  // One scale for the whole cast (the same for every teammate in this window), as
  // large as the stage allows and never enlarging anyone's art.
  const scale = castScaleFor((stage.height || 360) * (sceneSpeech ? 0.4 : 0.88));
  const spriteHeight = sprite ? Math.round(sprite.officeHeight * scale) : 0;
  const vectorSize = Math.round(VECTOR_CRITTER_OFFICE_SIZE * scale);
  const actorHeight = sprite ? spriteHeight : vectorSize;
  const actorWidth = sprite
    ? Math.round((spriteHeight * sprite.frameWidth) / sprite.frameHeight)
    : vectorSize;
  // Where their head starts, from the bottom of their art (the sticker's anchor).
  const head = sprite ? 1 - sprite.figureTop : 0.9;

  // How the last thing said landed: a hop, a wobble, or a thoughtful tilt.
  const mine = active.report?.employees.find((e) => e.id === def.id);
  const react =
    cheer > 0 && !active.report
      ? 'joy'
      : !active.report
        ? 'idle'
        : (mine?.friendshipDelta ?? 0) > 0
          ? 'joy'
          : (mine?.friendshipDelta ?? 0) < 0
            ? 'hurt'
            : 'think';

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

  // ---- what the conversation left behind ---------------------------------------------
  // Said when it ends, besides what it changed (which is on the stage): where their
  // story stands now, whether something will come of it later or they will bring it
  // up (never what), and a Moment Card filed. Read from the engine and the story.
  const after = finished ? active.aftermath : undefined;
  const storyAfter = finished && active.topic.story && active.exchanges > 0 ? story : null;
  const afterNotes: Array<{ key: string; icon: React.ReactNode; text: string }> = [];
  if (storyAfter) {
    const line =
      storyAfter.told === 3
        ? t('visit.storyWaiting.done')
        : storyAfter.waitingFor === 'friendship' && storyAfter.next
          ? t('visit.storyWaiting.friendship', { tier: tierName(storyAfter.next) })
          : storyAfter.waitingFor === 'time'
            ? t('visit.storyWaiting.time')
            : storyAfter.readyTopicId
              ? t('visit.storyWaiting.ready')
              : null;
    if (line) afterNotes.push({ key: 'story', icon: <Glyph name="note" size={12} />, text: line });
  }
  if (after?.later) {
    afterNotes.push({
      key: 'later',
      icon: <Icon name="refresh" size={13} />,
      text: t('incident.inMotion'),
    });
  }
  if (after?.remembered) {
    afterNotes.push({
      key: 'remembered',
      icon: <Icon name="employees" size={13} />,
      text: t('incident.remembered', { name }),
    });
  }
  // A gift's own souvenir is said by the notebook line below it.
  if (after?.moment && active.topic.id !== 'gift') {
    afterNotes.push({
      key: 'moment',
      icon: <Icon name="moment" size={13} />,
      text: t('visit.momentFiled'),
    });
  }

  /** Open their keepsake in the scrapbook (from the reveal, or the object by them). */
  function showKeepsake() {
    pickTab('scrapbook');
    window.requestAnimationFrame(() => {
      const card = document.getElementById(keepsakeCardId(def.id));
      card?.scrollIntoView({ block: 'nearest' });
      card?.focus({ preventScroll: true });
    });
  }

  function give(gift: GiftId) {
    if (!engine.openTalk(def.id, 'gift', true)) return;
    const instance = engine.activeTalk?.instanceId;
    if (engine.chooseTalkOption(gift, instance)) {
      audio.play(gift === 'coffee' ? 'coffee' : 'reward');
      setTab('talk');
    }
  }

  // ---- a visit action: back to the room they love --------------------------------
  const home = def.room;
  const homeName = t(ROOMS_BY_ID[home]?.nameKey ?? home);
  const canGoHome = roomId !== home && Boolean(ROOMS_BY_ID[home]) && isRoomIdUnlocked(state, home);
  const homeFull = canGoHome && !roomHasSpace(state, home);
  function goHome() {
    if (!canGoHome) return;
    if (homeFull || !engine.assignEmployee(def.id, home)) {
      audio.play('error');
      setSlip({ key: Date.now(), text: t('visit.moveHomeFull', { room: homeName }), tone: 'bad' });
      return;
    }
    audio.play('upgrade');
    setCheer((n) => n + 1);
    setSlip({ key: Date.now(), text: t('visit.moved', { name, room: homeName }), tone: 'good' });
    // The button has done its job and goes; keep the keyboard in the visit.
    window.requestAnimationFrame(() => focusInside(rootRef.current));
  }

  const closeLabel = view === 'employees' ? t('visit.backToTeam') : t('visit.close');

  // Beside a roomy scene the action stands on its floor; in a corner window it
  // waits on the notepad with the way out, so it never covers anyone's desk.
  const homeAction = canGoHome ? (
    <button
      type="button"
      className={`visit__act ${sceneSpeech ? '' : 'visit__act--pad'}`}
      data-act="home"
      aria-disabled={homeFull ? true : undefined}
      title={
        homeFull
          ? t('visit.moveHomeFull', { room: homeName })
          : t('visit.moveHomeGain', { room: homeName, value: affinityPercent(def.id, home) })
      }
      onClick={goHome}
    >
      <Glyph name="heart" size={11} />
      <span className="visit__act-label">{t('visit.moveHome')}</span>
      <span className="visit__act-room">{homeName}</span>
    </button>
  ) : null;
  const slipEl = slip ? (
    <p
      className={`visit__slip ${sceneSpeech ? '' : 'visit__slip--pad'}`}
      role="status"
      data-tone={slip.tone}
      key={slip.key}
    >
      {slip.text}
    </p>
  ) : null;

  // ---- what they say ----------------------------------------------------------
  const speech =
    active.lastReplyKey || (node && promptKey) ? (
      <div
        className={`visit__speech ${sceneSpeech ? 'visit__speech--scene' : 'visit__speech--pad'}`}
      >
        {active.lastReplyKey ? (
          <blockquote
            className="talk__said talk__said--reply"
            aria-live="polite"
            key={`${active.instanceId}:${active.exchanges}`}
          >
            <span className="talk__reply">{t(active.lastReplyKey)}</span>
            {node && promptKey ? <span className="talk__next">{t(promptKey)}</span> : null}
          </blockquote>
        ) : node && promptKey ? (
          <blockquote className="talk__said" aria-live="polite" key={active.instanceId}>
            {t(promptKey)}
          </blockquote>
        ) : null}
      </div>
    ) : null;

  // ---- the stage --------------------------------------------------------------
  const stageEl = (
    <section
      className="visit__stage"
      ref={stageRef}
      style={{
        ['--dept' as string]: DEPT[roomId] ?? 'var(--dept-founder)',
        ['--actor-h' as string]: `${actorHeight}px`,
        ['--actor-w' as string]: `${actorWidth}px`,
        ['--head' as string]: head.toFixed(3),
      }}
    >
      <RoomDressing roomId={roomId} />
      <span className="visit__spot" aria-hidden />
      <div
        className="visit__actor"
        data-react={react}
        key={`${active.instanceId}:${active.exchanges}:${cheer}`}
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
        {/* Their mood, stuck by their head (it moves with them), and named. */}
        <span
          className="visit__mood"
          data-mood={mood}
          data-tone={MOOD_POSITIVE[mood] ? 'up' : 'down'}
          title={t('visit.moodOf', { name, mood: moodLabel })}
        >
          <span
            className="visit__sticker"
            key={STICKER_FOR_MOOD[mood]}
            data-sticker={STICKER_FOR_MOOD[mood]}
            aria-hidden
          >
            <StickerArt kind={STICKER_FOR_MOOD[mood]} />
          </span>
          <span className="visit__mood-word">{moodLabel}</span>
        </span>
        {keepsake ? (
          // Their keepsake, beside them: pick it up to read about it in the scrapbook.
          <button
            type="button"
            className="visit__keepsake"
            data-employee={def.id}
            title={t('visit.keepsake.seeItem', { item: t(def.favoriteItemKey) })}
            aria-label={t('visit.keepsake.seeItem', { item: t(def.favoriteItemKey) })}
            onClick={showKeepsake}
          >
            <KeepsakeArt employeeId={def.id} />
          </button>
        ) : null}
      </div>
      <header className="visit__plate">
        <h2 id="talk-name" className="talk__name">
          {name}
        </h2>
        <p className="talk__role">{t(def.roleKey)}</p>
        <p className="visit__where" data-fit={fit}>
          <span className="visit__where-room">{roomName}</span>
          {fit !== 'acceptable' ? (
            <span className="visit__fit" data-fit={fit}>
              <Glyph name={fit === 'favorite' ? 'heart' : 'tilde'} size={10} />
              {t(`visit.fit.${fit}`)}
            </span>
          ) : null}
        </p>
      </header>
      {sceneSpeech ? speech : null}
      <BondMeter friendship={rt.friendship} celebrate={Boolean(milestone)} />
      {deltas.length > 0 ? (
        <div
          className="talk__changed"
          data-count={deltas.length}
          role="status"
          key={`${active.instanceId}:${active.exchanges}`}
        >
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
      {sceneSpeech ? homeAction : null}
      {sceneSpeech ? slipEl : null}
      <button
        className="talk__close"
        onClick={() => engine.closeTalk()}
        aria-label={closeLabel}
        title={closeLabel}
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
          {sceneSpeech ? null : homeAction}
          {sceneSpeech ? null : slipEl}
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
          {/* What this word is about, said like a memo heading (a story's title
              already says it all). */}
          {sceneSpeech && active.topic.blurbKey !== active.topic.titleKey ? (
            <p className="visit__blurb">{t(active.topic.blurbKey)}</p>
          ) : null}
          {/* In a corner window their words head the notepad (the tail points up
              at them); in a roomy one they float beside them in the scene. */}
          {sceneSpeech ? null : speech}
          <div className="visit__answers">
            {node ? (
              <div className="talk__choices" role="group" aria-label={t('visit.youSay')}>
                {sceneSpeech ? (
                  <span className="visit__you" aria-hidden>
                    {t('visit.youSay')}
                  </span>
                ) : null}
                {evaluated.map(({ choice, enabled, failures }) => {
                  // What it costs, said before it is taken (a locked one says what it needs).
                  const cost = talkChoiceCost(choice);
                  const golden = cost.goldenNuts > 0;
                  const price = golden ? cost.goldenNuts : cost.nuts;
                  const costText =
                    price > 0
                      ? t(golden ? 'talk.cost.goldenNuts' : 'talk.cost.nuts', {
                          value: fmt.int(price),
                        })
                      : null;
                  return (
                    <button
                      key={choice.id}
                      className={`talk-choice talk-choice--${choice.tone ?? 'warm'}`}
                      data-option-id={choice.id}
                      data-eligible={enabled}
                      aria-disabled={!enabled}
                      onClick={() => {
                        if (!enabled) {
                          audio.play('error');
                          return;
                        }
                        if (engine.chooseTalkOption(choice.id, active.instanceId))
                          audio.play('paper');
                      }}
                    >
                      <span className="talk-choice__label">{t(choice.labelKey)}</span>
                      {costText && enabled ? (
                        <span className="talk-choice__cost" title={costText}>
                          <Icon name={golden ? 'golden' : 'nut'} size={12} />
                          <span aria-hidden>{fmt.int(price)}</span>
                          <span className="sr-only">{costText}</span>
                        </span>
                      ) : null}
                      {failures.length > 0 ? (
                        <span className="talk-choice__req">
                          {failures.map(requirementText).join(' · ')}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="talk__end">
                {/* The end of a story: their keepsake goes on their desk. */}
                {after?.keepsake ? (
                  <div className="visit__reveal" role="status">
                    <span className="visit__reveal-art" aria-hidden>
                      <KeepsakeArt employeeId={def.id} />
                    </span>
                    <span className="visit__reveal-text">
                      <strong>{t(def.favoriteItemKey)}</strong>
                      <span>
                        {t('visit.keepsake.revealed', {
                          name,
                          context: CHARACTERS[def.id]?.gender,
                        })}
                      </span>
                    </span>
                    <button type="button" className="visit__reveal-see" onClick={showKeepsake}>
                      {t('visit.keepsake.see')}
                    </button>
                  </div>
                ) : null}
                {active.topic.id === 'gift' &&
                state.flags[`favorite.${def.id}.giftMemory`] !== undefined &&
                knownFavorite(state, def.id) ? (
                  <p className="talk__gift-filed">{t('gifts.memoryFiled')}</p>
                ) : null}
                {afterNotes.length > 0 ? (
                  <ul className="visit__after">
                    {afterNotes.map((note) => (
                      <li
                        key={note.key}
                        className={`visit__after-note visit__after-note--${note.key}`}
                      >
                        {note.icon}
                        <span>{note.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="talk__end-note">{t('talk.ended')}</p>
                <div className="visit__end-row">
                  <button className="buy-btn talk__done" onClick={() => engine.closeTalk()}>
                    {closeLabel}
                  </button>
                  {sceneSpeech ? null : homeAction}
                </div>
                {sceneSpeech ? null : slipEl}
              </div>
            )}
          </div>
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
  const scrapbookPage = <VisitScrapbook state={state} employeeId={def.id} now={now} />;

  const tabs: Array<{ id: VisitTab; icon: 'employees' | 'golden' | 'moment' }> = [
    { id: 'talk', icon: 'employees' },
    { id: 'gifts', icon: 'golden' },
    { id: 'scrapbook', icon: 'moment' },
  ];
  // A gentle signal on a tab with something new for you.
  const tabNews: Partial<Record<VisitTab, boolean>> = {
    gifts: Boolean(hint) && !(`${def.id}.hint` in state.flags),
  };
  function pickTab(next: VisitTab, focus = false) {
    audio.play('click');
    setTab(next);
    if (focus) {
      window.requestAnimationFrame(() =>
        rootRef.current?.querySelector<HTMLElement>(`.visit__tab[data-tab="${next}"]`)?.focus(),
      );
    }
  }
  // Arrow keys move between the three tabs; Home and End jump to the ends.
  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    const order = tabs.map((item) => item.id);
    const index = order.indexOf(tab);
    const next =
      event.key === 'ArrowRight'
        ? order[(index + 1) % order.length]
        : event.key === 'ArrowLeft'
          ? order[(index - 1 + order.length) % order.length]
          : event.key === 'Home'
            ? order[0]
            : event.key === 'End'
              ? order[order.length - 1]
              : null;
    if (!next) return;
    event.preventDefault();
    pickTab(next, true);
  }
  // The visit is the whole screen: Tab and Shift+Tab go round inside it.
  function onTrapKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !rootRef.current) return;
    const focusable = [...rootRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => element.offsetParent !== null || element === document.activeElement,
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        !focusable.includes(document.activeElement as HTMLElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={rootRef}
      className="talk talk--destination visit"
      role="region"
      aria-labelledby="talk-name"
      data-employee={def.id}
      data-topic={active.topic.id}
      data-node={active.nodeId || 'end'}
      data-step={active.exchanges > 0 ? 'later' : 'first'}
      data-tab={tab}
      data-speech={sceneSpeech ? 'scene' : 'pad'}
      data-fit={fit}
      onKeyDown={onTrapKey}
    >
      <div className="talk__sheet visit__frame">
        {stageEl}
        <section className="visit__panel">
          <div
            className="visit__tabs"
            role="tablist"
            aria-label={t('gifts.visitActions')}
            onKeyDown={onTabKey}
          >
            {tabs.map((item) => (
              <button
                key={item.id}
                id={`visit-tab-${item.id}`}
                role="tab"
                className={`visit__tab ${tab === item.id ? 'is-active' : ''}`}
                aria-selected={tab === item.id}
                aria-controls="visit-page"
                tabIndex={tab === item.id ? 0 : -1}
                data-tab={item.id}
                data-news={tabNews[item.id] ? 'true' : undefined}
                onClick={() => pickTab(item.id)}
              >
                <Icon name={item.icon} size={14} />
                <span>{t(`visit.tab.${item.id}`)}</span>
              </button>
            ))}
          </div>
          <div
            id="visit-page"
            className="visit__page"
            role="tabpanel"
            aria-labelledby={`visit-tab-${tab}`}
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
