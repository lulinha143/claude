import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/nunito-sans/latin-400.css';
import '@fontsource/nunito-sans/latin-700.css';
import '@fontsource/baloo-2/latin-400.css';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/dynapuff/latin-400.css';
import '@fontsource/dynapuff/latin-500.css';
import '@fontsource/dynapuff/latin-600.css';
import '@fontsource/dynapuff/latin-700.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/sniglet/latin-400.css';
import '@fontsource/sniglet/latin-800.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import './typography.css';

interface Pairing {
  id: string;
  name: string;
  display: string;
  body: string;
  note: string;
  selected?: boolean;
}

const PAIRINGS: Pairing[] = [
  {
    id: 'current',
    name: 'Current — Fredoka + Nunito Sans',
    display: 'Fredoka',
    body: 'Nunito Sans',
    note: 'Rounded and clear, but reads like a familiar app template.',
  },
  {
    id: 'baloo',
    name: 'Option A — Baloo 2 + Nunito Sans',
    display: 'Baloo 2',
    body: 'Nunito Sans',
    note: 'Friendly and dependable, but still close to mascot-app typography.',
  },
  {
    id: 'dynapuff',
    name: 'Option B — DynaPuff + Nunito',
    display: 'DynaPuff',
    body: 'Nunito',
    note: 'Hand-lettered warmth for tiny office signs, with a calm readable body.',
    selected: true,
  },
  {
    id: 'sniglet',
    name: 'Option C — Sniglet + Atkinson Hyperlegible',
    display: 'Sniglet',
    body: 'Atkinson Hyperlegible',
    note: 'Distinct and accessible, but the display face feels more toy-like.',
  },
];

const copy = {
  en: {
    brand: 'Paws & Acorns Ltd.',
    hero: 'Tiny paws. Serious paperwork.',
    panel: 'Employee Nap Chamber',
    section: 'Today’s very official priorities',
    body: 'Cute animal employees are running a tiny chaotic office, one coffee spill at a time.',
    button: 'Approve Snack Budget',
    small: 'Move To…',
    tooltip: 'Higher morale helps every little teammate work with a happier tail.',
    event: 'The emergency acorn forecast is ready!',
    instruction: 'Drag the floor plant across the miniature office floor.',
  },
  'pt-BR': {
    brand: 'Patas & Castanhas Ltda.',
    hero: 'Patinhas pequenas. Papelada séria.',
    panel: 'Câmara de Soneca dos Funcionários',
    section: 'Prioridades muito oficiais de hoje',
    body: 'Funcionários animais comandam um pequeno escritório caótico, um café derramado de cada vez.',
    button: 'Aprovar Orçamento de Lanches',
    small: 'Mover para…',
    tooltip: 'Mais moral ajuda cada colega a trabalhar com o rabinho mais feliz.',
    event: 'A previsão emergencial de castanhas está pronta!',
    instruction: 'Arraste a planta pelo piso do escritório em miniatura.',
  },
};

function Specimen({
  pairing,
  language,
  scale,
}: {
  pairing: Pairing;
  language: keyof typeof copy;
  scale: number;
}) {
  const text = copy[language];
  const style = {
    '--sample-display': `'${pairing.display}', system-ui, sans-serif`,
    '--sample-body': `'${pairing.body}', system-ui, sans-serif`,
    '--sample-scale': String(scale),
  } as React.CSSProperties;
  return (
    <article
      className={`type-sample ${pairing.selected ? 'is-selected' : ''}`}
      style={style}
      data-pairing={pairing.id}
    >
      <header className="type-sample__head">
        <div>
          <span className="type-sample__status">{pairing.selected ? 'Selected' : 'Compared'}</span>
          <h2>{pairing.name}</h2>
        </div>
        <span className="type-sample__paw" aria-hidden>
          ● ● ●
        </span>
      </header>
      <p className="type-sample__note">{pairing.note}</p>
      <section className="mini-app">
        <div className="mini-app__brand">{text.brand}</div>
        <div className="mini-app__hero">{text.hero}</div>
        <nav aria-label="Sample navigation">
          <button>⌂ {language === 'pt-BR' ? 'Escritório' : 'Office'}</button>
          <button>▤ {language === 'pt-BR' ? 'Melhorias' : 'Upgrades'}</button>
          <button>♧ {language === 'pt-BR' ? 'Equipe' : 'Team'}</button>
        </nav>
        <div className="mini-app__paper">
          <div className="mini-app__panel-title">{text.panel}</div>
          <div className="mini-app__section">{text.section}</div>
          <p>{text.body}</p>
          <div className="mini-app__actions">
            <button>{text.button}</button>
            <button className="small">{text.small}</button>
          </div>
          <div className="mini-app__stats">
            <strong>125.430</strong>
            <span>+12,5%</span>
            <span>Nv. 42</span>
          </div>
          <div className="mini-app__event">“{text.event}”</div>
          <div className="mini-app__tooltip">{text.tooltip}</div>
          <div className="mini-app__instruction">{text.instruction}</div>
        </div>
      </section>
      <div className="type-sample__glyphs">
        AÇÃO · coração · café · avô · órgão · bênção · maçã · você · Il1 O0 rn m
      </div>
    </article>
  );
}

function TypographyLab() {
  const [language, setLanguage] = useState<keyof typeof copy>('pt-BR');
  const [scale, setScale] = useState(1);
  const [compact, setCompact] = useState(false);
  return (
    <main className={compact ? 'lab is-compact' : 'lab'}>
      <header className="lab__header">
        <div>
          <span className="lab__eyebrow">Internal visual decision sheet</span>
          <h1>ZooWorkers Typography Lab</h1>
          <p>
            Real menu, dialogue, number, tooltip, and Portuguese-accent roles—not an alphabet-only
            beauty sample.
          </p>
        </div>
        <div className="lab__controls" aria-label="Typography preview controls">
          <label>
            Language
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as keyof typeof copy)}
            >
              <option value="pt-BR">Português</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            Scale
            <select value={scale} onChange={(event) => setScale(Number(event.target.value))}>
              <option value="1">100%</option>
              <option value="1.25">125%</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={compact}
              onChange={(event) => setCompact(event.target.checked)}
            />{' '}
            Compact 320px
          </label>
        </div>
      </header>
      <section className="lab__grid">
        {PAIRINGS.map((pairing) => (
          <Specimen key={pairing.id} pairing={pairing} language={language} scale={scale} />
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TypographyLab />
  </StrictMode>,
);
