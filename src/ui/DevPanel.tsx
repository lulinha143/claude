import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore } from '../state/store';
import { computeOffline, applyOffline } from '../sim/offline';
import { GAME_EVENTS } from '../content/events';
import { EMPLOYEES } from '../content/employees';

// Developer balance panel. Only mounted when devEnabled (import.meta.env.DEV or
// ?dev=1). Lets a designer add currency, trigger events, simulate offline time,
// unlock content, use a deterministic seed, and reset the save.
export function DevPanel() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const hardReset = useStore((s) => s.hardReset);
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState('');
  const [offlineHours, setOfflineHours] = useState(4);

  if (!open) {
    return (
      <button className="dev-fab" onClick={() => setOpen(true)} title={t('dev.title')}>
        DEV
      </button>
    );
  }

  return (
    <div className="dev-panel">
      <div className="dev-panel__head">
        <strong>{t('dev.title')}</strong>
        <button className="ghost-btn" onClick={() => setOpen(false)}>
          {t('common.close')}
        </button>
      </div>
      <div className="dev-panel__grid">
        <button onClick={() => { state.resources.nuts += 1e6; engine.save(); bump(engine); }}>+1M {t('dev.addNuts')}</button>
        <button onClick={() => { state.resources.goldenNuts += 25; bump(engine); }}>+25 {t('dev.addGolden')}</button>
        <button onClick={() => { state.resources.reputation += 50; bump(engine); }}>+50 {t('dev.addReputation')}</button>
        <button onClick={() => { for (const e of EMPLOYEES) { const rt = state.employees[e.id]; rt.hired = true; if (rt.level < 1) rt.level = 1; } bump(engine); }}>
          {t('dev.unlockAll')}
        </button>
        <label>
          {t('dev.triggerEvent')}
          <select onChange={(e) => e.target.value && engine.triggerEvent(e.target.value)} defaultValue="">
            <option value="" disabled>
              —
            </option>
            {GAME_EVENTS.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('dev.simOffline')}
          <input type="number" value={offlineHours} min={0} max={48} onChange={(e) => setOfflineHours(Number(e.target.value))} />
          <button
            onClick={() => {
              state.lastSaved = Date.now() - offlineHours * 3600 * 1000;
              const r = computeOffline(state, Date.now());
              applyOffline(state, r);
              engine.save();
              bump(engine);
            }}
          >
            go
          </button>
        </label>
        <label>
          {t('dev.deterministic')}
          <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="seed" />
          <button onClick={() => engine.reseed(seed || 'dev')}>set</button>
        </label>
        <button className="danger-btn" onClick={hardReset}>
          {t('dev.resetSave')}
        </button>
      </div>
      <p className="muted small">{t('dev.note')}</p>
    </div>
  );
}

function bump(engine: ReturnType<typeof useGame>['engine']) {
  // trigger a store update by advancing the engine version via a no-op emit
  engine.updateSettings({});
}
