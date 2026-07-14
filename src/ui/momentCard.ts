import type { MomentCard } from '../sim/types';

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
}

const RARITY_COLORS: Record<string, string> = {
  common: '#8a8a8a',
  uncommon: '#4f9d69',
  rare: '#4f7dd6',
  legendary: '#d6a83f',
};

export function renderMomentCard(data: MomentCardData): HTMLCanvasElement {
  const w = 640;
  const h = 400;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // background
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#3a2c1f');
  grad.addColorStop(1, '#2a2016');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // rarity frame
  const rarity = RARITY_COLORS[data.card.rarity] ?? '#8a8a8a';
  ctx.strokeStyle = rarity;
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, w - 24, h - 24);

  // illustration placeholder: a stylised acorn
  ctx.save();
  ctx.translate(w / 2, 150);
  ctx.fillStyle = '#7a4a24';
  ctx.beginPath();
  ctx.ellipse(0, -30, 60, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c98a4b';
  ctx.beginPath();
  ctx.moveTo(-58, -24);
  ctx.quadraticCurveTo(0, 90, 58, -24);
  ctx.quadraticCurveTo(0, 24, -58, -24);
  ctx.fill();
  ctx.restore();

  // title
  ctx.fillStyle = '#fff4e0';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(clip(data.title, 34), w / 2, 250);

  // caption
  ctx.fillStyle = '#d8c4a8';
  ctx.font = '18px system-ui, sans-serif';
  wrapText(ctx, data.caption, w / 2, 284, w - 80, 24);

  // footer: company / date / rarity
  ctx.fillStyle = rarity;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(data.rarityLabel, 36, h - 30);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff4e0';
  ctx.fillText(data.companyName, w / 2, h - 30);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#a89577';
  ctx.fillText(data.dateLabel, w - 36, h - 30);

  return canvas;
}

export function momentCardToPng(data: MomentCardData): string {
  return renderMomentCard(data).toDataURL('image/png');
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
