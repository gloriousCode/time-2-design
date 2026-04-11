const fs = require('fs');
const path = require('path');

const W = 200;
const H = 228;
const CX = W / 2;
const CY = H / 2;
const R = Math.sqrt(W * W + H * H);

const colours = {
  bg: '#efe8d3',
  hour: '#9a8a78',
  minute: '#c45d32',
  white: '#f6f6f4',
  dark: '#6f5732',
  bezel: '#000000'
};

function rad(deg) {
  return (deg * Math.PI) / 180;
}

function norm(a) {
  const two = Math.PI * 2;
  return ((a % two) + two) % two;
}

function angleFor(hour, minute, kind) {
  if (kind === 'hour') {
    const h = hour % 12;
    return ((h + minute / 60) / 12) * Math.PI * 2;
  }
  return (minute / 60) * Math.PI * 2;
}

function point(angle, radius = R) {
  return {
    x: CX + Math.sin(angle) * radius,
    y: CY - Math.cos(angle) * radius
  };
}

function sectorPath(start, end) {
  const step = Math.PI / 48;
  const pts = [{ x: CX, y: CY }];

  for (let a = start; a <= end; a += step) {
    pts.push(point(a));
  }

  pts.push(point(end));
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

function hand(x1, y1, x2, y2, stroke, colour, cap = 'round') {
  return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${colour}" stroke-width="${stroke}" stroke-linecap="${cap}" />`;
}

function drawTiles(day, date) {
  const tileW = 16;
  const tileH = 16;
  const gap = 2;
  const topY = 170;
  const bottomY = topY + tileH + 3;

  const topStart = Math.floor((W - ((tileW * 2) + gap)) / 2);
  const botStart = Math.floor((W - ((tileW * 3) + (gap * 2))) / 2);

  const d = String(date).padStart(2, '0');
  const boxes = [];

  function tile(x, y, txt, size) {
    boxes.push(`<rect x="${x}" y="${y}" width="${tileW}" height="${tileH}" rx="2" fill="${colours.white}" />`);
    boxes.push(`<text x="${x + (tileW / 2)}" y="${y + Math.floor(tileH * 0.73)}" text-anchor="middle" font-family="Gothic-Bold, Arial Black, sans-serif" font-size="${size}" fill="${colours.minute}">${txt}</text>`);
  }

  tile(topStart, topY, d[0], 10);
  tile(topStart + tileW + gap, topY, d[1], 10);

  tile(botStart, bottomY, day[0], 8);
  tile(botStart + tileW + gap, bottomY, day[1], 8);
  tile(botStart + ((tileW + gap) * 2), bottomY, day[2], 8);

  return boxes.join('\n');
}

function guideLine(angle, colour) {
  const inner = point(angle, 52);
  const outer = point(angle, 76);
  return [
    hand(inner.x, inner.y, outer.x, outer.y, 4, colours.white),
    hand(inner.x, inner.y, outer.x, outer.y, 2, colour)
  ].join('\n');
}

function renderFace({ hour, minute, day, date, name, mode }) {
  let hA = angleFor(hour, minute, 'hour');
  let mA = angleFor(hour, minute, 'minute');

  if (Math.abs(hA - mA) < 0.0001) {
    mA = norm(mA + rad(8));
  }

  const split = norm(((hA + mA) / 2) + Math.PI);
  const rays = [
    { a: hA, c: colours.hour },
    { a: mA, c: colours.minute },
    { a: split, c: colours.bg }
  ].sort((a, b) => a.a - b.a);

  const sectors = [];

  for (let i = 0; i < rays.length; i += 1) {
    const cur = rays[i];
    const nxt = rays[(i + 1) % rays.length];
    const end = i === rays.length - 1 ? nxt.a + Math.PI * 2 : nxt.a;
    sectors.push(`<polygon points="${sectorPath(cur.a, end)}" fill="${cur.c}" />`);
  }

  let hands = '';
  if (mode === 'hands') {
    const hPt = point(hA, 42);
    const mPt = point(mA, 64);

    hands = [
      hand(CX, CY, hPt.x, hPt.y, 7, colours.white),
      hand(CX, CY, hPt.x, hPt.y, 4, colours.dark),
      hand(CX, CY, mPt.x, mPt.y, 6, colours.white),
      hand(CX, CY, mPt.x, mPt.y, 3, colours.dark),
      `<circle cx="${CX}" cy="${CY}" r="7" fill="${colours.white}" />`,
      `<circle cx="${CX}" cy="${CY}" r="4" fill="${colours.dark}" />`
    ].join('\n');
  }

  let guides = '';
  if (mode === 'colour') {
    guides = [
      hand(CX, CY, point(hA, 38).x, point(hA, 38).y, 4, '#3a2e1f'),
      hand(CX, CY, point(mA, 56).x, point(mA, 56).y, 5, '#3a2e1f'),
      `<circle cx="${CX}" cy="${CY}" r="4" fill="#3a2e1f" />`
    ].join('\n');
  }

  let digital = '';
  if (mode === 'digital') {
    const t = String(hour).padStart(2, '0') + String(minute).padStart(2, '0');
    const y = 96;
    const w = 24;
    const h = 38;
    const gap = 3;
    const x0 = Math.floor((W - ((w * 4) + (gap * 3))) / 2);

    digital = `
      <rect x="${x0}" y="${y}" width="${w}" height="${h}" rx="4" fill="${colours.white}" />
      <rect x="${x0 + w + gap}" y="${y}" width="${w}" height="${h}" rx="4" fill="${colours.white}" />
      <rect x="${x0 + (w + gap) * 2}" y="${y}" width="${w}" height="${h}" rx="4" fill="${colours.white}" />
      <rect x="${x0 + (w + gap) * 3}" y="${y}" width="${w}" height="${h}" rx="4" fill="${colours.white}" />
      <text x="${x0 + (w / 2)}" y="${y + 30}" text-anchor="middle" font-family="Bitham-Black, Arial Black, sans-serif" font-size="31" fill="${colours.hour}">${t[0]}</text>
      <text x="${x0 + w + gap + (w / 2)}" y="${y + 30}" text-anchor="middle" font-family="Bitham-Black, Arial Black, sans-serif" font-size="31" fill="${colours.hour}">${t[1]}</text>
      <text x="${x0 + ((w + gap) * 2) + (w / 2)}" y="${y + 30}" text-anchor="middle" font-family="Bitham-Black, Arial Black, sans-serif" font-size="31" fill="${colours.minute}">${t[2]}</text>
      <text x="${x0 + ((w + gap) * 3) + (w / 2)}" y="${y + 30}" text-anchor="middle" font-family="Bitham-Black, Arial Black, sans-serif" font-size="31" fill="${colours.minute}">${t[3]}</text>
    `;
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${W}" height="${H}" rx="20" fill="${colours.bezel}" />
  <clipPath id="screenClip">
    <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="16" />
  </clipPath>
  <g clip-path="url(#screenClip)">
    ${sectors.join('\n')}
    ${hands}
    ${guides}
    ${digital}
    ${drawTiles(day, date)}
  </g>
</svg>`;

  fs.writeFileSync(path.join(__dirname, name), svg, 'utf8');
}

renderFace({ hour: 12, minute: 0, day: 'MON', date: 8, name: 'emery_12-00_hands.svg', mode: 'hands' });
renderFace({ hour: 10, minute: 10, day: 'MON', date: 8, name: 'emery_10-10_hands.svg', mode: 'hands' });
renderFace({ hour: 10, minute: 10, day: 'MON', date: 8, name: 'emery_10-10_colour.svg', mode: 'colour' });
renderFace({ hour: 10, minute: 10, day: 'MON', date: 8, name: 'emery_10-10_digital.svg', mode: 'digital' });
