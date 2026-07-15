import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Quicksand — the game's cozy rounded identity font. Bundled locally via
// Fontsource (SIL Open Font License 1.1: free for commercial use, embedding and
// redistribution). Weights: 400 body, 500 emphasis, 600 headings, 700 display.
import '@fontsource/quicksand/400.css';
import '@fontsource/quicksand/500.css';
import '@fontsource/quicksand/600.css';
import '@fontsource/quicksand/700.css';
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
