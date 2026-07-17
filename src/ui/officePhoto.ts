// Composes a shareable "office postcard" PNG entirely on a canvas — no DOM/SVG
// screenshotting, so it works identically in the browser and the packaged
// Electron app and can never crash on a missing 2D context. The image contains
// only game content (company name, cozy office illustration, current stats,
// date) — never a capture of the user's desktop.

import { canvasFont } from './fontStacks';

export interface OfficePhotoData {
  companyName: string;
  tagline: string;
  dateLabel: string;
  stats: { label: string; value: string }[];
  critterColors: string[];
  brand: string;
}

export function renderOfficePhoto(data: OfficePhotoData): HTMLCanvasElement {
  const w = 900;
  const h = 600;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // warm background
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#4a3826');
  bg.addColorStop(1, '#2a2016');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // gold frame
  roundRect(ctx, 16, 16, w - 32, h - 32, 22);
  ctx.strokeStyle = '#ffd54a';
  ctx.lineWidth = 5;
  ctx.stroke();

  // title
  ctx.fillStyle = '#fff4e0';
  ctx.textAlign = 'center';
  ctx.font = canvasFont(700, 42, 'display');
  ctx.fillText(clip(data.companyName, 26), w / 2, 78);
  ctx.fillStyle = '#d8c4a8';
  ctx.font = canvasFont(600, 20, 'body');
  ctx.fillText(clip(data.tagline, 46), w / 2, 108);

  // cozy office illustration: a rounded tree trunk with lit windows + critters
  drawOffice(ctx, w / 2, 150, 360, 300, data.critterColors);

  // stats row
  const chipY = 500;
  const chipW = 195;
  const gap = 16;
  const totalW = data.stats.length * chipW + (data.stats.length - 1) * gap;
  let x = w / 2 - totalW / 2;
  for (const s of data.stats) {
    roundRect(ctx, x, chipY, chipW, 54, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fill();
    ctx.fillStyle = '#a89577';
    ctx.textAlign = 'center';
    ctx.font = canvasFont(700, 15, 'body');
    ctx.fillText(s.label, x + chipW / 2, chipY + 21);
    ctx.fillStyle = '#fff4e0';
    ctx.font = canvasFont(700, 22, 'numeric');
    ctx.fillText(clip(s.value, 12), x + chipW / 2, chipY + 45);
    x += chipW + gap;
  }

  // footer
  ctx.fillStyle = '#ffd54a';
  ctx.textAlign = 'left';
  ctx.font = canvasFont(700, 18, 'display');
  ctx.fillText(data.brand, 40, h - 34);
  ctx.fillStyle = '#a89577';
  ctx.textAlign = 'right';
  ctx.font = canvasFont(600, 16, 'body');
  ctx.fillText(data.dateLabel, w - 40, h - 34);

  return canvas;
}

export function officePhotoToPng(data: OfficePhotoData): string | null {
  try {
    return renderOfficePhoto(data).toDataURL('image/png');
  } catch {
    return null;
  }
}

function drawOffice(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  width: number,
  height: number,
  critters: string[],
): void {
  const left = cx - width / 2;
  // trunk
  ctx.save();
  roundRect(ctx, left, top, width, height, 26);
  const bark = ctx.createLinearGradient(left, 0, left + width, 0);
  bark.addColorStop(0, '#3a2c1f');
  bark.addColorStop(0.5, '#4a3826');
  bark.addColorStop(1, '#33261a');
  ctx.fillStyle = bark;
  ctx.fill();
  ctx.strokeStyle = '#241a12';
  ctx.lineWidth = 3;
  ctx.stroke();

  // three floors with lit windows
  const floors = 3;
  const pad = 24;
  const fh = (height - pad * 2) / floors;
  for (let i = 0; i < floors; i += 1) {
    const fy = top + pad + i * fh;
    roundRect(ctx, left + pad, fy + 6, width - pad * 2, fh - 12, 12);
    ctx.fillStyle = 'rgba(255,244,224,0.06)';
    ctx.fill();
    // warm window glow
    roundRect(ctx, left + width - pad - 70, fy + 16, 46, fh - 34, 8);
    ctx.fillStyle = 'rgba(224,164,59,0.45)';
    ctx.fill();

    // critters standing on this floor (cluster toward the centre)
    const onFloor = critters.slice(i * 3, i * 3 + 3);
    const baseY = fy + fh - 20;
    onFloor.forEach((color, j) => {
      const gx = left + width / 2 + (j - (onFloor.length - 1) / 2) * 46;
      drawCritter(ctx, gx, baseY, color);
    });
  }
  ctx.restore();
}

function drawCritter(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.save();
  // body
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y - 12, 13, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // ears
  ctx.beginPath();
  ctx.ellipse(x - 8, y - 26, 4, 6, -0.3, 0, Math.PI * 2);
  ctx.ellipse(x + 8, y - 26, 4, 6, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // tummy
  ctx.fillStyle = 'rgba(255,244,224,0.55)';
  ctx.beginPath();
  ctx.ellipse(x, y - 8, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // eyes
  ctx.fillStyle = '#241a12';
  ctx.beginPath();
  ctx.arc(x - 4, y - 16, 1.6, 0, Math.PI * 2);
  ctx.arc(x + 4, y - 16, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
