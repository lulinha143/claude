import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CuriosityLog } from '../CuriosityLog';
import { ROOMS_BY_ID } from '../../content/rooms';
import { secretSource } from '../../sim/happenings';
import { useTranslation } from 'react-i18next';
import { DiscoveryArt } from '../../art/DiscoveryArt';
import { KeepsakeArt } from '../../art/KeepsakeArt';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { NUTS } from '../../content/nuts';
import { EMPLOYEES, EMPLOYEES_BY_ID } from '../../content/employees';
import { CHARACTERS } from '../../content/characters';
import { keepsakeTopicId } from '../../content/employeeKeepsakes';
import { historyLabelKeys } from '../../content/historyLabels';
import { NutDot, GoldenNut } from '../../art/Icons';
import { Icon, type IconName } from '../../art/UiIcon';
import { EnsembleNotes } from '../EnsembleNotes';
import { momentCardToPng, type MomentCardData } from '../momentCard';
import { momentFormat, momentRef } from '../momentFormats';
import {
  collectionShelf,
  nutTurnsUpIn,
  type ShelfEntry,
  type ShelfId,
  type ShelfLine,
} from '../../sim/collections';
import { keepsakeFor } from '../../sim/bonds';
import { eligibleTopics } from '../../sim/talks';
import { isDecorationOwned } from '../../sim/decorations';
import {
  MICRO_CALIBRATION,
  MICRO_MODES,
  MICRO_SOUVENIRS,
  isMicroMastered,
} from '../../sim/minigames';
import type { GameState, MomentCard } from '../../sim/types';

// The Archive's collections: a cabinet of drawers, one per kind of thing the
// company keeps (nuts, curiosities and secret files, decoration sets, keepsakes,
// masteries, outfits, Moment Cards). Each drawer says how far along it is, what
// can be done for it now, and what finishing it really pays; opening it shows the
// pieces. Every count is read from where the thing is earned (sim/collections.ts),
// so nothing here can say "missing" about something the office already shows.

const DRAWER_ICON: Record<ShelfId, IconName> = {
  nuts: 'encyclopedia',
  curiosities: 'hidden',
  sets: 'decorate',
  keepsakes: 'employees',
  masteries: 'minigame',
  outfits: 'paw',
  moments: 'moment',
};

/** Shelf rewards that are paid in golden nuts. */
const GOLDEN_REWARDS = new Set([
  'nutsMilestone',
  'roomFileReward',
  'masteryReward',
  'masteryRewardOwned',
]);

/** A modal is on top: Escape belongs to it. */
const MODAL_LAYERS = '.popup-backdrop, .modal-backdrop, .photo-mode';

/**
 * The drawer left open. A visit opened from a drawer (a keepsake's album) rebuilds the
 * Archive behind it; coming back, the player is where they were.
 */
let rememberedDrawer: ShelfId | null = null;

export function CollectionsView() {
  const { t } = useTranslation();
  const { state, engine } = useGame();
  const setPhotoMode = useStore((s) => s.setPhotoMode);
  const [open, setOpenState] = useState<ShelfId | null>(rememberedDrawer);
  const setOpen = (id: ShelfId | null) => {
    rememberedDrawer = id;
    setOpenState(id);
  };
  const backRef = useRef<HTMLButtonElement>(null);
  const lastOpened = useRef<ShelfId | null>(rememberedDrawer);
  const shelfRef = useRef<HTMLUListElement>(null);
  const now = Date.now();
  const shelf = collectionShelf(state, now);
  const line = useShelfLine();

  // Opening a drawer takes focus to its way back; closing returns to its label.
  // Escape inside a drawer steps back to the cabinet instead of closing the Archive.
  useEffect(() => {
    if (open) {
      // The drawer opens at its head (the cabinet may have been scrolled to it).
      // Only the sheet's own scroller moves: scrollIntoView also scrolled the
      // stage behind it (overflow hidden, but still scrollable by script), which in
      // a corner window pushed the Archive's head off the top and left a dark band
      // above the dock.
      const drawer = backRef.current?.closest<HTMLElement>('.collection-open');
      const scroller = drawer?.closest<HTMLElement>('.sheet__body');
      if (drawer && scroller) {
        scroller.scrollTop +=
          drawer.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      }
      backRef.current?.focus({ preventScroll: true });
      const onKey = (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        if (document.querySelector(MODAL_LAYERS)) return;
        // Only while the Archive has the keyboard: a visit or a card opened from a
        // drawer takes its own Escape first.
        const sheet = backRef.current?.closest('.sheet');
        if (!sheet?.contains(document.activeElement)) return;
        event.preventDefault();
        setOpen(null);
      };
      window.addEventListener('keydown', onKey, true);
      return () => window.removeEventListener('keydown', onKey, true);
    }
    if (lastOpened.current) {
      const label = shelfRef.current?.querySelector<HTMLButtonElement>(
        `[data-drawer="${lastOpened.current}"]`,
      );
      label?.scrollIntoView({ block: 'nearest' });
      label?.focus({ preventScroll: true });
    }
    return undefined;
  }, [open]);

  // Closed by the player (or another Archive page chosen), it opens on the cabinet
  // next time; rebuilt under a visit, it keeps the drawer.
  useEffect(
    () => () => {
      if (!engine.activeTalk) rememberedDrawer = null;
    },
    [engine],
  );

  const openDrawer = (id: ShelfId) => {
    lastOpened.current = id;
    setOpen(id);
  };
  const entry = open ? shelf.find((item) => item.id === open) : undefined;

  return (
    <section className="view view--collections">
      <div className="view__head">
        <h2>{t('collections.title')}</h2>
        <button className="ghost-btn" onClick={() => setPhotoMode(true)}>
          {t('collections.photoMode')}
        </button>
      </div>

      {!entry ? (
        <ul className="collection-shelf" ref={shelfRef} aria-label={t('collections.title')}>
          {shelf.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`collection-drawer ${isComplete(item) ? 'is-complete' : ''}`}
                data-drawer={item.id}
                onClick={() => openDrawer(item.id)}
              >
                <span className="collection-drawer__icon" aria-hidden>
                  <Icon name={DRAWER_ICON[item.id]} size={16} />
                </span>
                <span className="collection-drawer__title">
                  {t(`collections.drawer.${item.id}`)}
                </span>
                <span className="collection-drawer__count">
                  <ShelfCount entry={item} />
                </span>
                {item.total ? (
                  <span className="collection-drawer__bar" aria-hidden>
                    <span style={{ width: `${(item.have / item.total) * 100}%` }} />
                  </span>
                ) : null}
                {item.next ? (
                  <span className="collection-drawer__next">{line(item.next)}</span>
                ) : null}
                {item.reward ? (
                  <span className="collection-drawer__reward" data-reward={item.reward.key}>
                    {/* Gold only where it pays golden nuts; a set's bonus is not money. */}
                    {GOLDEN_REWARDS.has(item.reward.key) ? (
                      <GoldenNut size={12} />
                    ) : (
                      <Icon name="success" size={12} />
                    )}
                    {line(item.reward)}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="collection-open" data-drawer={entry.id}>
          <div className="collection-open__head">
            <button
              ref={backRef}
              type="button"
              className="ghost-btn collection-open__back"
              onClick={() => setOpen(null)}
            >
              <Icon name="back" size={13} /> {t('collections.back')}
            </button>
            <h3 className="collection-open__title">{t(`collections.drawer.${entry.id}`)}</h3>
            <span className="collection-open__count">
              <ShelfCount entry={entry} />
            </span>
          </div>
          {entry.next && entry.next.key !== 'complete' ? (
            <p className="collection-open__next">{line(entry.next)}</p>
          ) : null}
          {entry.id === 'nuts' ? <NutDrawer now={now} /> : null}
          {entry.id === 'curiosities' ? <CuriositiesDrawer /> : null}
          {entry.id === 'sets' ? <SetsDrawer /> : null}
          {entry.id === 'keepsakes' ? <KeepsakesDrawer now={now} /> : null}
          {entry.id === 'masteries' ? <MasteriesDrawer /> : null}
          {entry.id === 'outfits' ? <OutfitsDrawer /> : null}
          {entry.id === 'moments' ? <MomentsDrawer /> : null}
        </div>
      )}
    </section>
  );
}

function isComplete(entry: ShelfEntry): boolean {
  return entry.total !== null && entry.total > 0 && entry.have >= entry.total;
}

function ShelfCount({ entry }: { entry: ShelfEntry }) {
  const { t } = useTranslation();
  const main =
    entry.total !== null
      ? t('collections.countOf', { have: entry.have, total: entry.total })
      : t('collections.countFiled', { count: entry.have });
  return (
    <>
      {main}
      {entry.extra ? ` · ${t('collections.secretFiles', { count: entry.extra })}` : null}
    </>
  );
}

/** Translate a shelf line, naming whatever it points at. */
function useShelfLine() {
  const { t } = useTranslation();
  const { state } = useGame();
  return (item: ShelfLine) => {
    const def = item.employeeId ? EMPLOYEES_BY_ID[item.employeeId] : undefined;
    const outfit = def?.outfits.find((candidate) => candidate.id === item.outfitId);
    return t(`collections.next.${item.key}`, {
      ...item.params,
      count:
        item.params?.count ??
        item.params?.left ??
        item.params?.missing ??
        item.params?.golden ??
        item.params?.cost ??
        item.params?.need,
      room: item.roomId ? t(ROOMS_BY_ID[item.roomId]?.nameKey ?? '') : '',
      name: item.employeeId
        ? (state.employees[item.employeeId]?.nickname ?? t(def?.nameKey ?? ''))
        : '',
      set: item.setId ? t(`ensemble.${item.setId}.name`) : '',
      effect: item.setId ? t(`ensemble.${item.setId}.effect`) : '',
      game: item.mode ? t(`microgame.${item.mode}.name`) : '',
      outfit: outfit ? t(outfit.nameKey) : '',
      souvenir: item.souvenirId ? t(`deco.${item.souvenirId}.name`) : '',
    });
  };
}

// ---- the drawers -------------------------------------------------------------------

function NutDrawer({ now }: { now: number }) {
  const { t } = useTranslation();
  const { state } = useGame();
  const found = new Set(state.collections.nuts);
  return (
    <ul className="nut-grid">
      {NUTS.map((n) => {
        const has = found.has(n.id);
        // Where it can turn up right now; nothing when it cannot yet (its
        // conditions are part of finding it).
        const where = has ? null : nutTurnsUpIn(state, n.id, now);
        return (
          <li key={n.id} className={`nut-cell ${has ? '' : 'is-locked'}`} data-nut={n.id}>
            <NutDot color={has ? n.color : '#4a4038'} size={30} />
            <span className="nut-cell__name">{has ? t(n.nameKey) : '???'}</span>
            <span className="nut-cell__desc">
              {has
                ? t(n.descriptionKey)
                : where
                  ? t('collections.nutWhere', { room: t(ROOMS_BY_ID[where]?.nameKey ?? '') })
                  : t('collections.undiscovered')}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const SECRET_ART: Record<string, string> = {
  'anomaly.silence': 'annex-broadcast',
  'anomaly.deskNames': 'annex-repair',
  'anomaly.thursday': 'annex-conservatory',
};

function CuriositiesDrawer() {
  const { t } = useTranslation();
  const { state } = useGame();
  const secrets = [...new Set(state.collections.secrets.filter((id) => !id.startsWith('deco:')))];
  return (
    <>
      <CuriosityLog state={state} />
      <h4 className="collection-open__sub">{t('collections.secrets')}</h4>
      {secrets.length ? (
        <ul className="secret-files">
          {secrets.map((secret, index) => (
            <li key={secret} className="secret-file" data-artifact={secret}>
              <DiscoveryArt eventId={SECRET_ART[secret] ?? ''} />
              <small>
                {t('secretFile.classification')} · {String(index + 1).padStart(3, '0')}
              </small>
              <h3>
                {t(`secretFile.${secret.replace(/[.-]/g, '_')}.title`, {
                  defaultValue: t('secretFile.unknown.title'),
                })}
              </h3>
              <p>
                {t(`secretFile.${secret.replace(/[.-]/g, '_')}.body`, {
                  defaultValue: t('secretFile.unknown.body'),
                })}
              </p>
              {/* Where it came from: the decision that filed it. */}
              {secretSource(secret) ? (
                <p className="secret-file__from">
                  {t('secretFile.from', { event: t(secretSource(secret)!.event.titleKey) })}
                </p>
              ) : null}
              <span>{t('secretFile.stamp')}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">
          <strong className="empty-state__title">{t('collections.emptySecrets.title')}</strong>
          <span className="empty-state__hint">{t('collections.emptySecrets.hint')}</span>
        </p>
      )}
    </>
  );
}

function SetsDrawer() {
  const { t } = useTranslation();
  const setView = useStore((s) => s.setView);
  return (
    <>
      <EnsembleNotes flat />
      <button
        type="button"
        className="ghost-btn collection-open__go"
        onClick={() => setView('decorate')}
      >
        <Icon name="decorate" size={13} /> {t('collections.toDecorate')}
      </button>
    </>
  );
}

/** What the player has first, then what is within reach, then the rest of the roster. */
function keepsakeOrder(state: GameState, now: number) {
  const rank = (id: string) => {
    if (keepsakeFor(state, id)) return 0;
    if (!state.employees[id]?.hired) return 3;
    return eligibleTopics(state, id, now).some((topic) => topic.id === keepsakeTopicId(id)) ? 1 : 2;
  };
  return EMPLOYEES.map((def, index) => ({ def, index, rank: rank(def.id) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((item) => item.def);
}

function KeepsakesDrawer({ now }: { now: number }) {
  const { t } = useTranslation();
  const { state, engine } = useGame();
  const fmt = useFmt();
  const audio = useStore((s) => s.audio);
  return (
    <ul className="keepsake-shelf">
      {keepsakeOrder(state, now).map((def) => {
        const rt = state.employees[def.id];
        const name = rt?.nickname ?? t(def.nameKey);
        const view = keepsakeFor(state, def.id);
        const context = CHARACTERS[def.id]?.gender;
        if (view) {
          return (
            <li key={def.id} className="keepsake-slot is-known" data-employee={def.id}>
              <span className="keepsake-slot__art" aria-hidden>
                <KeepsakeArt employeeId={def.id} />
              </span>
              <span className="keepsake-slot__body">
                <strong>{t(view.itemKey)}</strong>
                <small>
                  {name} ·{' '}
                  {!rt?.hired
                    ? t('collections.keepsakeAway')
                    : view.onDisplay
                      ? t('visit.keepsake.onDesk', { date: fmt.date(view.since ?? 0), context })
                      : t('collections.keepsakeDrawer')}
                </small>
              </span>
              {rt?.hired ? (
                <button
                  type="button"
                  className="mini-btn keepsake-slot__see"
                  aria-label={t('visit.keepsake.seeItem', { item: t(view.itemKey) })}
                  onClick={() => {
                    if (engine.openTalk(def.id, undefined, true, { tab: 'scrapbook' }))
                      audio.play('paper');
                  }}
                >
                  {t('visit.keepsake.see')}
                </button>
              ) : null}
            </li>
          );
        }
        // Not known yet: the owner is public (the Team lists everyone); the object is not.
        const ready =
          rt?.hired &&
          eligibleTopics(state, def.id, now).some((topic) => topic.id === keepsakeTopicId(def.id));
        const hint = !rt?.hired
          ? t('collections.keepsakeHire', { name })
          : ready
            ? t('collections.keepsakeReady')
            : t('collections.keepsakeTrust', {
                count: Math.max(1, Math.ceil(20 - (rt.friendship ?? 0))),
              });
        return (
          <li key={def.id} className="keepsake-slot" data-employee={def.id}>
            <span className="keepsake-slot__art keepsake-slot__art--blank" aria-hidden>
              <Icon name="lock" size={14} />
            </span>
            <span className="keepsake-slot__body">
              <strong>{t('collections.keepsakeOf', { name })}</strong>
              <small>{hint}</small>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function MasteriesDrawer() {
  const { t } = useTranslation();
  const { state } = useGame();
  const requestActivity = useStore((s) => s.requestActivity);
  return (
    <ul className="mastery-shelf">
      {MICRO_MODES.map((mode) => {
        const mastered = isMicroMastered(state, mode);
        const best = Math.floor(state.microgames[mode]?.best ?? 0);
        const line = MICRO_CALIBRATION[mode].mastery;
        const souvenir = MICRO_SOUVENIRS[mode];
        const owned = isDecorationOwned(state, souvenir);
        return (
          <li
            key={mode}
            className={`mastery-slot ${mastered ? 'is-mastered' : ''}`}
            data-mode={mode}
          >
            <span className="mastery-slot__body">
              <strong>{t(`microgame.${mode}.name`)}</strong>
              <small>
                {mastered
                  ? t('collections.masteryDone', { best })
                  : t('collections.masteryProgress', { best, line })}
              </small>
              <span className="mastery-slot__bar" aria-hidden>
                <span style={{ width: `${Math.min(100, (best / line) * 100)}%` }} />
              </span>
              <small>
                {owned
                  ? t('collections.souvenirOwned', { souvenir: t(`deco.${souvenir}.name`) })
                  : t('collections.souvenirWaiting', { souvenir: t(`deco.${souvenir}.name`) })}
              </small>
            </span>
            <button
              type="button"
              className="mini-btn mini-btn--primary"
              onClick={() => requestActivity(mode)}
            >
              {t('collections.play')}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function OutfitsDrawer() {
  const { t } = useTranslation();
  const { state } = useGame();
  const setView = useStore((s) => s.setView);
  const owned = new Set(state.collections.outfits);
  return (
    <>
      <p className="collection-open__note">{t('collections.outfitsIntro')}</p>
      <ul className="outfit-shelf">
        {EMPLOYEES.map((def) => {
          const rt = state.employees[def.id];
          const special = def.outfits.filter((outfit) => outfit.cost.amount > 0);
          if (!special.length) return null;
          return (
            <li key={def.id} className="outfit-row" data-employee={def.id}>
              <span className="outfit-row__who">{rt?.nickname ?? t(def.nameKey)}</span>
              <span className="outfit-row__items">
                {special.map((outfit) => {
                  const has = owned.has(outfit.id);
                  const wearing = rt?.outfitId === outfit.id;
                  return (
                    <span
                      key={outfit.id}
                      className={`outfit-swatch ${has ? 'is-owned' : ''}`}
                      data-outfit={outfit.id}
                    >
                      <span className="dot" style={{ background: outfit.accent }} aria-hidden />
                      {t(outfit.nameKey)}
                      <small>
                        {wearing ? (
                          t('collections.outfitWearing')
                        ) : has ? (
                          t('collections.outfitOwned')
                        ) : (
                          <>
                            <GoldenNut size={11} /> {outfit.cost.amount}
                          </>
                        )}
                      </small>
                    </span>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="ghost-btn collection-open__go"
        onClick={() => setView('employees')}
      >
        <Icon name="employees" size={13} /> {t('collections.toTeam')}
      </button>
    </>
  );
}

function MomentsDrawer() {
  const { t } = useTranslation();
  const { state } = useGame();
  const fmt = useFmt();
  const [viewing, setViewing] = useState<MomentCard | null>(null);
  const [query, setQuery] = useState('');
  const matchingMoments = state.collections.moments.filter((card) => {
    const employee = EMPLOYEES.find((person) => person.id === card.employeeId);
    return [
      t(historyLabelKeys(card.eventId).titleKey),
      t(card.caption),
      employee ? t(employee.nameKey) : '',
      momentRef(card),
    ]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase());
  });

  function cardData(card: MomentCard): MomentCardData {
    const labels = historyLabelKeys(card.eventId);
    const employee = card.employeeId ? EMPLOYEES.find((e) => e.id === card.employeeId) : null;
    const spec = momentFormat(card);
    return {
      card,
      companyName: state.company.name,
      title: t(labels.titleKey),
      caption: t(card.caption),
      rarityLabel: t(`moment.rarity.${card.rarity}`),
      employeeName: employee ? t(employee.nameKey) : null,
      dateLabel: fmt.date(card.createdAt),
      // The same descriptor the collection grid renders from, translated here so the
      // exported PNG says exactly what the on-screen document says.
      formatLabel: t(spec.headingKey),
      orgLabel: t('moment.from'),
      refLabel: t(spec.refLabelKey),
      refCode: momentRef(card),
      stampLabel: spec.stampKey ? t(spec.stampKey) : null,
    };
  }

  function saveCard(card: MomentCard) {
    const png = momentCardToPng(cardData(card));
    if (!png) return;
    const a = document.createElement('a');
    a.href = png;
    a.download = `moment-${card.id}.png`;
    a.click();
  }

  if (state.collections.moments.length === 0) {
    /* An empty collection should say what belongs in it. */
    return (
      <p className="empty-state">
        <strong className="empty-state__title">{t('collections.emptyMoments.title')}</strong>
        <span className="empty-state__hint">{t('collections.emptyMoments.hint')}</span>
      </p>
    );
  }

  return (
    <>
      <label className="archive-search field">
        <span>{t('collections.searchArchive')}</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        <small role="status">
          {t('collections.archiveMatches', { count: matchingMoments.length })}
        </small>
      </label>
      {/* A COLLECTION OF DOCUMENTS, not a list of rows: each moment is the document it
          is, in the same format the PNG exporter draws (ui/momentFormats.ts). */}
      <ul className="moment-grid">
        {matchingMoments
          .slice()
          .reverse()
          .map((card) => {
            const labels = historyLabelKeys(card.eventId);
            const spec = momentFormat(card);
            const employee = card.employeeId
              ? EMPLOYEES.find((e) => e.id === card.employeeId)
              : null;
            return (
              <li
                key={card.id}
                className={`moment-doc moment-doc--${spec.format} moment-doc--${card.rarity}`}
                style={
                  {
                    '--doc-paper': spec.paper,
                    '--doc-accent': spec.accent,
                  } as CSSProperties
                }
              >
                <button
                  className="moment-doc__open"
                  onClick={() => setViewing(card)}
                  title={t('collections.view')}
                >
                  {/* Letterhead: what kind of document this is, and who issued it. */}
                  <span className="moment-doc__head">
                    <span className="moment-doc__kind">{t(spec.headingKey)}</span>
                    <span className="moment-doc__org">{t('moment.from')}</span>
                  </span>

                  {/* The reference line every real piece of paperwork carries. */}
                  <span className="moment-doc__ref">
                    <span className="moment-doc__ref-label">{t(spec.refLabelKey)}</span>
                    <span className="moment-doc__ref-code">{momentRef(card)}</span>
                  </span>

                  <span className="moment-doc__title">{t(labels.titleKey)}</span>
                  {/* Discovery evidence (the annex rooms, the archive, the cameras, the
                      incubator); other cards draw nothing here. */}
                  <DiscoveryArt eventId={card.eventId} />

                  {/* Personnel notes are about somebody, so they say who. */}
                  {employee ? (
                    <span className="moment-doc__subject">{t(employee.nameKey)}</span>
                  ) : null}

                  <span className="moment-doc__foot">
                    <span className="moment-doc__rarity">{t(`moment.rarity.${card.rarity}`)}</span>
                    <span className="moment-doc__date">{fmt.date(card.createdAt)}</span>
                  </span>

                  {/* Rubber stamp, for the formats that are stamped. */}
                  {spec.stampKey ? (
                    <span className="moment-doc__stamp" aria-hidden>
                      {t(spec.stampKey)}
                    </span>
                  ) : null}
                </button>
                <button
                  className="moment-doc__save"
                  onClick={() => saveCard(card)}
                  title={t('collections.saveCard')}
                  aria-label={t('collections.saveCard')}
                >
                  <Icon name="export" size={13} />
                </button>
              </li>
            );
          })}
      </ul>
      {viewing ? (
        <MomentModal
          data={cardData(viewing)}
          onSave={() => saveCard(viewing)}
          onClose={() => setViewing(null)}
          saveLabel={t('collections.saveCard')}
          closeLabel={t('common.close')}
        />
      ) : null}
    </>
  );
}

function MomentModal({
  data,
  onSave,
  onClose,
  saveLabel,
  closeLabel,
}: {
  data: MomentCardData;
  onSave: () => void;
  onClose: () => void;
  saveLabel: string;
  closeLabel: string;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const controls = () => [
      ...(sheet.current?.querySelectorAll<HTMLButtonElement>('button') ?? []),
    ];
    controls()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      }
      if (event.key !== 'Tab') return;
      const buttons = controls();
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);
  // Render the card image once when the modal opens (robust to a null context).
  const png = useMemo(() => momentCardToPng(data), [data]);
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={data.title}
      onClick={onClose}
    >
      <div
        ref={sheet}
        className={`moment-modal moment-modal--${data.card.rarity}`}
        onClick={(e) => e.stopPropagation()}
      >
        {png ? (
          <img className="moment-modal__img" src={png} alt={data.title} />
        ) : (
          <div className="moment-modal__fallback">
            <div className="moment__title">{data.title}</div>
            <p>{data.caption}</p>
          </div>
        )}
        <p className="moment-modal__caption">{data.caption}</p>
        <div className="moment-modal__actions">
          <button className="buy-btn" onClick={onSave}>
            <Icon name="export" size={14} /> {saveLabel}
          </button>
          <button className="ghost-btn" onClick={onClose}>
            <Icon name="close" size={14} /> {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
