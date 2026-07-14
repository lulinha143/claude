import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
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
