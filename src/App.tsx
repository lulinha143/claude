import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, startGameLoop, getGameState, type ViewId } from './state/store';
import { ambientState } from './art/ambient';
import { toggleHaloTest } from './art/haloTest'; // TEMP halo-isolation A/B (Ctrl+Alt+H)
import { useGame } from './state/hooks';
import { Header } from './ui/Header';
import { NavBar } from './ui/NavBar';
import { RecommendedStep } from './ui/RecommendedStep';
import { OfficeScene } from './art/OfficeScene';
import { OfficeBackground } from './art/OfficeBackground';
import { ShopView } from './ui/views/ShopView';
import { EmployeesView } from './ui/views/EmployeesView';
import { CompanyView } from './ui/views/CompanyView';
import { CollectionsView } from './ui/views/CollectionsView';
import { AchievementsView } from './ui/views/AchievementsView';
import { FocusView } from './ui/views/FocusView';
import { DecorateView } from './ui/views/DecorateView';
import { StatsView } from './ui/views/StatsView';
import { PrestigeView } from './ui/views/PrestigeView';
import { SettingsView } from './ui/views/SettingsView';
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

const VIEWS: Record<ViewId, () => JSX.Element> = {
  office: OfficeScene,
  shop: ShopView,
  employees: EmployeesView,
  company: CompanyView,
  collections: CollectionsView,
  achievements: AchievementsView,
  focus: FocusView,
  decorate: DecorateView,
  stats: StatsView,
  prestige: PrestigeView,
  settings: SettingsView,
};

export function App() {
  const { i18n } = useTranslation();
  const { state } = useGame();
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const devEnabled = useStore((s) => s.devEnabled);
  const platform = useStore((s) => s.platform);
  const audio = useStore((s) => s.audio);
  const setQuiet = useStore((s) => s.setQuietMode);
  const photoMode = useStore((s) => s.photoMode);
  const batterySaver = useStore((s) => s.batterySaver);

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
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.altKey) return;
      if (e.key === 'd' || e.key === 'D') {
        window.location.assign(`${import.meta.env.BASE_URL ?? '/'}halo-diag.html`);
      } else if (e.key === 'h' || e.key === 'H') {
        const off = toggleHaloTest();
        // eslint-disable-next-line no-console
        console.info(`[halo-test] squirrel halo ${off ? 'REMOVED (binary alpha)' : 'restored (normal art)'}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  const Current = VIEWS[view];

  if (photoMode) {
    return (
      <>
        <PhotoMode />
        <TooltipLayer />
      </>
    );
  }

  return (
    <div className="app">
      <OfficeBackground visible={view === 'office'} />
      <Header />
      <NavBar />
      <RecommendedStep />
      <main className="app__main">
        <div className="view-anim" key={view}>
          <Current />
        </div>
      </main>
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
