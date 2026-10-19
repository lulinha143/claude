import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useFmt } from '../useFmt';
import { ACHIEVEMENTS } from '../../content/achievements';
import { GoldenNut } from '../../art/Icons';

export function AchievementsView() {
  const { t } = useTranslation();
  const { state } = useGame();
  const fmt = useFmt();
  const unlockedCount = ACHIEVEMENTS.filter((a) => (state.achievements[a.id] ?? 0) > 0).length;

  return (
    <section className="view view--achievements">
      <h2>{t('nav.achievements')}</h2>
      <p className="muted">
        {t('collections.discovered', { count: unlockedCount, total: ACHIEVEMENTS.length })}
      </p>
      <ul className="ach-grid">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = (state.achievements[a.id] ?? 0) > 0;
          const hidden = a.hidden && !unlocked;
          return (
            <li key={a.id} className={`ach ${unlocked ? 'is-unlocked' : ''}`}>
              <div className="ach__name">{hidden ? '???' : t(a.nameKey)}</div>
              <div className="ach__desc">
                {hidden ? t('collections.undiscovered') : t(a.descriptionKey)}
              </div>
              {/* A hidden achievement keeps its reward to itself until it is earned. */}
              <div className="ach__reward">
                <GoldenNut size={14} /> {hidden ? '?' : fmt.int(a.goldenReward)}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
