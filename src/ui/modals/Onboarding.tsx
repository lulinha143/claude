import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../state/store';
import { Crate } from '../../art/Icons';
import { DecoArt } from '../../art/decoArt';
import { EmployeeSprite } from '../../art/EmployeeSprite';
import { employeeSprite } from '../../art/employeeSprites';
import { PopupShell, usePopupExit } from './PopupShell';

// The new-founder field guide: four short pages, each pointing at something the
// player can see right now (the office, the dock, the HUD gear). Every sentence is
// true of the game — the old first page promised a crate that stored production
// between visits, which nothing implemented.
const CHAPTERS = ['office', 'team', 'grow', 'return'] as const;
type ChapterId = (typeof CHAPTERS)[number];

export function Onboarding() {
  const { t } = useTranslation();
  const show = useStore((s) => s.showOnboarding);
  const opening = useStore((s) => s.showOpening);
  const finish = useStore((s) => s.finishOnboarding);
  const audio = useStore((s) => s.audio);
  const [index, setIndex] = useState(0);
  const { closing, exitThen } = usePopupExit();
  if (!show || opening) return null;

  const chapter = CHAPTERS[index];
  const last = index === CHAPTERS.length - 1;
  const titleId = 'onboarding-popup-title';
  const close = () => exitThen(finish);

  function move(next: number) {
    if (closing || next < 0 || next >= CHAPTERS.length) return;
    audio.play('click');
    setIndex(next);
  }

  function advance() {
    if (last) {
      audio.play('reward');
      close();
    } else {
      move(index + 1);
    }
  }

  return (
    <PopupShell
      variant="standard"
      className={`guide onboarding onboarding--${chapter}`}
      titleId={titleId}
      closing={closing}
      onDismiss={close}
      actions={
        <>
          <div className="guide__secondary">
            <button className="ghost-btn" disabled={closing} onClick={close}>
              {t('onboarding.skip')}
            </button>
            {index > 0 ? (
              <button className="ghost-btn" disabled={closing} onClick={() => move(index - 1)}>
                {t('onboarding.back')}
              </button>
            ) : null}
          </div>
          <button className="buy-btn onboarding__next" disabled={closing} onClick={advance}>
            {last ? t('onboarding.done') : t('onboarding.next')}
          </button>
        </>
      }
    >
      <p className="guide__head">
        <span>{t('onboarding.eyebrow')}</span>
        <span aria-live="polite">
          {t('onboarding.progress', { current: index + 1, total: CHAPTERS.length })}
        </span>
      </p>

      <GuideArt chapter={chapter} />

      <div className="guide__copy" key={chapter}>
        <h2 id={titleId}>{t(`onboarding.${chapter}Title`)}</h2>
        <p>{t(`onboarding.${chapter}`)}</p>
      </div>

      <ol className="guide__dots" aria-label={t('onboarding.progressLabel')}>
        {CHAPTERS.map((item, itemIndex) => (
          <li key={item}>
            <button
              type="button"
              aria-label={t('onboarding.goTo', {
                current: itemIndex + 1,
                title: t(`onboarding.${item}Title`),
              })}
              aria-current={itemIndex === index ? 'step' : undefined}
              disabled={closing}
              onClick={() => move(itemIndex)}
            />
          </li>
        ))}
      </ol>
    </PopupShell>
  );
}

function Cast({ id, height }: { id: string; height: number }) {
  const sprite = employeeSprite(id);
  return sprite ? <EmployeeSprite config={sprite} reducedMotion height={height} /> : null;
}

function GuideArt({ chapter }: { chapter: ChapterId }) {
  return (
    <div className={`guide__art guide__art--${chapter}`} aria-hidden="true">
      {chapter === 'office' ? (
        <>
          <Cast id="pip" height={112} />
          <span className="guide__crate">
            <Crate size={46} />
          </span>
          <span className="guide__chip">+12</span>
        </>
      ) : null}
      {chapter === 'team' ? (
        <>
          <Cast id="marlow" height={92} />
          <Cast id="pip" height={104} />
          <Cast id="nino" height={88} />
          <span className="guide__speech">…!</span>
        </>
      ) : null}
      {chapter === 'grow' ? (
        <>
          {/* The same accents the previous guide art used. */}
          <DecoArt id="potted-fern" on accent="#778866" reducedMotion scale={1.5} />
          <DecoArt id="desk-lamp" on accent="#b29561" reducedMotion scale={1.5} />
          <DecoArt id="tiny-rug" on accent="#92795a" reducedMotion scale={1.5} />
        </>
      ) : null}
      {chapter === 'return' ? <span className="guide__window" /> : null}
    </div>
  );
}
