// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CANVAS_FONT_STACKS, canvasFont } from '../src/ui/fontStacks';
import { renderMomentCard } from '../src/ui/momentCard';
import { renderOfficePhoto } from '../src/ui/officePhoto';

interface DrawnText {
  text: string;
  font: string;
}

function installCanvasContext(): DrawnText[] {
  const drawn: DrawnText[] = [];
  const gradient = { addColorStop: vi.fn() };
  const context = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'start',
    createLinearGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    quadraticCurveTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    // Drawing ops the moment-card renderer uses now that a card is a ruled,
    // stamped document rather than a gradient with an acorn on it. This fake only
    // exists to record fillText calls for the font assertions, so these just need
    // to be callable — but they DO need to exist, or the renderer throws before it
    // reaches the text.
    lineTo: vi.fn(),
    rotate: vi.fn(),
    setTransform: vi.fn(),
    clip: vi.fn(),
    globalAlpha: 1,
    measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
    fillText: vi.fn(function (this: { font: string }, text: string) {
      drawn.push({ text, font: this.font });
    }),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  return drawn;
}

afterEach(() => vi.restoreAllMocks());

describe('typography canvas parity', () => {
  it('keeps the shared canvas stacks on the selected local families', () => {
    expect(CANVAS_FONT_STACKS.display).toContain("'DynaPuff'");
    expect(CANVAS_FONT_STACKS.body).toContain("'Nunito'");
    expect(CANVAS_FONT_STACKS.numeric).toContain("'Nunito'");
    expect(Object.values(CANVAS_FONT_STACKS).join(' ')).not.toMatch(/Fredoka|Nunito Sans/);
    expect(canvasFont(700, 24, 'display')).toMatch(/^700 24px 'DynaPuff'/);
  });

  it('uses display, body, and numeric roles in office-photo exports', () => {
    const drawn = installCanvasContext();
    renderOfficePhoto({
      companyName: 'Patas & Castanhas Ltda.',
      tagline: 'Patinhas pequenas. Papelada séria.',
      dateLabel: '17 de julho',
      stats: [{ label: 'Produção', value: '125.430' }],
      critterColors: [],
      brand: 'ZooWorkers',
    });

    expect(drawn.find(({ text }) => text === 'Patas & Castanhas Ltda.')?.font).toContain(
      "'DynaPuff'",
    );
    expect(drawn.find(({ text }) => text === 'Patinhas pequenas. Papelada séria.')?.font).toContain(
      "'Nunito'",
    );
    expect(drawn.find(({ text }) => text === '125.430')?.font).toContain("'Nunito'");
  });

  it('uses display and body roles in moment-card exports', () => {
    const drawn = installCanvasContext();
    renderMomentCard({
      card: {
        id: 'typography-test',
        eventId: 'typography-test-event',
        employeeId: null,
        caption: 'Café, coração e ação no escritório.',
        rarity: 'rare',
        createdAt: 0,
      },
      companyName: 'Patas & Castanhas Ltda.',
      title: 'A previsão está pronta!',
      caption: 'Café, coração e ação no escritório.',
      rarityLabel: 'Raro',
      employeeName: null,
      dateLabel: '17 de julho',
      // The document vocabulary, added when moment cards stopped being one template
      // and became a family of authored formats (ui/momentFormats.ts). Supplied by
      // the caller so the canvas renderer stays free of i18n.
      formatLabel: 'Relatório de Incidente',
      orgLabel: 'Nutshell Inc. — Pesquisa Comportamental',
      refLabel: 'Nº',
      refCode: 'NI-1A2B/07',
      stampLabel: 'Arquivado',
    });

    expect(drawn.find(({ text }) => text === 'A previsão está pronta!')?.font).toContain(
      "'DynaPuff'",
    );
    expect(
      drawn.find(({ text }) => text === 'Café, coração e ação no escritório.')?.font,
    ).toContain("'Nunito'");
    expect(drawn.find(({ text }) => text === 'Patas & Castanhas Ltda.')?.font).toContain(
      "'DynaPuff'",
    );
  });
});
