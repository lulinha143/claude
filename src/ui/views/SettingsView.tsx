import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { SUPPORTED_LANGUAGES, languageDisplayName } from '../../i18n';
import type { WindowCorner, WindowSettings } from '../../platform/types';
import { Icon } from '../../art/UiIcon';
import { Tip, TipContent } from '../Tooltip';
import { useFmt } from '../useFmt';
import { notify } from '../notificationsStore';
import { fileStamp } from '../../sim/format';

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
  const setBatterySaver = useStore((s) => s.setBatterySaver);
  const fmt = useFmt();
  const [win, setWin] = useState<WindowSettings | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  /** Outcome of the last save/export/import action, shown in the panel. */
  const [saveNote, setSaveNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  /** A file that has been read but NOT yet applied, awaiting confirmation. */
  const [pendingImport, setPendingImport] = useState<{ name: string; json: string } | null>(null);

  useEffect(() => {
    void platform.getWindowSettings().then((w) => {
      setWin(w);
      setBatterySaver(!!w.batterySaver); // mirror into the store so ambient can react
    });
  }, [platform, setBatterySaver]);

  const s = state.settings;
  function set(patch: Partial<typeof s>) {
    engine.updateSettings(patch);
    const st = engine.state.settings;
    audio.setVolumes(st.volumes);
    audio.setFlags({ muted: st.masterMuted });
    audio.setChannelMutes(st.channelMuted);
  }

  function setChannelMute(ch: 'music' | 'ambience' | 'ui' | 'sfx', muted: boolean) {
    set({ channelMuted: { ...s.channelMuted, [ch]: muted } });
  }

  function setBg(patch: Partial<typeof s.background>) {
    set({ background: { ...s.background, ...patch } });
  }

  function resetBackground() {
    setBg({
      enabled: true,
      brightness: 1,
      contrast: 1,
      saturation: 1,
      blurBehindPanels: true,
      quality: 'high',
      focal: 'center',
      pauseWhenHidden: true,
    });
  }

  function resetAudio() {
    set({
      masterMuted: false,
      channelMuted: { music: false, ambience: false, ui: false, sfx: false },
      muteWhenUnfocused: false,
      volumes: { master: 0.85, music: 0.7, ambience: 0.75, ui: 0.8, sfx: 0.85 },
    });
  }

  async function updateWin(patch: Partial<WindowSettings>) {
    const next = await platform.setWindowSettings(patch);
    setWin(next);
    if ('batterySaver' in patch) setBatterySaver(!!next.batterySaver);
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

  /**
   * Export, with the three things the previous version left out: a filename that
   * identifies the save, an object URL that gets released, and any word to the
   * player about whether it worked.
   */
  function exportSave() {
    let url: string | null = null;
    try {
      const blob = new Blob([useStore.getState().save.exportSave(engine.state)], {
        type: 'application/json',
      });
      url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Was always `zooworkers-save.json`, so a second export silently became
      // "(1)" and no file said which company or when it was taken.
      const company = engine.state.company.name.replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '');
      a.download = `zooworkers_${company || 'company'}_${fileStamp(Date.now())}.json`;
      a.click();
      setSaveNote({ tone: 'ok', text: t('settings.exportDone') });
      audio.play('click');
    } catch {
      setSaveNote({ tone: 'bad', text: t('settings.exportFailed') });
      audio.play('error');
    } finally {
      // Never leaked before, so every export pinned its save in memory for the
      // rest of the session.
      if (url) setTimeout(() => URL.revokeObjectURL(url as string), 10_000);
    }
  }

  /**
   * Importing REPLACES the company, so it asks first.
   *
   * The file is read here but applied only on confirmation: reading is harmless and
   * lets the dialogue name the actual file, while the destructive step stays behind
   * an explicit choice. Previously a stray click on a file picker could overwrite
   * hours of play with no warning and no message either way.
   */
  function onImportPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so re-picking the same file still fires a change event.
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => {
      setSaveNote({ tone: 'bad', text: t('settings.importUnreadable') });
      audio.play('error');
    };
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setSaveNote({ tone: 'bad', text: t('settings.importUnreadable') });
        audio.play('error');
        return;
      }
      setPendingImport({ name: file.name, json: reader.result });
      setSaveNote(null);
    };
    reader.readAsText(file);
  }

  function applyImport() {
    if (!pendingImport) return;
    const ok = importSave(pendingImport.json);
    setPendingImport(null);
    if (ok) {
      // The view switches to the office on success, so the confirmation has to be
      // a notification rather than an inline note nobody will be looking at.
      notify('save', t('settings.importDone'), 'positive');
      audio.play('upgrade');
    } else {
      setSaveNote({ tone: 'bad', text: t('settings.importInvalid') });
      audio.play('error');
    }
  }

  return (
    <section className="view view--settings">
      <h2>{t('settings.title')}</h2>

      <div className="panel">
        <h3>{t('settings.language')}</h3>
        <select
          value={i18n.language}
          onChange={(e) => changeLanguage(e.target.value)}
          className="select"
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {languageDisplayName(l)}
            </option>
          ))}
        </select>
      </div>

      <div className="panel">
        <h3>{t('settings.audio')}</h3>
        <p className="muted small">{t('settings.audioNote')}</p>
        <Toggle
          label={t('settings.mute')}
          checked={s.masterMuted}
          onChange={(v) => set({ masterMuted: v })}
        />
        <label className="slider-row">
          <span>{t('settings.master')}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.volumes.master}
            onChange={(e) => set({ volumes: { ...s.volumes, master: Number(e.target.value) } })}
          />
          <span className="vol-pct">{Math.round(s.volumes.master * 100)}%</span>
        </label>
        {(['music', 'ambience', 'ui', 'sfx'] as const).map((ch) => (
          <div key={ch} className="audio-row">
            <button
              className={`mute-btn ${s.channelMuted[ch] ? 'is-muted' : ''}`}
              onClick={() => setChannelMute(ch, !s.channelMuted[ch])}
              aria-pressed={s.channelMuted[ch]}
              aria-label={t('settings.muteChannel', { channel: t(`settings.${ch}`) })}
              title={t('settings.muteChannel', { channel: t(`settings.${ch}`) })}
            >
              <Icon name={s.channelMuted[ch] ? 'quiet' : 'sound'} size={16} />
            </button>
            <span className="audio-row__label">{t(`settings.${ch}`)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              disabled={s.channelMuted[ch]}
              value={s.volumes[ch]}
              onChange={(e) => set({ volumes: { ...s.volumes, [ch]: Number(e.target.value) } })}
            />
            <span className="vol-pct">{Math.round(s.volumes[ch] * 100)}%</span>
          </div>
        ))}
        <Toggle
          label={t('settings.muteWhenUnfocused')}
          checked={s.muteWhenUnfocused}
          onChange={(v) => set({ muteWhenUnfocused: v })}
        />
        <button className="ghost-btn" onClick={resetAudio}>
          {t('settings.resetAudio')}
        </button>
      </div>

      <div className="panel">
        <h3>{t('settings.gameplay')}</h3>
        <Toggle
          label={t('settings.autoResolveEvents')}
          checked={s.autoResolveEvents}
          onChange={(v) => set({ autoResolveEvents: v })}
        />
        {/* Say plainly what the setting does, so "no popups" never reads as
            "events silently stop happening". */}
        <p className="settings-note">
          {s.autoResolveEvents
            ? t('settings.autoResolveEventsOn')
            : t('settings.autoResolveEventsOff')}
        </p>
      </div>

      <div className="panel">
        <h3>{t('settings.accessibility')}</h3>
        <Toggle
          label={t('settings.reducedMotion')}
          checked={s.reducedMotion}
          onChange={(v) => set({ reducedMotion: v })}
        />
        <Toggle
          label={t('settings.disableShake')}
          checked={s.disableShake}
          onChange={(v) => set({ disableShake: v })}
        />
        <Toggle
          label={t('settings.disableFlashing')}
          checked={s.disableFlashing}
          onChange={(v) => set({ disableFlashing: v })}
        />
        <Toggle
          label={t('settings.highContrast')}
          checked={s.highContrast}
          onChange={(v) => set({ highContrast: v })}
        />
        <Toggle
          label={t('settings.dyslexiaFont')}
          checked={s.dyslexiaFont}
          onChange={(v) => set({ dyslexiaFont: v })}
        />
        <Toggle
          label={t('settings.subtitles')}
          checked={s.subtitles}
          onChange={(v) => set({ subtitles: v })}
        />
        <Toggle
          label={t('settings.pauseInMenus')}
          checked={s.pauseAnimationsInMenus}
          onChange={(v) => set({ pauseAnimationsInMenus: v })}
        />
        <Toggle
          label={t('settings.showHints')}
          checked={s.showHints}
          onChange={(v) => set({ showHints: v })}
        />
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
          <input
            type="range"
            min={0.8}
            max={1.5}
            step={0.1}
            value={s.fontScale}
            onChange={(e) => set({ fontScale: Number(e.target.value) })}
          />
        </label>
        <label className="slider-row">
          <span>{t('settings.uiScale')}</span>
          <input
            type="range"
            min={0.8}
            max={1.5}
            step={0.1}
            value={s.uiScale}
            onChange={(e) => set({ uiScale: Number(e.target.value) })}
          />
        </label>
        <label className="slider-row">
          <span>{t('settings.fpsLimit')}</span>
          <select
            className="select"
            value={s.fpsLimit}
            onChange={(e) => set({ fpsLimit: Number(e.target.value) as 30 | 60 })}
          >
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </label>
      </div>

      <div className="panel">
        <h3>{t('settings.bg.title')}</h3>
        <p className="muted small">{t('settings.bg.note')}</p>
        <Toggle
          label={t('settings.bg.enabled')}
          checked={s.background.enabled}
          onChange={(v) => setBg({ enabled: v })}
        />
        <Toggle
          label={t('settings.bg.blurPanels')}
          checked={s.background.blurBehindPanels}
          onChange={(v) => setBg({ blurBehindPanels: v })}
        />
        <Toggle
          label={t('settings.bg.pauseWhenHidden')}
          checked={s.background.pauseWhenHidden}
          onChange={(v) => setBg({ pauseWhenHidden: v })}
        />
        {(['brightness', 'contrast', 'saturation'] as const).map((k) => (
          <label key={k} className="slider-row">
            <span>{t(`settings.bg.${k}`)}</span>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={s.background[k]}
              onChange={(e) => setBg({ [k]: Number(e.target.value) })}
            />
            <span className="vol-pct">{Math.round(s.background[k] * 100)}%</span>
          </label>
        ))}
        <label className="slider-row">
          <span>{t('settings.bg.quality')}</span>
          <select
            className="select"
            value={s.background.quality}
            onChange={(e) => setBg({ quality: e.target.value as typeof s.background.quality })}
          >
            <option value="high">{t('settings.bg.qHigh')}</option>
            <option value="balanced">{t('settings.bg.qBalanced')}</option>
            <option value="static">{t('settings.bg.qStatic')}</option>
          </select>
        </label>
        <label className="slider-row">
          <span>{t('settings.bg.focal')}</span>
          <select
            className="select"
            value={s.background.focal}
            onChange={(e) => setBg({ focal: e.target.value as typeof s.background.focal })}
          >
            {(['center', 'top', 'bottom', 'left', 'right'] as const).map((f) => (
              <option key={f} value={f}>
                {t(`settings.bg.focal_${f}`)}
              </option>
            ))}
          </select>
        </label>
        <button className="ghost-btn" onClick={resetBackground}>
          {t('settings.bg.reset')}
        </button>
      </div>

      <div className="panel">
        <h3>{t('settings.desktop')}</h3>
        {!platform.isDesktop ? <p className="muted small">{t('settings.browserNote')}</p> : null}
        <fieldset disabled={!platform.isDesktop || !win} className="desktop-controls">
          <Toggle
            label={t('settings.alwaysOnTop')}
            hint={t('settings.hint.alwaysOnTop')}
            checked={!!win?.alwaysOnTop}
            onChange={(v) => updateWin({ alwaysOnTop: v })}
          />
          <Toggle
            label={t('settings.clickThrough')}
            hint={t('settings.hint.clickThrough')}
            checked={!!win?.clickThrough}
            onChange={(v) => updateWin({ clickThrough: v })}
          />
          <Toggle
            label={t('settings.launchOnStartup')}
            hint={t('settings.hint.launchOnStartup')}
            checked={!!win?.launchOnStartup}
            onChange={(v) => updateWin({ launchOnStartup: v })}
          />
          <Toggle
            label={t('window.closeToTray')}
            hint={t('settings.hint.closeToTray')}
            checked={!!win?.closeToTray}
            onChange={(v) => updateWin({ closeToTray: v })}
          />
          <Toggle
            label={t('settings.batterySaver')}
            hint={t('settings.hint.batterySaver')}
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
            <select
              className="select"
              value={win?.scale ?? 1}
              onChange={(e) => updateWin({ scale: Number(e.target.value) })}
            >
              {SCALES.map((sc) => (
                <option key={sc} value={sc}>
                  {Math.round(sc * 100)}%
                </option>
              ))}
            </select>
          </label>
          <button
            className="ghost-btn"
            disabled={!platform.isDesktop}
            onClick={() => platform.hideToTray()}
          >
            {t('settings.hideToTray')}
          </button>
        </fieldset>
        <p className="muted small">{t('settings.idleNote')}</p>
      </div>

      <div className="panel">
        <h3>{t('settings.save')}</h3>

        {/* SAVE STATUS.
            The panel used to be four bare buttons: no indication that the game
            autosaves, no way to tell whether "Save now" had done anything, and no
            timestamp to identify what state the company is actually in. A player
            asking "is my progress safe?" had nothing to read. */}
        <div className="savebar">
          <div className="savebar__status">
            <span className="savebar__label">{t('settings.saveStatus')}</span>
            <strong className="savebar__value">
              {state.lastSaved ? fmt.dateTime(state.lastSaved) : t('settings.saveNever')}
            </strong>
          </div>
          <button
            className="mini-btn mini-btn--primary savebar__now"
            onClick={() => {
              engine.save();
              setSaveNote({ tone: 'ok', text: t('settings.saveDone') });
              audio.play('click');
            }}
          >
            <Icon name="success" size={13} /> {t('settings.manualSave')}
          </button>
        </div>
        <p className="muted small savebar__auto">{t('settings.saveAuto')}</p>

        <div className="button-row">
          <button className="ghost-btn" onClick={exportSave}>
            <Icon name="export" size={13} /> {t('settings.export')}
          </button>
          <label className="ghost-btn file-btn">
            <Icon name="import" size={13} /> {t('settings.import')}
            <input
              type="file"
              accept="application/json,.json"
              onChange={onImportPicked}
              hidden
              aria-label={t('settings.importPick')}
            />
          </label>
          <button className="ghost-btn" onClick={replayOnboarding}>
            {t('settings.replayTutorial')}
          </button>
        </div>

        {/* Where saves live. Stated plainly, and deliberately NOT dressed up as
            cloud sync, which the game does not have. */}
        <p className="muted small">{t('settings.localOnly')}</p>

        {/* OVERWRITE WARNING. Import replaces the whole company, so it is the one
            action here that has to be confirmed. */}
        {pendingImport ? (
          <div className="savebar__confirm" role="alertdialog" aria-live="polite">
            <strong className="savebar__confirm-title">{t('settings.importConfirmTitle')}</strong>
            <p className="savebar__confirm-body">
              {t('settings.importConfirmBody', {
                file: pendingImport.name,
                company: state.company.name,
              })}
            </p>
            <div className="savebar__confirm-actions">
              <button className="danger-btn" onClick={applyImport}>
                {t('settings.importReplace')}
              </button>
              <button className="ghost-btn" onClick={() => setPendingImport(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : null}

        {/* Outcome of the last save action, in the player's language rather than the
            developer's. Cleared by the next action. */}
        {saveNote ? (
          <p className={`savebar__note savebar__note--${saveNote.tone}`} role="status">
            {/* An ICON, not a CSS glyph. A check mark (U+2713) in `content:` rendered
                as a tofu box, because the bundled font subset is Latin-only — the
                same lesson the click-payout prefix already learned. Caught here by
                eye and then, independently, by tests/glyphSafety.test.ts, which
                scans source text: hence the codepoint named rather than typed. */}
            <Icon name={saveNote.tone === 'ok' ? 'success' : 'warning'} size={14} />
            <span>{saveNote.text}</span>
          </p>
        ) : null}
        {confirmReset ? (
          <div className="confirm-row">
            <span>{t('settings.resetConfirm')}</span>
            <button className="danger-btn" onClick={hardReset}>
              {t('common.confirm')}
            </button>
            <button className="ghost-btn" onClick={() => setConfirmReset(false)}>
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <button className="danger-btn" onClick={() => setConfirmReset(true)}>
            {t('settings.reset')}
          </button>
        )}
      </div>
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  const text = hint ? (
    <Tip content={<TipContent title={label} lines={[hint]} />}>
      <span tabIndex={0}>{label}</span>
    </Tip>
  ) : (
    <span>{label}</span>
  );
  return (
    <label className="toggle-row">
      {text}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
