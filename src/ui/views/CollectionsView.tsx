import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { DiscoveryArt } from '../../art/DiscoveryArt';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { NUTS } from '../../content/nuts';
import { EMPLOYEES } from '../../content/employees';
import { historyLabelKeys } from '../../content/historyLabels';
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

  const discoveredNuts = new Set(state.collections.nuts);
  const allOutfits = EMPLOYEES.flatMap((e) => e.outfits);

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

      {tab === 'moments' && state.collections.moments.length > 0 ? (
        <label className="archive-search field">
          <span>{t('collections.searchArchive')}</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
          <small role="status">
            {t('collections.archiveMatches', { count: matchingMoments.length })}
          </small>
        </label>
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
                      {card.eventId.startsWith('annex-') ? (
                        <DiscoveryArt eventId={card.eventId} />
                      ) : null}

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
          <ul className="secret-files">
            {state.collections.secrets
              .filter((secret) => !secret.startsWith('deco:'))
              .map((secret, index) => (
                <li key={secret} className="secret-file" data-artifact={secret}>
                  <DiscoveryArt
                    eventId={
                      {
                        'anomaly.silence': 'annex-broadcast',
                        'anomaly.deskNames': 'annex-repair',
                        'anomaly.thursday': 'annex-conservatory',
                      }[secret] ?? ''
                    }
                  />
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
                  <span>{t('secretFile.stamp')}</span>
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
