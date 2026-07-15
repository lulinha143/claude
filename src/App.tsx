import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, startGameLoop, getGameState, type ViewId } from './state/store';
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
import { DevPanel } from './ui/DevPanel';

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
  const setPhotoMode = useStore((s) => s.setPhotoMode);

  // Start the sim loop once.
  useEffect(() => {
    startGameLoop();
  }, []);

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
    root.style.setProperty('--font-scale', String(s.fontScale));
    root.style.setProperty('--ui-scale', String(s.uiScale));
    audio.setVolumes(s.volumes);
    audio.setFlags({ muted: s.masterMuted, quiet: s.quietMode, focus: state.focus.active });
    audio.setChannelMutes(s.channelMuted);
  }, [state.settings, state.focus.active, view, audio]);

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
      <div className="photo-mode">
        <OfficeScene />
        <button className="buy-btn photo-mode__close" onClick={() => setPhotoMode(false)}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <OfficeBackground visible={view === 'office'} />
      <Header />
      <NavBar />
      <RecommendedStep />
      <main className="app__main">
        <Current />
      </main>
      <EventModal />
      <ConsequenceModal />
      <OfflineModal />
      <OpeningSequence />
      <Onboarding />
      <Notifications />
      {devEnabled ? <DevPanel /> : null}
    </div>
  );
}
