import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../state/store';
import { Acorn, Crate } from '../../art/Icons';
import { Critter } from '../../art/Critter';
import { shapeFor } from '../../art/critterShapes';
import { PopupShell, usePopupExit } from './PopupShell';

const CHAPTERS = [
  { id: 'collect', bodyKeys: ['step1'] },
  { id: 'growth', bodyKeys: ['step2'] },
  { id: 'team', bodyKeys: ['step3'] },
  { id: 'company', bodyKeys: ['step4'] },
  { id: 'desktop', bodyKeys: ['step5', 'step6', 'step7'] },
] as const;

type ChapterId = (typeof CHAPTERS)[number]['id'];

export function Onboarding() {
  const { t } = useTranslation();
  const show = useStore((s) => s.showOnboarding);
  const opening = useStore((s) => s.showOpening);
  const finish = useStore((s) => s.finishOnboarding);
  const audio = useStore((s) => s.audio);
  const reducedMotion = useStore((s) => s.engine.state.settings.reducedMotion);
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
      className={`onboarding onboarding--${chapter.id}`}
      titleId={titleId}
      closing={closing}
      onDismiss={close}
      actions={(
        <>
          <div className="onboarding__secondary-actions">
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
      )}
    >
      <header className="onboarding__header">
        <p className="onboarding__eyebrow">{t('onboarding.eyebrow')}</p>
        <p className="onboarding__progress" aria-live="polite">
          {t('onboarding.progress', { current: index + 1, total: CHAPTERS.length })}
        </p>
      </header>

      <TutorialArt chapter={chapter.id} reducedMotion={reducedMotion} />

      <div className="onboarding__copy" key={chapter.id}>
        <h2 id={titleId}>{t(`onboarding.${chapter.id}Title`)}</h2>
        {chapter.bodyKeys.map((key) => (
          <p key={key} className="onboarding__text">{t(`onboarding.${key}`)}</p>
        ))}
      </div>

      <ol className="onboarding__steps" aria-label={t('onboarding.progressLabel')}>
        {CHAPTERS.map((item, itemIndex) => (
          <li key={item.id} className={itemIndex === index ? 'is-active' : itemIndex < index ? 'is-complete' : ''}>
            <button
              type="button"
              aria-label={t('onboarding.goTo', {
                current: itemIndex + 1,
                title: t(`onboarding.${item.id}Title`),
              })}
              aria-current={itemIndex === index ? 'step' : undefined}
              disabled={closing}
              onClick={() => move(itemIndex)}
            >
              <span>{itemIndex + 1}</span>
            </button>
          </li>
        ))}
      </ol>
    </PopupShell>
  );
}

function TutorialArt({ chapter, reducedMotion }: { chapter: ChapterId; reducedMotion: boolean }) {
  const shape = shapeFor('pip');

  return (
    <div className={`onboarding-art onboarding-art--${chapter}`} aria-hidden="true">
      <span className="onboarding-art__wash" />
      {chapter === 'collect' ? (
        <>
          <span className="onboarding-art__crate"><Crate size={88} /></span>
          <span className="onboarding-art__nut onboarding-art__nut--one"><Acorn size={30} /></span>
          <span className="onboarding-art__nut onboarding-art__nut--two"><Acorn size={26} /></span>
          <span className="onboarding-art__click-ring" />
          <span className="onboarding-art__plus">+12</span>
        </>
      ) : null}

      {chapter === 'growth' ? (
        <div className="onboarding-art__report">
          <span className="onboarding-art__report-title" />
          <span className="onboarding-art__bar onboarding-art__bar--one" />
          <span className="onboarding-art__bar onboarding-art__bar--two" />
          <span className="onboarding-art__bar onboarding-art__bar--three" />
          <span className="onboarding-art__trend">↗</span>
          <span className="onboarding-art__report-nut"><Acorn size={32} /></span>
        </div>
      ) : null}

      {chapter === 'team' ? (
        <>
          <span className="onboarding-art__pip">
            <Critter
              species={shape.species}
              color="#c65b3c"
              accent="#3f7d4f"
              state="talk"
              hasGlasses
              size={118}
              reducedMotion={reducedMotion}
            />
          </span>
          <span className="onboarding-art__speech"><i /><i /><i /></span>
          <span className="onboarding-art__morale"><b>+1</b><i /></span>
        </>
      ) : null}

      {chapter === 'company' ? (
        <div className="onboarding-art__dossier">
          <span className="onboarding-art__dossier-tab" />
          <span className="onboarding-art__dossier-heading" />
          <span className="onboarding-art__department onboarding-art__department--one"><i /><b /></span>
          <span className="onboarding-art__department onboarding-art__department--two"><i /><b /></span>
          <span className="onboarding-art__department onboarding-art__department--three"><i /><b /></span>
          <span className="onboarding-art__stamp">CO.</span>
        </div>
      ) : null}

      {chapter === 'desktop' ? (
        <div className="onboarding-art__window">
          <span className="onboarding-art__window-bar"><i /><i /><i /></span>
          <span className="onboarding-art__mini-office">
            <b /><b /><b />
            <i><Acorn size={22} /></i>
          </span>
          <span className="onboarding-art__pin">●</span>
          <span className="onboarding-art__quiet"><i /><i /><i /></span>
        </div>
      ) : null}
    </div>
  );
}
