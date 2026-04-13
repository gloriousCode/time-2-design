const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { PRESETS } = require("../src/pkjs/constants");

const W = 200;
const H = 228;
const CX = W / 2;
const CY = H / 2;
const R = Math.sqrt(W * W + H * H);

const DAY = "SUN";
const DATE = 12;
const HOUR = 10;
const MINUTE = 9;

const VARIANTS = [
  { key: "analogue", label: "Analogue", mode: "hands", showHands: true, showDateComplication: false, showDateTiles: false },
  { key: "analogue_comp_3", label: "Analogue + 3 Comp", mode: "hands", showHands: true, showDateComplication: true, showDateTiles: false },
  { key: "analogue_comp_6", label: "Analogue + 6 Comp", mode: "hands", showHands: true, showDateComplication: false, showDateTiles: true },
  { key: "digital_small", label: "Digital Small", mode: "digital", showHands: false, showDateComplication: false, showDateTiles: false },
  { key: "digital_small_comp_3", label: "Digital Small + 3 Comp", mode: "digital", showHands: false, showDateComplication: true, showDateTiles: false },
  { key: "digital_small_comp_6", label: "Digital Small + 6 Comp", mode: "digital", showHands: false, showDateComplication: false, showDateTiles: true },
  { key: "digital_large", label: "Digital Large", mode: "largedigital", showHands: false, showDateComplication: false, showDateTiles: false }
];

function rad(deg) {
  return (deg * Math.PI) / 180;
}

function norm(a) {
  const two = Math.PI * 2;
  return ((a % two) + two) % two;
}

function angleFor(hour, minute, kind) {
  if (kind === "hour") {
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
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

function hand(x1, y1, x2, y2, stroke, colour, cap = "round") {
  return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${colour}" stroke-width="${stroke}" stroke-linecap="${cap}" />`;
}

function drawDayDateTiles(preset) {
  const tileW = 16;
  const tileH = 16;
  const gap = 2;
  const topY = 170;
  const bottomY = topY + tileH + 3;

  const topStart = Math.floor((W - ((tileW * 2) + gap)) / 2);
  const botStart = Math.floor((W - ((tileW * 3) + (gap * 2))) / 2);

  const d = String(DATE).padStart(2, "0");
  const boxes = [];

  function tile(x, y, txt, size) {
    boxes.push(`<rect x="${x}" y="${y}" width="${tileW}" height="${tileH}" rx="2" fill="${preset.complicationBorderColour}" />`);
    boxes.push(`<rect x="${x + 1}" y="${y + 1}" width="${tileW - 2}" height="${tileH - 2}" rx="2" fill="${preset.complicationBgColour}" />`);
    boxes.push(`<text x="${x + (tileW / 2)}" y="${y + Math.floor(tileH * 0.73)}" text-anchor="middle" font-family="Gothic-Bold, Arial Black, sans-serif" font-size="${size}" fill="${preset.complicationTextColour}">${txt}</text>`);
  }

  tile(topStart, topY, d[0], 10);
  tile(topStart + tileW + gap, topY, d[1], 10);

  tile(botStart, bottomY, DAY[0], 8);
  tile(botStart + tileW + gap, bottomY, DAY[1], 8);
  tile(botStart + ((tileW + gap) * 2), bottomY, DAY[2], 8);

  return boxes.join("\n");
}

function drawDateComplication3(preset) {
  const side = Math.floor(Math.min(W, H) * 0.17);
  const compCentreX = CX + Math.floor(Math.min(W, H) * 0.28);
  const x = Math.max(2, Math.min(W - side - 2, compCentreX - Math.floor(side / 2)));
  const y = Math.max(2, Math.min(H - side - 2, CY - Math.floor(side / 2)));
  const radius = Math.floor(side / 4);

  const textBoxY = y + 2;
  const textBoxH = side - 4;

  return [
    `<rect x="${x}" y="${y}" width="${side}" height="${side}" rx="${radius}" fill="${preset.complicationBgColour}" />`,
    `<rect x="${x}" y="${y}" width="${side}" height="${side}" rx="${radius}" fill="none" stroke="${preset.complicationBorderColour}" stroke-width="2" />`,
    `<text x="${x + Math.floor(side / 2)}" y="${textBoxY + Math.floor(textBoxH / 2) + 6}" text-anchor="middle" font-family="Gothic-Bold, Arial Black, sans-serif" font-size="18" fill="${preset.complicationTextColour}">${String(DATE).padStart(2, "0")}</text>`
  ].join("\n");
}

function renderPresetVariant(presetKey, preset, variant, outDir) {
  let hA = angleFor(HOUR, MINUTE, "hour");
  let mA = angleFor(HOUR, MINUTE, "minute");

  if (Math.abs(hA - mA) < 0.0001) {
    mA = norm(mA + rad(8));
  }

  const split = norm(((hA + mA) / 2) + Math.PI);
  const rays = [
    { a: hA, c: preset.hourColour },
    { a: mA, c: preset.minuteColour },
    { a: split, c: preset.bgColour }
  ].sort((a, b) => a.a - b.a);

  const sectors = [];
  for (let i = 0; i < rays.length; i += 1) {
    const cur = rays[i];
    const nxt = rays[(i + 1) % rays.length];
    const end = i === rays.length - 1 ? nxt.a + Math.PI * 2 : nxt.a;
    sectors.push(`<polygon points="${sectorPath(cur.a, end)}" fill="${cur.c}" />`);
  }

  let hands = "";
  if (variant.mode === "hands" && variant.showHands) {
    const hPt = point(hA, 42);
    const mPt = point(mA, 64);

    hands = [
      hand(CX, CY, hPt.x, hPt.y, 8, "#000000"),
      hand(CX, CY, mPt.x, mPt.y, 8, "#000000"),
      hand(CX, CY, hPt.x, hPt.y, 4, preset.hourHandColour),
      hand(CX, CY, mPt.x, mPt.y, 3, preset.minuteHandColour),
      `<circle cx="${CX}" cy="${CY}" r="6" fill="#000000" />`,
      `<circle cx="${CX}" cy="${CY}" r="4" fill="${preset.minuteHandColour}" />`
    ].join("\n");
  }

  let digitalSmall = "";
  if (variant.mode === "digital") {
    const t = String(HOUR).padStart(2, "0") + String(MINUTE).padStart(2, "0");
    const y = 96;
    const w = 24;
    const h = 38;
    const gap = 3;
    const x0 = Math.floor((W - ((w * 4) + (gap * 3))) / 2);

    digitalSmall = `
      <rect x="${x0}" y="${y}" width="${w}" height="${h}" rx="4" fill="#ffffff" />
      <rect x="${x0 + w + gap}" y="${y}" width="${w}" height="${h}" rx="4" fill="#ffffff" />
      <rect x="${x0 + (w + gap) * 2}" y="${y}" width="${w}" height="${h}" rx="4" fill="#ffffff" />
      <rect x="${x0 + (w + gap) * 3}" y="${y}" width="${w}" height="${h}" rx="4" fill="#ffffff" />
      <text x="${x0 + (w / 2)}" y="${y + 30}" text-anchor="middle" font-family="Bitham-Black, Arial Black, sans-serif" font-size="31" fill="${preset.hourColour}">${t[0]}</text>
      <text x="${x0 + w + gap + (w / 2)}" y="${y + 30}" text-anchor="middle" font-family="Bitham-Black, Arial Black, sans-serif" font-size="31" fill="${preset.hourColour}">${t[1]}</text>
      <text x="${x0 + ((w + gap) * 2) + (w / 2)}" y="${y + 30}" text-anchor="middle" font-family="Bitham-Black, Arial Black, sans-serif" font-size="31" fill="${preset.minuteColour}">${t[2]}</text>
      <text x="${x0 + ((w + gap) * 3) + (w / 2)}" y="${y + 30}" text-anchor="middle" font-family="Bitham-Black, Arial Black, sans-serif" font-size="31" fill="${preset.minuteColour}">${t[3]}</text>
    `;
  }

  let digitalLarge = "";
  if (variant.mode === "largedigital") {
    const hh = String(HOUR).padStart(2, "0");
    const mm = String(MINUTE).padStart(2, "0");

    digitalLarge = `
      <text x="${Math.floor(W / 2)}" y="84" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="62" fill="${preset.hourColour}">${hh}</text>
      <text x="${Math.floor(W / 2)}" y="168" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="62" fill="${preset.minuteColour}">${mm}</text>
    `;
  }

  const comp3 = variant.showDateComplication ? drawDateComplication3(preset) : "";
  const comp6 = variant.showDateTiles ? drawDayDateTiles(preset) : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${W}" height="${H}" rx="20" fill="#000000" />
  <clipPath id="screenClip">
    <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="16" />
  </clipPath>
  <g clip-path="url(#screenClip)">
    ${sectors.join("\n")}
    ${digitalSmall}
    ${digitalLarge}
    ${comp6}
    ${comp3}
    ${hands}
  </g>
</svg>`;

  const fileName = `${presetKey}__${variant.key}.svg`;
  const svgPath = path.join(outDir, fileName);
  const pngPath = path.join(outDir, `${presetKey}__${variant.key}.png`);

  fs.writeFileSync(svgPath, svg, "utf8");
  execFileSync("rsvg-convert", ["-w", String(W), "-h", String(H), svgPath, "-o", pngPath], { stdio: "ignore" });
}

function renderIndex(outDir) {
  const cards = [];

  Object.keys(PRESETS).forEach((presetKey) => {
    const preset = PRESETS[presetKey];

    VARIANTS.forEach((variant) => {
      const fileName = `${presetKey}__${variant.key}.png`;
      cards.push(`
        <figure>
          <img src="./${fileName}" alt="${preset.label} ${variant.label}" />
          <figcaption><strong>${preset.label}</strong><br />${variant.label}</figcaption>
        </figure>
      `);
    });
  });

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Preset Matrix (Emery)</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 16px; background: #f1f1f1; color: #222; }
      h1 { margin-top: 0; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
      figure { margin: 0; padding: 8px; background: white; border: 1px solid #ddd; border-radius: 8px; }
      img { display: block; width: 100%; height: auto; background: #ddd; border-radius: 6px; }
      figcaption { font-size: 12px; margin-top: 6px; line-height: 1.4; }
    </style>
  </head>
  <body>
    <h1>TrioWay Preset Matrix (Emery)</h1>
    <p>Generated at ${new Date().toISOString()} for ${Object.keys(PRESETS).length} presets × ${VARIANTS.length} permutations.</p>
    <div class="grid">
      ${cards.join("\n")}
    </div>
  </body>
</html>`;

  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
}

function main() {
  const outDir = path.join(__dirname, "preset_matrix_emery");
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  Object.keys(PRESETS).forEach((presetKey) => {
    const preset = PRESETS[presetKey];

    VARIANTS.forEach((variant) => {
      renderPresetVariant(presetKey, preset, variant, outDir);
    });
  });

  renderIndex(outDir);

  console.log(`Generated preset matrix in: ${outDir}`);
  console.log(`Files: ${Object.keys(PRESETS).length * VARIANTS.length} SVGs + ${Object.keys(PRESETS).length * VARIANTS.length} PNGs + index.html`);
}

main();
