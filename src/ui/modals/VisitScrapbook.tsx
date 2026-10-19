import { useTranslation } from 'react-i18next';
import type { GameState } from '../../sim/types';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { CHARACTERS } from '../../content/characters';
import type { GiftReaction } from '../../content/employeeGifts';
import {
  BOND_TIERS,
  journalFor,
  keepsakeFor,
  storyNamed,
  storyState,
  type JournalEntry,
  type KeepsakeView,
} from '../../sim/bonds';
import { KeepsakeArt } from '../../art/KeepsakeArt';
import { Glyph, type GlyphName } from '../../art/Glyph';
import { useFmt } from '../useFmt';

// The scrapbook (the visit's Album): what the two of you have been through, newest
// first, each entry in their words and, where you answered, in yours. Their
// keepsake heads it once you know it: what it is, where it is now, how it got
// there. Nothing is shown before it happened: a story is not named before it
// begins, a keepsake not before you have heard of it.

export const REACTION_GLYPH: Record<GiftReaction, GlyphName> = {
  loved: 'heart',
  liked: 'plus',
  polite: 'tilde',
  odd: 'question',
};

/** The id their keepsake card answers to (the visit's keepsake button opens it). */
export function keepsakeCardId(employeeId: string): string {
  return `visit-keepsake-${employeeId}`;
}

function KeepsakeCard({ view, name }: { view: KeepsakeView; name: string }) {
  const { t } = useTranslation();
  const fmt = useFmt();
  const context = CHARACTERS[view.employeeId]?.gender;
  const headingId = `${keepsakeCardId(view.employeeId)}-title`;
  const where = view.onDisplay
    ? t('visit.keepsake.onDesk', { name, date: fmt.date(view.since ?? 0), context })
    : t('visit.keepsake.kept', { name, context });
  const how =
    view.reason === 'cared' && view.talk
      ? t('visit.keepsake.sinceTalk', { choice: t(view.talk.choiceLabelKey) })
      : view.reason === 'story'
        ? t('visit.keepsake.sinceStory', { story: t(`arc.${view.employeeId}.title`) })
        : view.talk
          ? t('visit.keepsake.chosen', { choice: t(view.talk.choiceLabelKey) })
          : null;
  return (
    <section
      className="visit-keepsake"
      id={keepsakeCardId(view.employeeId)}
      data-employee={view.employeeId}
      data-placed={view.onDisplay ? 'desk' : 'drawer'}
      aria-labelledby={headingId}
      tabIndex={-1}
    >
      <span className="visit-keepsake__art" aria-hidden>
        <KeepsakeArt employeeId={view.employeeId} />
      </span>
      <div className="visit-keepsake__body">
        <small className="visit-keepsake__kind">{t('visit.keepsake.kind')}</small>
        <h4 id={headingId}>{t(view.itemKey)}</h4>
        <p className="visit-keepsake__scene">{t(view.sceneKey)}</p>
        <p className="visit-keepsake__where">{where}</p>
        {how ? <p className="visit-keepsake__how">{how}</p> : null}
      </div>
    </section>
  );
}

export function VisitScrapbook({
  state,
  employeeId,
  now,
}: {
  state: GameState;
  employeeId: string;
  now: number;
}) {
  const { t } = useTranslation();
  const fmt = useFmt();
  const def = EMPLOYEES_BY_ID[employeeId];
  if (!def) return null;
  const name = state.employees[employeeId]?.nickname ?? t(def.nameKey);
  const tierName = (tier: number) => t(`bond.tier.${BOND_TIERS[tier]}`);
  const story = storyState(state, employeeId, now);
  const named = storyNamed(state, employeeId, now);
  const keepsake = keepsakeFor(state, employeeId);
  const entries = journalFor(state, employeeId);

  const entryText = (
    entry: JournalEntry,
  ): { title: string; said?: string; quote?: string; icon: GlyphName } => {
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
          said: t('scrapbook.youSaid', { line: t(entry.saidKey) }),
          quote: t(entry.quoteKey),
          icon: entry.part === 3 ? 'star' : 'note',
        };
      case 'keepsake':
        return {
          title: t('scrapbook.keepsake', { item: t(entry.titleKey) }),
          said: t('scrapbook.youSaid', { line: t(entry.saidKey) }),
          quote: t(entry.quoteKey),
          icon: 'sparkle',
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

  const nextTier = (part: 1 | 2 | 3) => tierName(part);
  const storyLine =
    story.told === 3
      ? t('visit.storyWaiting.done')
      : !named && story.next
        ? t('visit.storyWaiting.first', { tier: nextTier(story.next) })
        : story.waitingFor === 'friendship' && story.next
          ? t('visit.storyWaiting.friendship', { tier: nextTier(story.next) })
          : story.waitingFor === 'time'
            ? t('visit.storyWaiting.time')
            : story.readyTopicId
              ? t('visit.storyWaiting.ready')
              : null;

  return (
    <div className="visit__scrapbook">
      <p className="visit__story-line" data-named={named ? 'true' : undefined}>
        {/* A story is not named before it begins (or is ready to begin). */}
        <strong>{named ? t(`arc.${employeeId}.title`) : t('visit.storyUnnamed', { name })}</strong>
        <span>{t('visit.storyTold', { n: story.told })}</span>
        {storyLine ? <em>{storyLine}</em> : null}
      </p>
      {keepsake ? <KeepsakeCard view={keepsake} name={name} /> : null}
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
                  {text.said ? <span className="scrap__said">{text.said}</span> : null}
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
}
