import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, startGameLoop, getGameState, type ViewId } from './state/store';
import { ambientState } from './art/ambient';
import { CHARACTER_PRESENCE_SCALE } from './art/employeeSprites';
import { toggleHaloTest } from './art/haloTest'; // TEMP halo-isolation A/B (Ctrl+Alt+H)
import { useGame } from './state/hooks';
import { GameHud } from './ui/GameHud';
import { GameDock, NextStepHint, dockFor } from './ui/GameDock';
import { Sheet } from './ui/Sheet';
import { GoalTag } from './ui/GoalTag';
import { EmployeeTalk } from './ui/modals/EmployeeTalk';
import { OfficeScene } from './art/OfficeScene';
import { EventModal } from './ui/modals/EventModal';
import { ConsequenceModal } from './ui/modals/ConsequenceModal';
import { OfflineModal } from './ui/modals/OfflineModal';
import { Onboarding } from './ui/modals/Onboarding';
import { OpeningSequence } from './ui/modals/OpeningSequence';
import { Notifications } from './ui/Notifications';
import { TooltipLayer } from './ui/Tooltip';
import { PhotoMode } from './ui/PhotoMode';
import { DevPanel } from './ui/DevPanel';
import {
  cancelTransientInteractions,
  restoreTransientInteractionFocus,
} from './ui/interactionLifecycle';

/** Something modal is on top: Escape belongs to it, not to the sheet. */
const MODAL_LAYERS = '.popup-backdrop, .modal-backdrop, .opening-seq, .photo-mode';

// Below the shell's 760px breakpoint a sheet covers the whole stage (see
// game/shell.css), so the office behind it is not on screen at all.
const NARROW_QUERY = '(max-width: 759px)';
function subscribeNarrow(onChange: () => void): () => void {
  const query = window.matchMedia?.(NARROW_QUERY);
  query?.addEventListener?.('change', onChange);
  return () => query?.removeEventListener?.('change', onChange);
}
const readNarrow = () => Boolean(window.matchMedia?.(NARROW_QUERY).matches);

export function App() {
  const { i18n } = useTranslation();
  const { state, engine } = useGame();
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const devEnabled = useStore((s) => s.devEnabled);
  const platform = useStore((s) => s.platform);
  const audio = useStore((s) => s.audio);
  const setQuiet = useStore((s) => s.setQuietMode);
  const photoMode = useStore((s) => s.photoMode);
  const batterySaver = useStore((s) => s.batterySaver);
  const minigameOpen = useStore((s) => s.minigameOpen);
  const narrow = useSyncExternalStore(subscribeNarrow, readNarrow, () => false);

  // Start the sim loop once.
  useEffect(() => {
    startGameLoop();
  }, []);

  // TEMPORARY diagnostic hooks (halo shimmer investigation). Remove once done.
  //   Ctrl+Alt+D → open the standalone A/B comparison page (public/halo-diag.html)
  //   Ctrl+Alt+H → flip the squirrel between its normal (halo) art and a
  //                halo-stripped (ZERO semi-transparent pixels) variant, in place,
  //                so the real-GPU shimmer can be judged against one variable.
  useEffect(() => {
    if (!devEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.altKey) return;
      if (e.key === 'd' || e.key === 'D') {
        window.location.assign(`${import.meta.env.BASE_URL ?? '/'}halo-diag.html`);
      } else if (e.key === 'h' || e.key === 'H') {
        const off = toggleHaloTest();
        // eslint-disable-next-line no-console
        console.info(
          `[halo-test] squirrel halo ${off ? 'REMOVED (binary alpha)' : 'restored (normal art)'}`,
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [devEnabled]);

  // Mark the desktop (frameless) shell so the app can fill the window edge-to-
  // edge — no rounded margin/shadow gap — which keeps the native OS resize
  // border exactly at the visible edge. In the browser we keep the framed card.
  useEffect(() => {
    document.documentElement.dataset.desktop = String(platform.isDesktop);
  }, [platform]);

  // Apply accessibility + audio settings to the document root reactively.
  useEffect(() => {
    const s = state.settings;
    const root = document.documentElement;
    root.dataset.reducedMotion = String(s.reducedMotion || s.quietMode);
    root.dataset.highContrast = String(s.highContrast);
    root.dataset.dyslexia = String(s.dyslexiaFont);
    root.dataset.colorblind = s.colorblindMode;
    root.dataset.pauseMenus = String(s.pauseAnimationsInMenus && view !== 'office');
    root.dataset.bgBlur = String(s.background.blurBehindPanels);
    root.dataset.uiScale =
      s.uiScale >= 1.5 ? '150' : s.uiScale >= 1.25 ? '125' : s.uiScale <= 0.75 ? '75' : '100';
    root.style.setProperty('--font-scale', String(s.fontScale));
    root.style.setProperty('--ui-scale', String(s.uiScale));
    // Keep the CSS mirror of the character presence scale in lockstep with the
    // TS constant, so room geometry always matches the rendered sprite size.
    root.style.setProperty('--character-presence', String(CHARACTER_PRESENCE_SCALE));
    audio.setVolumes(s.volumes);
    audio.setFlags({ muted: s.masterMuted, quiet: s.quietMode, focus: state.focus.active });
    audio.setChannelMutes(s.channelMuted);
  }, [state.settings, state.focus.active, view, audio]);

  // Throttle the office's decorative ambient life: pause it while the window is
  // hidden/minimized, in battery-saver mode, or when reduced motion is on. The
  // stylesheet keys off `data-ambient` to stop the cheap looping effects.
  useEffect(() => {
    const root = document.documentElement;
    const reduced = state.settings.reducedMotion || state.settings.quietMode;
    const apply = () => {
      root.dataset.ambient = ambientState({
        hidden: document.hidden,
        batterySaver,
        reducedMotion: reduced,
      });
    };
    apply();
    document.addEventListener('visibilitychange', apply);
    return () => document.removeEventListener('visibilitychange', apply);
  }, [batterySaver, state.settings.reducedMotion, state.settings.quietMode]);

  // Keep i18n in sync with the saved language on boot.
  useEffect(() => {
    if (state.settings.language && i18n.language !== state.settings.language) {
      void i18n.changeLanguage(state.settings.language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Desktop bridge events.
  useEffect(() => {
    const offQuiet = platform.onQuietMode((enabled) => setQuiet(enabled));
    const offSettings = platform.onShowSettings(() => setView('settings'));
    // "Mute when unfocused" (desktop): suspend/resume the audio context on
    // window focus changes when the option is enabled.
    const offFocus = platform.onFocusChanged((focused) => {
      cancelTransientInteractions(focused ? 'platform-focus' : 'platform-blur');
      if (focused) window.requestAnimationFrame(restoreTransientInteractionFocus);
      if (getGameState().settings.muteWhenUnfocused) audio.setActive(focused);
    });
    // resume audio on first user interaction (autoplay policy)
    const resume = () => {
      audio.resume();
      audio.startAmbience();
    };
    window.addEventListener('pointerdown', resume, { once: true });
    // suspend audio while the tab/window is hidden (battery-friendly)
    const onVisibility = () => audio.setActive(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      offQuiet();
      offSettings();
      offFocus();
      window.removeEventListener('pointerdown', resume);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [platform, setQuiet, setView, audio]);

  const talk = Boolean(engine.activeTalk);
  const sheetOpen = talk || view !== 'office';
  // The office rests (stops following sim ticks) while something covers it.
  const gameOn = view === 'focus' && minigameOpen;
  const officeCovered = talk || gameOn || (sheetOpen && narrow);

  // Escape closes the open sheet (a popup above it consumes Escape first) and
  // hands focus back to the dock button that opened it.
  useEffect(() => {
    if (!sheetOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector(MODAL_LAYERS)) return;
      event.preventDefault();
      const dock = dockFor(view);
      engine.closeTalk();
      setView('office' as ViewId);
      window.requestAnimationFrame(() => {
        const origin = dock
          ? document.querySelector<HTMLElement>(`.dock__item[data-dock="${dock}"]`)
          : document.querySelector<HTMLElement>('.hud__settings');
        origin?.focus({ preventScroll: true });
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen, view, engine, setView]);

  if (photoMode) {
    return (
      <>
        <PhotoMode />
        <TooltipLayer />
      </>
    );
  }

  return (
    <div
      className={`app ${sheetOpen ? 'app--sheet-open' : ''} ${gameOn ? 'app--game-on' : ''}`}
      data-sheet={sheetOpen ? (talk ? 'talk' : view) : undefined}
    >
      <GameHud />
      <main className="app__stage">
        {/* The office never unmounts: sheets open over it and closing one returns
            to the same floor and scroll position. */}
        <OfficeScene covered={officeCovered} />
        {/* The office's two notes: what the game suggests (when it has a new idea)
            and the immediate goal, bought right here. */}
        {!talk ? (
          <div className="stage-notes">
            <NextStepHint />
            <GoalTag />
          </div>
        ) : null}
        {/* A visit is its own full-stage mode (the office dims behind it); every
            other screen is a sheet over the office. */}
        {talk ? <EmployeeTalk /> : sheetOpen ? <Sheet view={view} /> : null}
      </main>
      <GameDock />
      <EventModal />
      <ConsequenceModal />
      <OfflineModal />
      <OpeningSequence />
      <Onboarding />
      <Notifications />
      <TooltipLayer />
      {devEnabled ? <DevPanel /> : null}
    </div>
  );
}
