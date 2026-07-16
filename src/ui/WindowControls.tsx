import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state/store';
import { useGame } from '../state/hooks';
import { Icon } from '../art/UiIcon';

// Custom title-bar window controls for the frameless desktop window. Rendered
// only in the Electron build; the browser version shows nothing (the tab has
// its own chrome). Close saves the game + window state, then quits — unless the
// player enabled "Close minimizes to tray" in Settings (handled in main).
export function WindowControls() {
  const { t } = useTranslation();
  const platform = useStore((s) => s.platform);
  const { engine } = useGame();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!platform.isDesktop) return;
    let active = true;
    void platform.isMaximized().then((m) => active && setMaximized(m));
    const off = platform.onMaximizeChanged(setMaximized);
    return () => {
      active = false;
      off();
    };
  }, [platform]);

  if (!platform.isDesktop) return null;

  return (
    <div className="window-controls" role="group" aria-label={t('window.controls')}>
      <button
        className="wc-btn"
        aria-label={t('window.minimize')}
        title={t('window.minimize')}
        onClick={() => void platform.minimize()}
      >
        <Icon name="minimize" size={14} />
      </button>
      <button
        className="wc-btn"
        aria-label={maximized ? t('window.restore') : t('window.maximize')}
        title={maximized ? t('window.restore') : t('window.maximize')}
        onClick={() => void platform.toggleMaximize()}
      >
        <Icon name={maximized ? 'restore' : 'maximize'} size={13} />
      </button>
      <button
        className="wc-btn wc-btn--close"
        aria-label={t('window.close')}
        title={t('window.close')}
        onClick={() => {
          engine.save(); // flush progress before the window goes away
          void platform.closeWindow();
        }}
      >
        <Icon name="close" size={15} />
      </button>
    </div>
  );
}
