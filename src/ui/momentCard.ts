import type { MomentCard } from '../sim/types';
import { canvasFont } from './fontStacks';
import { momentFormat } from './momentFormats';

// Renders a shareable Moment Card to a canvas and returns a PNG data URL. The
// card intentionally contains ONLY game content (event art placeholder, caption,
// company name, date, rarity) — never a screenshot of the user's desktop.
export interface MomentCardData {
  card: MomentCard;
  companyName: string;
  title: string;
  caption: string;
  rarityLabel: string;
  employeeName: string | null;
  dateLabel: string;
  /* The document vocabulary, translated by the caller.
     Passed in rather than looked up here because this module draws to a canvas and
     has no access to hooks — and because keeping it a pure data-in/pixels-out
     function is what lets it be exercised without a React tree. */
  formatLabel: string;
  orgLabel: string;
  refLabel: string;
  refCode: string;
  stampLabel: string | null;
}

const RARITY_COLORS: Record<string, string> = {
  common: '#8a8a8a',
  uncommon: '#4f9d69',
  rare: '#4f7dd6',
  legendary: '#d6a83f',
};

/**
 * Draw the moment as the DOCUMENT it is.
 *
 * This used to be one template for every moment in the game: a dark brown
 * gradient, a rarity-coloured frame, and a "stylised acorn" illustration
 * placeholder. Every souvenir a player collected exported as the same picture with
 * different words on it.
 *
 * The format now comes from `momentFormats.ts`, which the collection grid also
 * reads — so the card you download is the same artefact as the card you collected,
 * and neither renderer gets to have its own opinion about what the document is.
 */
export function renderMomentCard(data: MomentCardData): HTMLCanvasElement {
  const w = 640;
  const h = 400;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const spec = momentFormat(data.card);
  const rarity = RARITY_COLORS[data.card.rarity] ?? '#8a8a8a';
  const pad = 34;

  // Paper, with the faint top sheen a flat fill never gets.
  ctx.fillStyle = spec.paper;
  ctx.fillRect(0, 0, w, h);
  const sheen = ctx.createLinearGradient(0, 0, 0, h * 0.4);
  sheen.addColorStop(0, 'rgba(255,255,255,0.5)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h * 0.4);

  // Ruling, for the formats that are ruled. Same structural cue as the CSS card.
  ctx.strokeStyle = withAlpha(spec.accent, 0.14);
  ctx.lineWidth = 1;
  if (spec.ruled === 'lines') {
    for (let y = 132; y < h - 54; y += 28) line(ctx, pad, y, w - pad, y);
  } else if (spec.ruled === 'grid') {
    for (let y = 118; y < h - 54; y += 20) line(ctx, pad, y, w - pad, y);
    for (let x = pad; x < w - pad; x += 20) line(ctx, x, 118, x, h - 54);
  }

  // Rarity binds the spine, exactly as it does in the collection.
  ctx.fillStyle = rarity;
  ctx.fillRect(0, 0, 7, h);

  // Letterhead.
  ctx.textAlign = 'left';
  ctx.fillStyle = spec.accent;
  ctx.font = canvasFont(800, 21, 'body');
  ctx.fillText(spaced(data.formatLabel.toUpperCase()), pad, 62);
  ctx.fillStyle = withAlpha('#3a2a18', 0.55);
  ctx.font = canvasFont(700, 12, 'body');
  ctx.fillText(spaced(data.orgLabel.toUpperCase()), pad, 82);
  ctx.strokeStyle = withAlpha(spec.accent, 0.5);
  ctx.lineWidth = 2;
  line(ctx, pad, 94, w - pad, 94);

  // Reference line.
  ctx.fillStyle = withAlpha('#3a2a18', 0.5);
  ctx.font = canvasFont(800, 12, 'body');
  const refLabel = `${spaced(data.refLabel.toUpperCase())}  `;
  ctx.fillText(refLabel, pad, 118);
  ctx.fillStyle = spec.accent;
  ctx.font = canvasFont(700, 13, 'body');
  ctx.fillText(data.refCode, pad + ctx.measureText(refLabel).width + 4, 118);

  // Title, then the body it is about.
  ctx.fillStyle = '#2f2114';
  ctx.font = canvasFont(700, 30, 'display');
  ctx.fillText(clip(data.title, 30), pad, 168);

  if (data.employeeName) {
    ctx.fillStyle = withAlpha(spec.accent, 0.22);
    const plate = ctx.measureText(data.employeeName).width;
    ctx.fillRect(pad, 182, Math.min(plate + 60, w - pad * 2), 24);
    ctx.fillStyle = '#3a2a18';
    ctx.font = canvasFont(800, 13, 'body');
    ctx.fillText(spaced(data.employeeName.toUpperCase()), pad + 8, 199);
  }

  ctx.fillStyle = withAlpha('#3a2a18', 0.82);
  ctx.font = canvasFont(400, 17, 'body');
  wrapText(ctx, data.caption, pad, data.employeeName ? 238 : 214, w - pad * 2, 24);

  // Rubber stamp, rotated over the document rather than laid out beside it.
  if (data.stampLabel) {
    ctx.save();
    ctx.translate(w - 150, h - 108);
    ctx.rotate((-11 * Math.PI) / 180);
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = spec.accent;
    ctx.fillStyle = spec.accent;
    ctx.lineWidth = 3;
    ctx.font = canvasFont(800, 18, 'body');
    const text = spaced(data.stampLabel.toUpperCase());
    const tw = ctx.measureText(text).width;
    ctx.strokeRect(-10, -24, tw + 20, 34);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // Footer rule, then rarity / company / date.
  ctx.strokeStyle = withAlpha(spec.accent, 0.28);
  ctx.lineWidth = 1;
  line(ctx, pad, h - 52, w - pad, h - 52);
  ctx.font = canvasFont(800, 13, 'body');
  ctx.fillStyle = spec.accent;
  ctx.textAlign = 'left';
  ctx.fillText(spaced(data.rarityLabel.toUpperCase()), pad, h - 28);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#3a2a18';
  ctx.font = canvasFont(700, 15, 'display');
  ctx.fillText(data.companyName, w / 2, h - 28);
  ctx.textAlign = 'right';
  ctx.fillStyle = withAlpha('#3a2a18', 0.6);
  ctx.font = canvasFont(700, 13, 'body');
  ctx.fillText(spaced(data.dateLabel.toUpperCase()), w - pad, h - 28);

  return canvas;
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** Canvas has no letter-spacing, and these labels are all tracked-out small caps. */
function spaced(s: string): string {
  return s.split('').join('\u2009');
}

/** #rrggbb -> rgba(), so one accent can serve as rule, stamp and wash. */
function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function momentCardToPng(data: MomentCardData): string | null {
  try {
    return renderMomentCard(data).toDataURL('image/png');
  } catch {
    return null;
  }
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
      if (yy > y + lineHeight * 2) break;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}
