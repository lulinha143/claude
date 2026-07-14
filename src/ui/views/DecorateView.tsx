import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { DECORATIONS } from '../../content/decorations';
import { ROOMS_BY_ID } from '../../content/rooms';
import { isRoomUnlocked } from '../../sim/rooms';
import { Acorn, GoldenNut } from '../../art/Icons';

export function DecorateView() {
  const { t } = useTranslation();
  const { state } = useGame();
  const fmt = useFmt();
  const buy = useStore((s) => s.buyDecoration);
  const audio = useStore((s) => s.audio);

  const available = DECORATIONS.filter((d) => {
    const room = ROOMS_BY_ID[d.room];
    return room && isRoomUnlocked(state, room);
  });

  return (
    <section className="view view--decorate">
      <h2>{t('nav.decorate')}</h2>
      <ul className="card-list">
        {available.map((d) => {
          const owned = state.collections.secrets.includes(`deco:${d.id}`);
          const afford = state.resources[d.cost.resource] >= d.cost.amount;
          return (
            <li key={d.id} className={`card ${owned ? 'is-maxed' : ''}`}>
              <div className="card__body">
                <div className="card__title">
                  {t(`deco.${d.id}.name`)}
                  <span className="pill">{t(ROOMS_BY_ID[d.room].nameKey)}</span>
                </div>
                <div className="card__desc">+{d.moraleBonus} {t('resource.morale').toLowerCase()}</div>
              </div>
              <button
                className="buy-btn"
                disabled={owned || !afford}
                onClick={() => { if (buy(d.id)) audio.play('upgrade'); }}
              >
                {owned ? (
                  t('common.owned', { count: 1 })
                ) : (
                  <>
                    {d.cost.resource === 'goldenNuts' ? <GoldenNut size={16} /> : <Acorn size={16} />}
                    <span>{fmt.num(d.cost.amount)}</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
