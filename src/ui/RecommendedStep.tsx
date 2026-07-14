import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore, type ViewId } from '../state/store';
import { computeNextStep } from '../sim/nextStep';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { Icon } from '../art/UiIcon';

// A gentle, dismissible "what next?" nudge. Never forces the player; can be
// turned off in Settings (settings.showHints). Points at the most useful action.
export function RecommendedStep() {
  const { t } = useTranslation();
  const { state } = useGame();
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);

  if (!state.settings.showHints) return null;
  const step = computeNextStep(state);
  if (!step || step.view === view) return null;

  const name = step.employeeId ? t(EMPLOYEES_BY_ID[step.employeeId]?.nameKey ?? '') : '';
  return (
    <button className="next-step" onClick={() => setView(step.view as ViewId)}>
      <Icon name="notification" size={14} />
      <span>{t(`nextStep.${step.key}`, { name })}</span>
      <Icon name="back" size={12} className="next-step__go" />
    </button>
  );
}
