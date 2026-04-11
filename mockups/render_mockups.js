const fs = require('fs');
const path = require('path');

const W = 700;
const H = 900;
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
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colour}" stroke-width="${stroke}" stroke-linecap="${cap}" />`;
}

function drawTiles(day, date) {
  const tileW = 52;
  const tileH = 52;
  const gap = 8;
  const topY = 690;
  const bottomY = topY + tileH + 10;

  const topStart = (W - (tileW * 2 + gap)) / 2;
  const botStart = (W - (tileW * 3 + gap * 2)) / 2;

  const d = String(date).padStart(2, '0');
  const d0 = d[0];
  const d1 = d[1];

  const boxes = [];

  function tile(x, y, txt) {
    boxes.push(`<rect x="${x}" y="${y}" width="${tileW}" height="${tileH}" rx="6" fill="${colours.white}" />`);
    boxes.push(`<text x="${x + tileW / 2}" y="${y + tileH / 2 + 16}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="44" fill="${colours.minute}">${txt}</text>`);
  }

  tile(topStart, topY, d0);
  tile(topStart + tileW + gap, topY, d1);

  tile(botStart, bottomY, day[0]);
  tile(botStart + tileW + gap, bottomY, day[1]);
  tile(botStart + (tileW + gap) * 2, bottomY, day[2]);

  return boxes.join('\n');
}

function renderFace({ hour, minute, name, showHands = true }) {
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
  if (showHands) {
    const hLen = 190;
    const mLen = 280;
    const hPt = point(hA, hLen);
    const mPt = point(mA, mLen);

    hands = [
      hand(CX, CY, hPt.x, hPt.y, 24, colours.white),
      hand(CX, CY, hPt.x, hPt.y, 14, colours.dark),
      hand(CX, CY, mPt.x, mPt.y, 22, colours.white),
      hand(CX, CY, mPt.x, mPt.y, 12, colours.dark),
      `<circle cx="${CX}" cy="${CY}" r="24" fill="${colours.white}" />`,
      `<circle cx="${CX}" cy="${CY}" r="14" fill="${colours.dark}" />`
    ].join('\n');
  }

  const guides = !showHands
    ? [
      guideLine(hA, colours.hour),
      guideLine(mA, colours.minute)
    ].join('\n')
    : '';

  const digital = !showHands
    ? `<g>
        <rect x="152" y="382" width="96" height="140" rx="12" fill="${colours.white}" />
        <rect x="258" y="382" width="96" height="140" rx="12" fill="${colours.white}" />
        <rect x="364" y="382" width="96" height="140" rx="12" fill="${colours.white}" />
        <rect x="470" y="382" width="96" height="140" rx="12" fill="${colours.white}" />
        <text x="200" y="485" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="108" fill="${colours.hour}">${String(hour).padStart(2, '0')[0]}</text>
        <text x="306" y="485" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="108" fill="${colours.hour}">${String(hour).padStart(2, '0')[1]}</text>
        <text x="412" y="485" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="108" fill="${colours.minute}">${String(minute).padStart(2, '0')[0]}</text>
        <text x="518" y="485" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="108" fill="${colours.minute}">${String(minute).padStart(2, '0')[1]}</text>
      </g>`
    : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${W}" height="${H}" rx="88" fill="${colours.bezel}" />
  <clipPath id="screenClip">
    <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="72" />
  </clipPath>
  <g clip-path="url(#screenClip)">
    ${sectors.join('\n')}
    ${hands}
    ${guides}
    ${digital}
    ${drawTiles('MON', 8)}
  </g>
</svg>`;

  fs.writeFileSync(path.join(__dirname, name), svg, 'utf8');
}

function guideLine(angle, colour) {
  const inner = point(angle, 235);
  const outer = point(angle, 335);
  return [
    `<line x1="${inner.x.toFixed(2)}" y1="${inner.y.toFixed(2)}" x2="${outer.x.toFixed(2)}" y2="${outer.y.toFixed(2)}" stroke="${colours.white}" stroke-width="12" stroke-linecap="round" />`,
    `<line x1="${inner.x.toFixed(2)}" y1="${inner.y.toFixed(2)}" x2="${outer.x.toFixed(2)}" y2="${outer.y.toFixed(2)}" stroke="${colour}" stroke-width="5" stroke-linecap="round" />`
  ].join('\n');
}

renderFace({ hour: 12, minute: 0, name: 'concept_12-00_hands.svg', showHands: true });
renderFace({ hour: 10, minute: 10, name: 'concept_10-10_hands.svg', showHands: true });
renderFace({ hour: 10, minute: 10, name: 'concept_10-10_digital.svg', showHands: false });
