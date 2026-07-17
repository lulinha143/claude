import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Two-font identity, bundled locally via Fontsource (both SIL Open Font License
// 1.1 — free for commercial use, embedding and redistribution; no online fetch):
//   Fredoka     — chunky rounded DISPLAY face: brand, titles, buttons, HUD.
//   Nunito Sans — highly readable BODY face: descriptions, tooltips, numbers.
// The 'latin' subset Fontsource bundles includes Latin-1 accents, so Portuguese
// (á ã ç ê õ …) renders correctly. See docs/FONTS.md for attribution.
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito-sans/400.css';
import '@fontsource/nunito-sans/600.css';
import '@fontsource/nunito-sans/700.css';
import '@fontsource/nunito-sans/800.css';
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
