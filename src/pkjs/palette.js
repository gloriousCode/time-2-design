const { GROUP_ORDER } = require("./constants");

function buildPebblePalette() {
  const steps = ["00", "55", "aa", "ff"];
  const grouped = {};

  for (let i = 0; i < GROUP_ORDER.length; i += 1) {
    grouped[GROUP_ORDER[i]] = [];
  }

  for (let r = 0; r < steps.length; r += 1) {
    for (let g = 0; g < steps.length; g += 1) {
      for (let b = 0; b < steps.length; b += 1) {
        const colour = `#${steps[r]}${steps[g]}${steps[b]}`;
        const channels = hexToRgb(colour);

        grouped[classifyColourGroup(channels.r, channels.g, channels.b)].push({
          colour,
          weight: channels.r + channels.g + channels.b
        });
      }
    }
  }

  for (let i = 0; i < GROUP_ORDER.length; i += 1) {
    grouped[GROUP_ORDER[i]].sort(function(a, b) {
      if (a.weight === b.weight) {
        if (a.colour < b.colour) {
          return -1;
        }

        if (a.colour > b.colour) {
          return 1;
        }

        return 0;
      }

      return a.weight - b.weight;
    });
  }

  return grouped;
}

function snapToPebblePalette(hex) {
  const safe = String(hex).replace("#", "");
  const r = Number.parseInt(safe.slice(0, 2), 16);
  const g = Number.parseInt(safe.slice(2, 4), 16);
  const b = Number.parseInt(safe.slice(4, 6), 16);

  return `#${toHex(snapChannel(r))}${toHex(snapChannel(g))}${toHex(snapChannel(b))}`;
}

function snapChannel(value) {
  const steps = [0, 85, 170, 255];
  let closest = steps[0];
  let distance = Math.abs(value - closest);

  for (let i = 1; i < steps.length; i += 1) {
    const currentDistance = Math.abs(value - steps[i]);

    if (currentDistance < distance) {
      distance = currentDistance;
      closest = steps[i];
    }
  }

  return closest;
}

function toHex(value) {
  const text = value.toString(16);
  return text.length === 1 ? `0${text}` : text;
}

function hexToRgb(colour) {
  const safe = String(colour).replace("#", "");

  return {
    r: parseInt(safe.slice(0, 2), 16),
    g: parseInt(safe.slice(2, 4), 16),
    b: parseInt(safe.slice(4, 6), 16)
  };
}

function classifyColourGroup(r, g, b) {
  if (r === g && g === b) {
    return "Neutrals";
  }

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) {
    return "Neutrals";
  }

  let hue;

  if (max === r) {
    hue = 60 * (((g - b) / delta) % 6);
  } else if (max === g) {
    hue = 60 * (((b - r) / delta) + 2);
  } else {
    hue = 60 * (((r - g) / delta) + 4);
  }

  if (hue < 0) {
    hue += 360;
  }

  if (hue < 15 || hue >= 345) {
    return "Reds";
  }

  if (hue < 70) {
    return "Oranges & Yellows";
  }

  if (hue < 155) {
    return "Greens";
  }

  if (hue < 200) {
    return "Cyans";
  }

  if (hue < 255) {
    return "Blues";
  }

  if (hue < 315) {
    return "Purples";
  }

  return "Pinks";
}

module.exports = {
  buildPebblePalette,
  snapToPebblePalette
};
