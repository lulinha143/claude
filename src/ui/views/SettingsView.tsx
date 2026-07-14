import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { SUPPORTED_LANGUAGES, languageDisplayName } from '../../i18n';
import type { WindowCorner, WindowSettings } from '../../platform/types';

const CORNERS: WindowCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const SCALES = [0.75, 1, 1.25, 1.5];

export function SettingsView() {
  const { t, i18n } = useTranslation();
  const { engine, state } = useGame();
  const audio = useStore((s) => s.audio);
  const platform = useStore((s) => s.platform);
  const replayOnboarding = useStore((s) => s.replayOnboarding);
  const hardReset = useStore((s) => s.hardReset);
  const importSave = useStore((s) => s.importSave);
  const [win, setWin] = useState<WindowSettings | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    void platform.getWindowSettings().then(setWin);
  }, [platform]);

  const s = state.settings;
  function set(patch: Partial<typeof s>) {
    engine.updateSettings(patch);
    audio.setVolumes(engine.state.settings.volumes);
    audio.setFlags({ muted: engine.state.settings.masterMuted });
  }

  async function updateWin(patch: Partial<WindowSettings>) {
    const next = await platform.setWindowSettings(patch);
    setWin(next);
  }

  function changeLanguage(lang: string) {
    void i18n.changeLanguage(lang);
    set({ language: lang });
    try {
      localStorage.setItem('wmno.lang', lang);
    } catch {
      /* ignore */
    }
  }

  function exportSave() {
    const data = engine.state;
    const blob = new Blob([useStore.getState().save.exportSave(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'working-my-nuts-off-save.json';
    a.click();
  }

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') importSave(reader.result);
    };
    reader.readAsText(file);
  }

  return (
    <section className="view view--settings">
      <h2>{t('settings.title')}</h2>

      <div className="panel">
        <h3>{t('settings.language')}</h3>
        <select value={i18n.language} onChange={(e) => changeLanguage(e.target.value)} className="select">
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {languageDisplayName(l)}
            </option>
          ))}
        </select>
      </div>

      <div className="panel">
        <h3>{t('settings.audio')}</h3>
        <Toggle label={t('settings.mute')} checked={s.masterMuted} onChange={(v) => set({ masterMuted: v })} />
        {(['master', 'music', 'ambience', 'ui', 'sfx'] as const).map((ch) => (
          <label key={ch} className="slider-row">
            <span>{t(`settings.${ch}`)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.volumes[ch]}
              onChange={(e) => set({ volumes: { ...s.volumes, [ch]: Number(e.target.value) } })}
            />
          </label>
        ))}
      </div>

      <div className="panel">
        <h3>{t('settings.accessibility')}</h3>
        <Toggle label={t('settings.reducedMotion')} checked={s.reducedMotion} onChange={(v) => set({ reducedMotion: v })} />
        <Toggle label={t('settings.disableShake')} checked={s.disableShake} onChange={(v) => set({ disableShake: v })} />
        <Toggle label={t('settings.disableFlashing')} checked={s.disableFlashing} onChange={(v) => set({ disableFlashing: v })} />
        <Toggle label={t('settings.highContrast')} checked={s.highContrast} onChange={(v) => set({ highContrast: v })} />
        <Toggle label={t('settings.dyslexiaFont')} checked={s.dyslexiaFont} onChange={(v) => set({ dyslexiaFont: v })} />
        <Toggle label={t('settings.subtitles')} checked={s.subtitles} onChange={(v) => set({ subtitles: v })} />
        <Toggle label={t('settings.pauseInMenus')} checked={s.pauseAnimationsInMenus} onChange={(v) => set({ pauseAnimationsInMenus: v })} />
        <label className="slider-row">
          <span>{t('settings.colorblind')}</span>
          <select
            className="select"
            value={s.colorblindMode}
            onChange={(e) => set({ colorblindMode: e.target.value as typeof s.colorblindMode })}
          >
            <option value="off">off</option>
            <option value="deuteranopia">deuteranopia</option>
            <option value="protanopia">protanopia</option>
            <option value="tritanopia">tritanopia</option>
          </select>
        </label>
        <label className="slider-row">
          <span>{t('settings.fontScale')}</span>
          <input type="range" min={0.8} max={1.5} step={0.1} value={s.fontScale} onChange={(e) => set({ fontScale: Number(e.target.value) })} />
        </label>
        <label className="slider-row">
          <span>{t('settings.uiScale')}</span>
          <input type="range" min={0.8} max={1.5} step={0.1} value={s.uiScale} onChange={(e) => set({ uiScale: Number(e.target.value) })} />
        </label>
        <label className="slider-row">
          <span>{t('settings.fpsLimit')}</span>
          <select className="select" value={s.fpsLimit} onChange={(e) => set({ fpsLimit: Number(e.target.value) as 30 | 60 })}>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </label>
      </div>

      <div className="panel">
        <h3>{t('settings.desktop')}</h3>
        {!platform.isDesktop ? <p className="muted small">{t('settings.browserNote')}</p> : null}
        <fieldset disabled={!platform.isDesktop || !win} className="desktop-controls">
          <Toggle
            label={t('settings.alwaysOnTop')}
            checked={!!win?.alwaysOnTop}
            onChange={(v) => updateWin({ alwaysOnTop: v })}
          />
          <Toggle
            label={t('settings.clickThrough')}
            checked={!!win?.clickThrough}
            onChange={(v) => updateWin({ clickThrough: v })}
          />
          <Toggle
            label={t('settings.launchOnStartup')}
            checked={!!win?.launchOnStartup}
            onChange={(v) => updateWin({ launchOnStartup: v })}
          />
          <Toggle
            label={t('settings.batterySaver')}
            checked={!!win?.batterySaver}
            onChange={(v) => updateWin({ batterySaver: v })}
          />
          <label className="slider-row">
            <span>{t('settings.corner')}</span>
            <select
              className="select"
              value={win?.corner ?? 'bottom-right'}
              onChange={(e) => updateWin({ corner: e.target.value as WindowCorner })}
            >
              {CORNERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="slider-row">
            <span>{t('settings.scale')}</span>
            <select className="select" value={win?.scale ?? 1} onChange={(e) => updateWin({ scale: Number(e.target.value) })}>
              {SCALES.map((sc) => (
                <option key={sc} value={sc}>
                  {Math.round(sc * 100)}%
                </option>
              ))}
            </select>
          </label>
          <button className="ghost-btn" disabled={!platform.isDesktop} onClick={() => platform.hideToTray()}>
            {t('settings.hideToTray')}
          </button>
        </fieldset>
        <p className="muted small">{t('settings.idleNote')}</p>
      </div>

      <div className="panel">
        <h3>{t('settings.save')}</h3>
        <div className="button-row">
          <button className="ghost-btn" onClick={() => engine.save()}>{t('settings.manualSave')}</button>
          <button className="ghost-btn" onClick={exportSave}>{t('settings.export')}</button>
          <label className="ghost-btn file-btn">
            {t('settings.import')}
            <input type="file" accept="application/json" onChange={onImport} hidden />
          </label>
          <button className="ghost-btn" onClick={replayOnboarding}>{t('settings.replayTutorial')}</button>
        </div>
        {confirmReset ? (
          <div className="confirm-row">
            <span>{t('settings.resetConfirm')}</span>
            <button className="danger-btn" onClick={hardReset}>{t('common.confirm')}</button>
            <button className="ghost-btn" onClick={() => setConfirmReset(false)}>{t('common.cancel')}</button>
          </div>
        ) : (
          <button className="danger-btn" onClick={() => setConfirmReset(true)}>{t('settings.reset')}</button>
        )}
      </div>
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
