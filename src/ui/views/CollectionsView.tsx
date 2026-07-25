import { useMemo, useState } from 'react';
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
    return {
      card,
      companyName: state.company.name,
      title: def ? t(def.titleKey) : card.eventId,
      caption: t(card.caption),
      rarityLabel: t(`moment.rarity.${card.rarity}`),
      employeeName: employee ? t(employee.nameKey) : null,
      dateLabel: fmt.date(card.createdAt),
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
          <p className="empty-state">{t('collections.undiscovered')}</p>
        ) : (
          <ul className="moment-list">
            {state.collections.moments
              .slice()
              .reverse()
              .map((card) => {
                const def = GAME_EVENTS_BY_ID[card.eventId];
                return (
                  <li key={card.id} className={`moment moment--${card.rarity}`}>
                    <button
                      className="moment__open"
                      onClick={() => setViewing(card)}
                      title={t('collections.view')}
                    >
                      <span className="moment__dot" aria-hidden />
                      <span className="moment__info">
                        <span className="moment__title">
                          {def ? t(def.titleKey) : card.eventId}
                        </span>
                        <span className="moment__meta">
                          {t(`moment.rarity.${card.rarity}`)} · {fmt.date(card.createdAt)}
                        </span>
                      </span>
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={() => saveCard(card)}
                      title={t('collections.saveCard')}
                    >
                      <Icon name="export" size={14} />
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
          <p className="empty-state">{t('collections.undiscovered')}</p>
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
