import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { NUTS } from '../../content/nuts';
import { EMPLOYEES } from '../../content/employees';
import { GAME_EVENTS_BY_ID } from '../../content/events';
import { NutDot } from '../../art/Icons';
import { momentCardToPng } from '../momentCard';

type Tab = 'nuts' | 'moments' | 'outfits' | 'secrets';

export function CollectionsView() {
  const { t } = useTranslation();
  const { state } = useGame();
  const fmt = useFmt();
  const setPhotoMode = useStore((s) => s.setPhotoMode);
  const [tab, setTab] = useState<Tab>('nuts');

  const discoveredNuts = new Set(state.collections.nuts);
  const allOutfits = EMPLOYEES.flatMap((e) => e.outfits);

  function saveCard(cardIndex: number) {
    const card = state.collections.moments[cardIndex];
    const def = GAME_EVENTS_BY_ID[card.eventId];
    const employee = card.employeeId ? EMPLOYEES.find((e) => e.id === card.employeeId) : null;
    const png = momentCardToPng({
      card,
      companyName: state.company.name,
      title: def ? t(def.titleKey) : card.eventId,
      caption: t(card.caption),
      rarityLabel: t(`moment.rarity.${card.rarity}`),
      employeeName: employee ? t(employee.nameKey) : null,
      dateLabel: fmt.date(card.createdAt),
    });
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
      <div className="tabs">
        {(['nuts', 'moments', 'outfits', 'secrets'] as Tab[]).map((tb) => (
          <button key={tb} className={`tab ${tab === tb ? 'is-active' : ''}`} onClick={() => setTab(tb)}>
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
                  <span className="nut-cell__desc">{found ? t(n.descriptionKey) : t('collections.undiscovered')}</span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {tab === 'moments' ? (
        <ul className="moment-list">
          {state.collections.moments.length === 0 ? <p className="muted">{t('collections.undiscovered')}</p> : null}
          {state.collections.moments
            .slice()
            .reverse()
            .map((card, i) => {
              const idx = state.collections.moments.length - 1 - i;
              const def = GAME_EVENTS_BY_ID[card.eventId];
              return (
                <li key={card.id} className={`moment moment--${card.rarity}`}>
                  <div>
                    <div className="moment__title">{def ? t(def.titleKey) : card.eventId}</div>
                    <div className="moment__meta">
                      {t(`moment.rarity.${card.rarity}`)} · {fmt.date(card.createdAt)}
                    </div>
                  </div>
                  <button className="ghost-btn" onClick={() => saveCard(idx)}>
                    {t('collections.saveCard')}
                  </button>
                </li>
              );
            })}
        </ul>
      ) : null}

      {tab === 'outfits' ? (
        <ul className="nut-grid">
          {allOutfits.map((o) => {
            const owned = state.collections.outfits.includes(o.id);
            return (
              <li key={o.id} className={`nut-cell ${owned ? '' : 'is-locked'}`}>
                <span className="dot" style={{ background: owned ? o.accent : '#4a4038', width: 24, height: 24, borderRadius: '50%' }} />
                <span className="nut-cell__name">{owned ? t(o.nameKey) : '???'}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {tab === 'secrets' ? (
        <ul className="nut-grid">
          {state.collections.secrets
            .filter((s) => !s.startsWith('deco:'))
            .map((s) => (
              <li key={s} className="nut-cell">
                <span className="nut-cell__name">{s}</span>
              </li>
            ))}
          {state.collections.secrets.filter((s) => !s.startsWith('deco:')).length === 0 ? (
            <p className="muted">{t('collections.undiscovered')}</p>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}
