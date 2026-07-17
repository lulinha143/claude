import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../state/store';
import { Acorn } from '../../art/Icons';
import { PopupShell, usePopupExit } from './PopupShell';

const STEPS = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7'] as const;

export function Onboarding() {
  const { t } = useTranslation();
  const show = useStore((s) => s.showOnboarding);
  const opening = useStore((s) => s.showOpening);
  const finish = useStore((s) => s.finishOnboarding);
  const [i, setI] = useState(0);
  const { closing, exitThen } = usePopupExit();
  if (!show || opening) return null;
  const last = i === STEPS.length - 1;
  const titleId = 'onboarding-popup-title';
  const close = () => exitThen(finish);

  return (
    <PopupShell
      variant="standard"
      className="onboarding"
      titleId={titleId}
      closing={closing}
      onDismiss={close}
      actions={(
        <>
          <button className="ghost-btn" disabled={closing} onClick={close}>
            {t('onboarding.skip')}
          </button>
          <button
            className="buy-btn"
            disabled={closing}
            onClick={() => (last ? close() : setI((n) => n + 1))}
          >
            {last ? t('onboarding.done') : t('onboarding.next')}
          </button>
        </>
      )}
    >
      <div className="popup__hero-art"><Acorn size={54} /></div>
      <h2 id={titleId} className="sr-only">{t('app.title')}</h2>
      <div className="onboarding__dots" aria-hidden="true">
        {STEPS.map((step, idx) => (
          <span key={step} className={`dot ${idx === i ? 'is-active' : ''}`} />
        ))}
      </div>
      <p className="onboarding__text">{t(`onboarding.${STEPS[i]}`)}</p>
    </PopupShell>
  );
}
