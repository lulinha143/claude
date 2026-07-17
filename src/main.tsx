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
import './styles.css';

async function bootstrap() {
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
