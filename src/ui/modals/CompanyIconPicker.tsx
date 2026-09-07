import { useId, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { PopupShell, usePopupExit } from './PopupShell';
import { Icon } from '../../art/UiIcon';
import {
  CompanyIcon,
  COMPANY_ICON_IDS,
  type CompanyIconId,
  companyIconLabelKey,
  resolveCompanyIcon,
} from '../../art/companyIcons';

/**
 * A small, polished picker for the company's logo mark. Selecting an icon
 * applies it immediately (engine persists it right away), so it updates
 * everywhere the logo appears and survives a reload.
 */
export function CompanyIconPicker({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const audio = useStore((s) => s.audio);
  const { closing, exitThen } = usePopupExit();
  const titleId = useId();
  const descriptionId = useId();
  const choiceRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = resolveCompanyIcon(state.company.icon);

  function choose(id: CompanyIconId) {
    if (id !== current) {
      engine.setCompanyIcon(id);
      audio.play('toggle');
    }
  }

  function handleChoiceKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % COMPANY_ICON_IDS.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + COMPANY_ICON_IDS.length) % COMPANY_ICON_IDS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = COMPANY_ICON_IDS.length - 1;
    else return;
    event.preventDefault();
    const id = COMPANY_ICON_IDS[next];
    choose(id);
    choiceRefs.current[next]?.focus();
  }

  return createPortal(
    <PopupShell
      variant="standard"
      className="company-icon-picker"
      titleId={titleId}
      closing={closing}
      onDismiss={() => exitThen(onClose)}
      closeOnBackdrop
      actions={
        <button className="buy-btn" onClick={() => exitThen(onClose)} type="button">
          {t('common.done')}
        </button>
      }
    >
      <div className="company-icon-picker__heading">
        <span className="company-icon-picker__current" aria-hidden>
          <CompanyIcon id={current} size={36} />
        </span>
        <div>
          <h3 id={titleId} className="popup__title">
            {t('company.icon.title')}
          </h3>
          <p id={descriptionId} className="muted small">
            {t('company.icon.desc')}
          </p>
        </div>
      </div>
      <div
        className="company-icon-grid"
        role="radiogroup"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        {COMPANY_ICON_IDS.map((id, index) => {
          const selected = id === current;
          const label = t(companyIconLabelKey(id));
          return (
            <button
              key={id}
              ref={(element) => {
                choiceRefs.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              tabIndex={selected ? 0 : -1}
              className={`company-icon-choice ${selected ? 'is-selected' : ''}`}
              onKeyDown={(event) => handleChoiceKey(event, index)}
              onClick={() => choose(id)}
            >
              <span className="company-icon-choice__art" aria-hidden>
                <CompanyIcon id={id} size={30} />
              </span>
              <span className="company-icon-choice__label">{label}</span>
              {selected ? (
                <span className="company-icon-choice__check" aria-hidden>
                  <Icon name="success" size={10} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </PopupShell>,
    document.body,
  );
}
