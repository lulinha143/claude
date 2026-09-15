import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { NUTS } from '../../content/nuts';
import { EMPLOYEES } from '../../content/employees';
import { GAME_EVENTS_BY_ID } from '../../content/events';
import { NutDot } from '../../art/Icons';
import { Icon } from '../../art/UiIcon';
import { momentCardToPng, type MomentCardData } from '../momentCard';
import { momentFormat, momentRef } from '../momentFormats';
import type { MomentCard } from '../../sim/types';

type Tab = 'nuts' | 'moments' | 'outfits' | 'secrets';

export function CollectionsView() {
  const { t } = useTranslation();
  const { state } = useGame();
  const fmt = useFmt();
  const setPhotoMode = useStore((s) => s.setPhotoMode);
  const [tab, setTab] = useState<Tab>('nuts');
  const [viewing, setViewing] = useState<MomentCard | null>(null);

  const discoveredNuts = new Set(state.collections.nuts);
  const allOutfits = EMPLOYEES.flatMap((e) => e.outfits);

  function cardData(card: MomentCard): MomentCardData {
    const def = GAME_EVENTS_BY_ID[card.eventId];
    const employee = card.employeeId ? EMPLOYEES.find((e) => e.id === card.employeeId) : null;
    const spec = momentFormat(card);
    return {
      card,
      companyName: state.company.name,
      title: def ? t(def.titleKey) : card.eventId,
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

  return (
    <section className="view view--collections">
      <div className="view__head">
        <h2>{t('collections.title')}</h2>
        <button className="ghost-btn" onClick={() => setPhotoMode(true)}>
          {t('collections.photoMode')}
        </button>
      </div>
      <div className="tabs" role="tablist" aria-label={t('collections.title')}>
        {(['nuts', 'moments', 'outfits', 'secrets'] as Tab[]).map((tb) => (
          <button
            key={tb}
            type="button"
            role="tab"
            aria-selected={tab === tb}
            className={`tab ${tab === tb ? 'is-active' : ''}`}
            onClick={() => setTab(tb)}
          >
            {t(`collections.${tb}`)}
          </button>
        ))}
      </div>

      {tab === 'nuts' ? (
        <>
          <p className="muted">
            {t('collections.discovered', { count: discoveredNuts.size, total: NUTS.length })}
          </p>
          <ul className="nut-grid">
            {NUTS.map((n) => {
              const found = discoveredNuts.has(n.id);
              return (
                <li key={n.id} className={`nut-cell ${found ? '' : 'is-locked'}`}>
                  <NutDot color={found ? n.color : '#4a4038'} size={30} />
                  <span className="nut-cell__name">{found ? t(n.nameKey) : '???'}</span>
                  <span className="nut-cell__desc">
                    {found ? t(n.descriptionKey) : t('collections.undiscovered')}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {tab === 'moments' ? (
        state.collections.moments.length === 0 ? (
          /* An empty collection should say what belongs in it. This was a dashed box
             containing the single word "Undiscovered", which tells a player who has
             just opened the tab neither what a moment card IS nor how one arrives. */
          <p className="empty-state">
            <strong className="empty-state__title">{t('collections.emptyMoments.title')}</strong>
            <span className="empty-state__hint">{t('collections.emptyMoments.hint')}</span>
          </p>
        ) : (
          // A COLLECTION OF DOCUMENTS, not a list of rows.
          //
          // This was a `<ul>` of flat rows — a coloured dot, a title, a date and an
          // export icon — which is a file listing, not something a player collects.
          // The only actual card was the exported PNG, so the feature's whole
          // appeal lived outside the game.
          //
          // Each moment is now the document it actually is. The format comes from
          // ui/momentFormats.ts, which is shared with the canvas exporter so the
          // card in the collection and the card in the downloaded PNG are the same
          // artefact.
          <ul className="moment-grid">
            {state.collections.moments
              .slice()
              .reverse()
              .map((card) => {
                const def = GAME_EVENTS_BY_ID[card.eventId];
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

                      <span className="moment-doc__title">
                        {def ? t(def.titleKey) : card.eventId}
                      </span>

                      {/* Personnel notes are about somebody, so they say who. */}
                      {employee ? (
                        <span className="moment-doc__subject">{t(employee.nameKey)}</span>
                      ) : null}

                      <span className="moment-doc__foot">
                        <span className="moment-doc__rarity">
                          {t(`moment.rarity.${card.rarity}`)}
                        </span>
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
        )
      ) : null}

      {viewing ? (
        <MomentModal
          data={cardData(viewing)}
          onSave={() => saveCard(viewing)}
          onClose={() => setViewing(null)}
          saveLabel={t('collections.saveCard')}
          closeLabel={t('common.close')}
        />
      ) : null}

      {tab === 'outfits' ? (
        <ul className="nut-grid">
          {allOutfits.map((o) => {
            const owned = state.collections.outfits.includes(o.id);
            return (
              <li key={o.id} className={`nut-cell ${owned ? '' : 'is-locked'}`}>
                <span
                  className="dot"
                  style={{
                    background: owned ? o.accent : '#4a4038',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                  }}
                />
                <span className="nut-cell__name">{owned ? t(o.nameKey) : '???'}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {tab === 'secrets' ? (
        state.collections.secrets.some((secret) => !secret.startsWith('deco:')) ? (
          <ul className="nut-grid">
            {state.collections.secrets
              .filter((secret) => !secret.startsWith('deco:'))
              .map((secret) => (
                <li key={secret} className="nut-cell">
                  <span className="nut-cell__name">{secret}</span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="empty-state">
            <strong className="empty-state__title">{t('collections.emptySecrets.title')}</strong>
            <span className="empty-state__hint">{t('collections.emptySecrets.hint')}</span>
          </p>
        )
      ) : null}
    </section>
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
  // Render the card image once when the modal opens (robust to a null context).
  const png = useMemo(() => momentCardToPng(data), [data]);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
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
