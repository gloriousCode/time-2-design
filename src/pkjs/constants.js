const STORAGE_KEY = "emery-colour-hands-config";

const FACE_MODES = {
  HANDS: "hands",
  DIGITAL: "digital",
  LARGE_DIGITAL: "largedigital"
};

const defaults = {
  bgColour: "#ffffaa",
  hourColour: "#5555aa",
  minuteColour: "#ff5500",
  hourHandColour: "#000000",
  minuteHandColour: "#000000",
  complicationBgColour: "#ffffaa",
  complicationBorderColour: "#ff5500",
  complicationTextColour: "#5555aa",
  showHands: true,
  showDateComplication: false,
  faceMode: FACE_MODES.HANDS,
  showDateTiles: false
};

const PRESETS_BASE = {
  sunsetPetal: {
    label: "Sunset Petal",
    bgColour: "#ffaa55",
    hourColour: "#ff5555",
    minuteColour: "#aa55aa"
  },
  canyonShell: {
    label: "Canyon Shell",
    bgColour: "#ff5555",
    hourColour: "#aa5500",
    minuteColour: "#ffaaaa"
  },
  coastalDust: {
    label: "Coastal Dust",
    bgColour: "#00aaaa",
    hourColour: "#aaaaff",
    minuteColour: "#aa55aa"
  },
  blushPop: {
    label: "Blush Pop",
    bgColour: "#ffaaaa",
    hourColour: "#ff55aa",
    minuteColour: "#ff0055"
  },
  coralCandy: {
    label: "Coral Candy",
    bgColour: "#ff55aa",
    hourColour: "#ff5555",
    minuteColour: "#ffaaaa"
  },
  mangoCream: {
    label: "Mango Cream",
    bgColour: "#ffaaaa",
    hourColour: "#ffaa00",
    minuteColour: "#ffffaa"
  },
  tealSage: {
    label: "Teal Sage",
    bgColour: "#00aaaa",
    hourColour: "#0055aa",
    minuteColour: "#aaffaa"
  },
  glacierNavy: {
    label: "Glacier Navy",
    bgColour: "#aaffff",
    hourColour: "#55aaff",
    minuteColour: "#0055aa"
  },
  indigoOrchid: {
    label: "Indigo Orchid",
    bgColour: "#5555aa",
    hourColour: "#55aaff",
    minuteColour: "#aa55aa"
  },
  violetFloss: {
    label: "Violet Floss",
    bgColour: "#aa55ff",
    hourColour: "#ff55aa",
    minuteColour: "#ff00aa"
  },
  stonePeach: {
    label: "Stone Peach",
    bgColour: "#aaaaaa",
    hourColour: "#555555",
    minuteColour: "#ffaaaa"
  },
  mistCoralSlate: {
    label: "Mist Coral Slate",
    bgColour: "#aaffff",
    hourColour: "#ffaaaa",
    minuteColour: "#5555aa"
  },
  aquaLemonMint: {
    label: "Aqua Lemon Mint",
    bgColour: "#00aaaa",
    hourColour: "#ffff55",
    minuteColour: "#aaffaa"
  },
  mintAmberSand: {
    label: "Mint Amber Sand",
    bgColour: "#55ffaa",
    hourColour: "#ffaa00",
    minuteColour: "#ffffaa"
  },
  roseApricotShell: {
    label: "Rose Apricot Shell",
    bgColour: "#ff55aa",
    hourColour: "#ff5555",
    minuteColour: "#ffaaaa"
  },
  coralOliveShell: {
    label: "Coral Olive Shell",
    bgColour: "#ff5555",
    hourColour: "#aaaa55",
    minuteColour: "#ffaaaa"
  }
};

const EXTENSION_COLOUR_POOL = [
  "#000000",
  "#ffffff",
  "#0055aa",
  "#00aaaa",
  "#55aaff",
  "#55ffaa",
  "#55ff55",
  "#aaff55",
  "#ffff55",
  "#ffaa00",
  "#ff5555",
  "#ff55aa",
  "#aa55aa",
  "#5555aa",
  "#aaaaaa",
  "#555555",
  "#aa5500",
  "#00aa55",
  "#aa0000",
  "#005555"
];

function hashString(text) {
  let hash = 0;

  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }

  return hash;
}

function parseHexChannel(hex, start) {
  return parseInt(hex.slice(start, start + 2), 16);
}

function hexToRgb(hex) {
  return [
    parseHexChannel(hex, 1),
    parseHexChannel(hex, 3),
    parseHexChannel(hex, 5)
  ];
}

function toLinearChannel(channel) {
  const srgb = channel / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  const rl = toLinearChannel(r);
  const gl = toLinearChannel(g);
  const bl = toLinearChannel(b);
  return (0.2126 * rl) + (0.7152 * gl) + (0.0722 * bl);
}

function contrastRatio(a, b) {
  const aLum = relativeLuminance(a);
  const bLum = relativeLuminance(b);
  const light = Math.max(aLum, bLum);
  const dark = Math.min(aLum, bLum);
  return (light + 0.05) / (dark + 0.05);
}

function minContrastAgainst(colour, others) {
  let min = Number.POSITIVE_INFINITY;

  for (let i = 0; i < others.length; i += 1) {
    min = Math.min(min, contrastRatio(colour, others[i]));
  }

  return min;
}

function pickDistinctColour(used, offset) {
  for (let i = 0; i < EXTENSION_COLOUR_POOL.length; i += 1) {
    const colour = EXTENSION_COLOUR_POOL[(offset + i) % EXTENSION_COLOUR_POOL.length];

    if (!used.has(colour)) {
      used.add(colour);
      return colour;
    }
  }

  return "#000000";
}

function pickDistinctColourByScore(used, scoreFn, fallback) {
  let bestColour = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < EXTENSION_COLOUR_POOL.length; i += 1) {
    const colour = EXTENSION_COLOUR_POOL[i];

    if (used.has(colour)) {
      continue;
    }

    const score = scoreFn(colour);

    if (score > bestScore) {
      bestScore = score;
      bestColour = colour;
    }
  }

  if (!bestColour) {
    return fallback;
  }

  used.add(bestColour);
  return bestColour;
}

function extendPreset(key, preset) {
  const used = new Set([preset.bgColour, preset.hourColour, preset.minuteColour]);
  const seed = hashString(key);
  const baseColours = [preset.bgColour, preset.hourColour, preset.minuteColour];

  const hourHandColour = pickDistinctColour(used, seed % EXTENSION_COLOUR_POOL.length);
  const minuteHandColour = pickDistinctColour(used, (seed + 3) % EXTENSION_COLOUR_POOL.length);
  const complicationBgColour = pickDistinctColourByScore(
    used,
    function(colour) {
      return minContrastAgainst(colour, baseColours);
    },
    "#000000"
  );
  const complicationTextColour = pickDistinctColourByScore(
    used,
    function(colour) {
      return contrastRatio(colour, complicationBgColour);
    },
    "#ffffff"
  );
  const complicationBorderColour = pickDistinctColourByScore(
    used,
    function(colour) {
      const againstBackground = contrastRatio(colour, complicationBgColour);
      const againstFace = minContrastAgainst(colour, baseColours);
      return Math.min(againstBackground, againstFace);
    },
    "#ffffff"
  );

  return {
    label: preset.label,
    bgColour: preset.bgColour,
    hourColour: preset.hourColour,
    minuteColour: preset.minuteColour,
    hourHandColour,
    minuteHandColour,
    complicationBgColour,
    complicationBorderColour,
    complicationTextColour
  };
}

const PRESETS = Object.keys(PRESETS_BASE).reduce(function(acc, key) {
  acc[key] = extendPreset(key, PRESETS_BASE[key]);
  return acc;
}, {});

const GROUP_ORDER = [
  "Neutrals",
  "Reds",
  "Oranges & Yellows",
  "Greens",
  "Cyans",
  "Blues",
  "Purples",
  "Pinks"
];

module.exports = {
  STORAGE_KEY,
  FACE_MODES,
  defaults,
  PRESETS,
  GROUP_ORDER
};
