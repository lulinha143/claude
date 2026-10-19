import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../state/store';
import { useGame } from '../../state/hooks';
import { GAME_TITLE } from '../../brand';
import { BrandEmblem } from '../../art/BrandLogo';
import { Acorn } from '../../art/Icons';
import { EmployeeSprite } from '../../art/EmployeeSprite';
import { employeeSprite } from '../../art/employeeSprites';
import { OfficeBackground } from '../../art/OfficeBackground';
import { CompanyIcon } from '../../art/companyIcons';

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

// A short, tactile cold open. The authored office loop plays softly behind a
// paper card; the real Pip (the same artwork as in the office) asks for the first
// acorn; one click later the title lands and the company opens.
export function OpeningSequence() {
  const { t } = useTranslation();
  const show = useStore((s) => s.showOpening);
  const finish = useStore((s) => s.finishOpening);
  const audio = useStore((s) => s.audio);
  const { state } = useGame();
  const [phase, setPhase] = useState<OpeningPhase>('intro');
  const dialogRef = useRef<HTMLDivElement>(null);
  const transitionTimer = useRef<number | null>(null);
  const systemReducedMotion = useSystemReducedMotion();
  const reducedMotion =
    state.settings.reducedMotion || state.settings.quietMode || systemReducedMotion;
  const pip = employeeSprite('pip');

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
    transitionTimer.current = window.setTimeout(
      () => {
        transitionTimer.current = null;
        setPhase('title');
        audio.play('reward');
      },
      reducedMotion ? 0 : 560,
    );
  }

  function completeOpening() {
    audio.play('click');
    finish();
  }

  const titleVisible = phase === 'title';
  return (
    <div className={`opening-seq opening-seq--${phase}`}>
      <div className="opening-seq__backdrop" aria-hidden="true">
        <OfficeBackground visible />
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

        {/* Nutshell Inc. opens a file on its founder: one observation sheet with
            the company's letterhead, the real Pip at his desk and one thing to do. */}
        {!titleVisible ? (
          <section className="opening-card opening-card--memo" aria-live="polite">
            <header className="opening-card__letterhead">
              <span className="opening-card__emblem" aria-hidden="true">
                <CompanyIcon id={state.company.icon} size={20} />
              </span>
              <span className="opening-card__org">{state.company.name}</span>
              <span className="opening-card__dept">{t('header.departmentFull')}</span>
            </header>
            <p className="opening-card__eyebrow">
              <span>{t('opening.file')}</span>
              <span className="opening-card__confidential">{t('opening.confidential')}</span>
            </p>
            <div className="opening-card__cast" aria-hidden="true">
              {pip ? (
                <EmployeeSprite config={pip} reducedMotion={reducedMotion} height={150} />
              ) : null}
              {phase === 'impact' ? (
                <span className="opening-card__pop">
                  <Acorn size={34} />
                </span>
              ) : null}
            </div>
            <h1 id="opening-prompt" className="opening-card__prompt">
              {t('opening.prompt')}
            </h1>
            <p id="opening-line" className="opening-card__line">
              “{t('opening.line')}”
            </p>
            <button className="acorn-cta" onClick={claimAcorn} disabled={phase !== 'intro'}>
              <span className="acorn-cta__nut" aria-hidden="true">
                <Acorn size={34} />
              </span>
              <span className="acorn-cta__label">{t('opening.clickAcorn')}</span>
            </button>
          </section>
        ) : (
          <section className="opening-card opening-card--title">
            <p className="opening-card__stamp">{t('opening.impact')}</p>
            <BrandEmblem size={56} title={GAME_TITLE} />
            <h1 id="opening-title" className="title-card">
              {GAME_TITLE}
            </h1>
            <p className="title-card__sub">{t('app.subtitle')}</p>
            <p id="opening-title-note" className="opening-card__note">
              {t('opening.titleNote')}
            </p>
            <button
              className="buy-btn buy-btn--big opening-seq__continue"
              onClick={completeOpening}
            >
              {t('opening.continue')}
            </button>
            <p className="opening-card__filed">{t('opening.founded')}</p>
          </section>
        )}
      </div>
    </div>
  );
}
