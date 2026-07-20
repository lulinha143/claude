import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../state/store';
import { useGame } from '../../state/hooks';
import { Acorn } from '../../art/Icons';
import { Critter } from '../../art/Critter';
import { shapeFor } from '../../art/critterShapes';
import { OfficeBackdrop } from '../../art/OfficeBackdrop';

type OpeningPhase = 'intro' | 'impact' | 'title';

function useSystemReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
  );

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const sync = () => setPrefersReducedMotion(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return prefersReducedMotion;
}

// A short, tactile cold open: the first acorn becomes the first company asset,
// the first coffee becomes the first workplace incident, and the title lands.
export function OpeningSequence() {
  const { t } = useTranslation();
  const show = useStore((s) => s.showOpening);
  const finish = useStore((s) => s.finishOpening);
  const audio = useStore((s) => s.audio);
  const { state } = useGame();
  const [phase, setPhase] = useState<OpeningPhase>('intro');
  const dialogRef = useRef<HTMLDivElement>(null);
  const transitionTimer = useRef<number | null>(null);
  const shape = shapeFor('pip');
  const systemReducedMotion = useSystemReducedMotion();
  const reducedMotion =
    state.settings.reducedMotion || state.settings.quietMode || systemReducedMotion;

  useEffect(() => {
    if (!show) return;
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('.acorn-cta')?.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled])')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!active || !dialog.contains(active) || !focusable.includes(active as HTMLElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    };
  }, [finish, show]);

  useEffect(() => {
    if (phase !== 'title') return;
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('.opening-seq__continue')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  if (!show) return null;

  function claimAcorn() {
    if (phase !== 'intro') return;
    audio.resume();
    audio.play('collect');
    setPhase('impact');
    transitionTimer.current = window.setTimeout(() => {
      transitionTimer.current = null;
      setPhase('title');
      audio.play('reward');
    }, reducedMotion ? 0 : 520);
  }

  function completeOpening() {
    audio.play('click');
    finish();
  }

  const titleVisible = phase === 'title';
  return (
    <div className={`opening-seq opening-seq--${phase}`}>
      <div className="opening-seq__backdrop" aria-hidden="true">
        <OfficeBackdrop reducedMotion={reducedMotion} />
        <span className="opening-seq__vignette" />
        <span className="opening-seq__dust opening-seq__dust--one" />
        <span className="opening-seq__dust opening-seq__dust--two" />
        <span className="opening-seq__dust opening-seq__dust--three" />
      </div>

      <div
        ref={dialogRef}
        className="opening-seq__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleVisible ? 'opening-title' : 'opening-prompt'}
        aria-describedby={titleVisible ? 'opening-title-note' : 'opening-line'}
      >
        <button className="opening-seq__skip ghost-btn" onClick={finish}>
          {t('opening.skip')}
        </button>

        <div className="opening-seq__stage" aria-live="polite">
          <div className="opening-seq__desk" aria-hidden="true">
            <span className="opening-seq__paper opening-seq__paper--back" />
            <span className="opening-seq__paper opening-seq__paper--front">
              <i /><i /><i />
            </span>
            <span className="opening-seq__mug"><i /></span>
            <span className="opening-seq__spill" />
            <span className="opening-seq__pencil" />
          </div>

          <div className="opening-seq__founder" aria-hidden={titleVisible}>
            <Critter
              species={shape.species}
              color="#c65b3c"
              accent="#3f7d4f"
              state={phase === 'intro' ? 'think' : 'panic'}
              hasGlasses
              size={148}
              reducedMotion={reducedMotion}
              title={t('employee.pip.name')}
            />
          </div>

          {phase !== 'title' ? (
            <section className="opening-seq__intro">
              <p className="opening-seq__eyebrow">{t('opening.eyebrow')}</p>
              <h1 id="opening-prompt" className="opening-seq__prompt">
                {t('opening.prompt')}
              </h1>
              <p id="opening-line" className="opening-seq__line">“{t('opening.line')}”</p>
              <button className="acorn-cta" onClick={claimAcorn} disabled={phase !== 'intro'}>
                <span className="acorn-cta__halo" aria-hidden="true" />
                <span className="acorn-cta__nut"><Acorn size={64} /></span>
                <span className="acorn-cta__label">{t('opening.clickAcorn')}</span>
              </button>
              <p className="opening-seq__founding-note">{t('opening.founded')}</p>
            </section>
          ) : (
            <section className="opening-seq__title">
              <p className="opening-seq__eyebrow opening-seq__eyebrow--stamp">
                {t('opening.impact')}
              </p>
              <h1 id="opening-title" className="title-card">{t('app.title')}</h1>
              <p className="title-card__sub">{t('app.subtitle')}</p>
              <p id="opening-title-note" className="opening-seq__title-note">
                {t('opening.titleNote')}
              </p>
              <div className="opening-seq__rule" aria-hidden="true">
                <span /><Acorn size={26} /><span />
              </div>
              <button className="buy-btn buy-btn--big opening-seq__continue" onClick={completeOpening}>
                {t('opening.continue')}
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
