import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../state/store';
import { Acorn } from '../../art/Icons';

const STEPS = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7'] as const;

export function Onboarding() {
  const { t } = useTranslation();
  const show = useStore((s) => s.showOnboarding);
  const opening = useStore((s) => s.showOpening);
  const finish = useStore((s) => s.finishOnboarding);
  const [i, setI] = useState(0);
  if (!show || opening) return null;
  const last = i === STEPS.length - 1;

  return (
    <div className="modal-backdrop">
      <div className="modal onboarding" role="dialog" aria-modal>
        <Acorn size={54} />
        <div className="onboarding__dots">
          {STEPS.map((s, idx) => (
            <span key={s} className={`dot ${idx === i ? 'is-active' : ''}`} />
          ))}
        </div>
        <p className="onboarding__text">{t(`onboarding.${STEPS[i]}`)}</p>
        <div className="onboarding__actions">
          <button className="ghost-btn" onClick={finish}>
            {t('onboarding.skip')}
          </button>
          <button
            className="buy-btn"
            onClick={() => (last ? finish() : setI((n) => n + 1))}
          >
            {last ? t('onboarding.done') : t('onboarding.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
