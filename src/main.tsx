// Tokens first: they declare the cascade-layer order (legacy, game) for the game.
import './ui/tokens.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Two-font identity, bundled locally via Fontsource (both SIL Open Font License
// 1.1 — free for commercial use, embedding and redistribution; no online fetch):
//   DynaPuff — hand-lettered DISPLAY face: brand, titles, events, key actions.
//   Nunito   — highly readable BODY face: descriptions, compact labels, numbers.
// Latin subsets include Latin-1 accents, so Portuguese (á ã ç ê õ …) renders
// correctly without shipping unrelated scripts. See docs/FONTS.md.
import '@fontsource/dynapuff/latin-400.css';
import '@fontsource/dynapuff/latin-500.css';
import '@fontsource/dynapuff/latin-600.css';
import '@fontsource/dynapuff/latin-700.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import { initI18n } from './i18n';
import { App } from './App';
import { getGameState } from './state/store';
import { GAME_TITLE } from './brand';
// `legacy` layer (pre-Phase-1 screens), then the `game` layer (the rebuilt shell).
import './styles.css';
import './ui/recordsDesk.css';
import './ui/game/base.css';
import './ui/game/shell.css';
import './ui/game/popup.css';
import './ui/game/opening.css';
import './ui/game/world.css';
import './ui/game/office-life.css';
import './ui/game/rooms.css';
import './ui/game/play.css';

async function bootstrap() {
  // Keep the browser/Electron window title in sync with the central brand.
  if (typeof document !== 'undefined') document.title = GAME_TITLE;

  // Prefer the language saved in the game state; i18next detector handles the
  // rest (localStorage → navigator → 'en').
  const saved = getGameState().settings.language;
  await initI18n(saved && saved !== 'en' ? saved : undefined);

  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('#root not found');
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
