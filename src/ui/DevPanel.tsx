import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore } from '../state/store';
import { computeOffline, applyOffline } from '../sim/offline';
import { GAME_EVENTS } from '../content/events';
import { EMPLOYEES } from '../content/employees';
import { SAVE_VERSION } from '../sim/config';
import { unlockedRooms } from '../sim/rooms';
import { resources } from '../i18n';
import type { WindowSettings } from '../platform/types';

// Developer diagnostics + balance panel. Only mounted when devEnabled
// (import.meta.env.DEV or ?dev=1). Shows live diagnostics and offers safe dev
// actions. Never appears in a normal production build.

type Json = Record<string, unknown>;
function flatten(obj: Json, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) keys.push(path);
    else if (v && typeof v === 'object') keys.push(...flatten(v as Json, path));
    else keys.push(path);
  }
  return keys;
}

function missingKeyCount(lang: string): number {
  const en = new Set(flatten(resources.en.translation as unknown as Json));
  const cur = resources[lang as keyof typeof resources]?.translation as unknown as Json | undefined;
  if (!cur) return 0;
  const curKeys = new Set(flatten(cur));
  let missing = 0;
  for (const k of en) if (!curKeys.has(k)) missing += 1;
  return missing;
}

export function DevPanel() {
  const { t, i18n } = useTranslation();
  const { engine, state } = useGame();
  const hardReset = useStore((s) => s.hardReset);
  const platform = useStore((s) => s.platform);
  const audio = useStore((s) => s.audio);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'diag' | 'actions'>('diag');
  const [seed, setSeed] = useState('');
  const [offlineHours, setOfflineHours] = useState(4);
  const [fps, setFps] = useState(0);

  // live FPS meter (only while the panel is open)
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const tick = (now: number) => {
      frames += 1;
      if (now - last >= 1000) {
        setFps(frames);
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const missing = useMemo(() => missingKeyCount(i18n.language), [i18n.language]);

  if (!open) {
    return (
      <button className="dev-fab" onClick={() => setOpen(true)} title={t('dev.title')}>
        DEV
      </button>
    );
  }

  const nps = engine.productionPerSecond();
  const boost = engine.currentBoostMultiplier();
  const hired = Object.values(state.employees).filter((e) => e.hired).length;
  const rooms = unlockedRooms(state).length;
  const now = Date.now();
  const activeCooldowns = Object.values(state.eventCooldowns).filter((c) => c > now).length;
  const v = state.settings.volumes;
  const m = state.settings.channelMuted;

  const rows: [string, string][] = [
    [t('dev.version'), '1.0.0'],
    [t('dev.saveVersion'), String(SAVE_VERSION)],
    [t('dev.mode'), platform.isDesktop ? 'Electron' : 'Browser'],
    [t('dev.nps'), nps.toFixed(2)],
    [t('dev.boost'), `×${boost.toFixed(2)}`],
    [t('resource.morale'), Math.round(state.resources.morale).toString()],
    [t('resource.reputation'), Math.round(state.resources.reputation).toString()],
    [t('dev.hired'), `${hired}/${EMPLOYEES.length}`],
    [t('dev.rooms'), String(rooms)],
    [t('dev.activeEvent'), engine.activeEvent?.def.id ?? '—'],
    [t('dev.cooldowns'), String(activeCooldowns)],
    [t('dev.fps'), String(fps)],
    [t('dev.missingKeys'), `${i18n.language}: ${missing}`],
    [
      t('dev.audio'),
      `M${Math.round(v.master * 100)} ` +
        `mu${m.music ? 'x' : Math.round(v.music * 100)} ` +
        `am${m.ambience ? 'x' : Math.round(v.ambience * 100)} ` +
        `ui${m.ui ? 'x' : Math.round(v.ui * 100)} ` +
        `sfx${m.sfx ? 'x' : Math.round(v.sfx * 100)}`,
    ],
  ];

  return (
    <div className="dev-panel">
      <div className="dev-panel__head">
        <strong>{t('dev.title')}</strong>
        <div className="dev-panel__tabs">
          <button className={tab === 'diag' ? 'is-on' : ''} onClick={() => setTab('diag')}>
            {t('dev.diagnostics')}
          </button>
          <button className={tab === 'actions' ? 'is-on' : ''} onClick={() => setTab('actions')}>
            {t('dev.actions')}
          </button>
        </div>
        <button className="ghost-btn" onClick={() => setOpen(false)}>
          {t('common.close')}
        </button>
      </div>

      {tab === 'diag' ? (
        <table className="dev-diag">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th>{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="dev-panel__grid">
          <button onClick={() => { state.resources.nuts += 1e6; engine.save(); bump(engine); }}>+1M {t('dev.addNuts')}</button>
          <button onClick={() => { state.resources.goldenNuts += 25; bump(engine); }}>+25 {t('dev.addGolden')}</button>
          <button onClick={() => { state.resources.reputation += 500; bump(engine); }}>+500 {t('dev.addReputation')}</button>
          <button onClick={() => { for (const e of EMPLOYEES) { const rt = state.employees[e.id]; rt.hired = true; if (rt.level < 1) rt.level = 1; } bump(engine); }}>
            {t('dev.unlockAll')}
          </button>
          <label>
            {t('dev.triggerEvent')}
            <select onChange={(e) => e.target.value && engine.triggerEvent(e.target.value)} defaultValue="">
              <option value="" disabled>—</option>
              {GAME_EVENTS.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.id}</option>
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
          <button
            disabled={!platform.isDesktop}
            onClick={() => void platform.setWindowSettings({ corner: 'bottom-right' } as Partial<WindowSettings>)}
          >
            {t('dev.resetWindow')}
          </button>
          <button
            onClick={() => {
              audio.resume();
              (['click', 'collect', 'upgrade', 'event', 'celebrate', 'prestige'] as const).forEach((s, i) =>
                setTimeout(() => audio.play(s), i * 250),
              );
            }}
          >
            {t('dev.testAudio')}
          </button>
          <button className="danger-btn" onClick={hardReset}>
            {t('dev.resetSave')}
          </button>
        </div>
      )}
      <p className="muted small">{t('dev.note')}</p>
    </div>
  );
}

function bump(engine: ReturnType<typeof useGame>['engine']) {
  // trigger a store update by advancing the engine version via a no-op emit
  engine.updateSettings({});
}
