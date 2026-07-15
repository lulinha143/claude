import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useFmt } from '../useFmt';

export function StatsView() {
  const { t } = useTranslation();
  const { state } = useGame();
  const fmt = useFmt();
  const s = state.stats;

  const rows: [string, string][] = [
    [t('stats.totalNuts'), fmt.num(s.totalNutsEarned)],
    [t('stats.clicks'), fmt.int(s.totalClicks)],
    [t('stats.crates'), fmt.int(s.cratesCollected)],
    [t('stats.playTime'), fmt.dur(s.playTimeSeconds)],
    [t('stats.events'), fmt.int(s.eventsSeen)],
    [t('stats.microgames'), fmt.int(s.microgamesPlayed)],
    [t('stats.peakNps'), fmt.num(s.highestNutsPerSecond)],
    [t('stats.prestiges'), fmt.int(s.prestiges)],
  ];

  return (
    <section className="view view--stats">
      <h2>{t('stats.title')}</h2>
      <table className="stats-table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th>{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
