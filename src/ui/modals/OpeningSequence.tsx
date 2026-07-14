import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../state/store';
import { Acorn } from '../../art/Icons';
import { Critter } from '../../art/Critter';
import { shapeFor } from '../../art/critterShapes';

// The cold open: Pip at the desk, one acorn rolls in, the title card appears,
// coffee spills, the game begins. Skippable and short.
export function OpeningSequence() {
  const { t } = useTranslation();
  const show = useStore((s) => s.showOpening);
  const finish = useStore((s) => s.finishOpening);
  const audio = useStore((s) => s.audio);
  const [phase, setPhase] = useState<'intro' | 'title'>('intro');
  const shape = shapeFor('pip');

  if (!show) return null;

  return (
    <div className="modal-backdrop opening-seq">
      {phase === 'intro' ? (
        <div className="opening-seq__intro">
          <Critter
            species={shape.species}
            color="#c65b3c"
            accent="#3f7d4f"
            state="think"
            hasGlasses
            size={124}
          />
          <p className="opening-seq__line">“{t('opening.line')}”</p>
          <button
            className="acorn-cta"
            onClick={() => {
              audio.resume();
              audio.play('collect');
              setPhase('title');
            }}
          >
            <Acorn size={54} />
            <span>{t('opening.clickAcorn')}</span>
          </button>
        </div>
      ) : (
        <div className="opening-seq__title">
          <h1 className="title-card">{t('app.title')}</h1>
          <p className="title-card__sub">{t('app.subtitle')}</p>
          <p className="muted">{t('opening.spill')}</p>
          <button className="buy-btn buy-btn--big" onClick={finish}>
            {t('onboarding.done')}
          </button>
        </div>
      )}
    </div>
  );
}
