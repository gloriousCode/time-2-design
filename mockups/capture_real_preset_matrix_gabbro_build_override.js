const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { PRESETS } = require("../src/pkjs/constants");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(__dirname, "preset_matrix_gabbro_real");
const DEBUG_FILE = path.join(PROJECT_ROOT, "src", "c", "mdbl_debug.c");
const PBW_PATH = path.join(PROJECT_ROOT, "build", "time-2-design.pbw");
const LOCK_FILE = path.join(OUT_DIR, ".capture.lock");
const QEMU_HOST = "localhost";
const TRANSPORT_QEMU = "qemu";
const TRANSPORT_EMULATOR = "emulator";
const RESET_INTERVAL = Number.parseInt(process.env.CAPTURE_RESET_INTERVAL || "0", 10);
const DEFAULT_CAPTURE_TIME = process.env.CAPTURE_TIME || "10:10:00";

const VARIANTS = [
  { key: "analogue", label: "Analogue", faceMode: "FACE_MODE_HANDS", showHands: true, showDateComplication: false, showDateTiles: false },
  { key: "analogue_comp_3", label: "Analogue + 3 Comp", faceMode: "FACE_MODE_HANDS", showHands: true, showDateComplication: true, showDateTiles: false },
  { key: "analogue_comp_6", label: "Analogue + 6 Comp", faceMode: "FACE_MODE_HANDS", showHands: true, showDateComplication: false, showDateTiles: true },
  { key: "digital_small", label: "Digital Small", faceMode: "FACE_MODE_DIGITAL", showHands: false, showDateComplication: false, showDateTiles: false },
  { key: "digital_small_comp_3", label: "Digital Small + 3 Comp", faceMode: "FACE_MODE_DIGITAL", showHands: false, showDateComplication: true, showDateTiles: false },
  { key: "digital_small_comp_6", label: "Digital Small + 6 Comp", faceMode: "FACE_MODE_DIGITAL", showHands: false, showDateComplication: false, showDateTiles: true },
  { key: "digital_large", label: "Digital Large", faceMode: "FACE_MODE_LARGE_DIGITAL", showHands: false, showDateComplication: false, showDateTiles: false },
  { key: "digital_large_comp_3", label: "Digital Large + 3 Comp", faceMode: "FACE_MODE_LARGE_DIGITAL", showHands: false, showDateComplication: true, showDateTiles: false }
];

function runPebble(args, timeoutMs = 180000) {
  return execFileSync("pebble", args, {
    cwd: PROJECT_ROOT,
    stdio: "pipe",
    timeout: timeoutMs
  }).toString("utf8");
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function shouldRetryPebbleError(error) {
  const stderr = String((error && error.stderr) || "");
  return (
    (error && error.code === "ETIMEDOUT") ||
    (error && error.signal === "SIGTERM" && error.status === null) ||
    stderr.includes("Connection refused") ||
    stderr.includes("Connection reset by peer") ||
    stderr.includes("ConnectionResetError") ||
    stderr.includes("TimeoutError") ||
    stderr.includes("timed out") ||
    stderr.includes("_queue.Empty")
  );
}

function runPebbleWithRetry(args, retries = 8, delayMs = 700, timeoutMs = 180000) {
  let lastError = null;

  for (let i = 0; i < retries; i += 1) {
    try {
      return runPebble(args, timeoutMs);
    } catch (error) {
      lastError = error;
      if (!shouldRetryPebbleError(error)) {
        throw error;
      }
      process.stdout.write(`Retry ${i + 1}/${retries} for: pebble ${args.join(" ")}\n`);
      sleep(delayMs);
    }
  }

  throw lastError;
}

function ensureEmulatorReady() {
  // Deprecated by transport-aware preflight.
}

function parseLimitArg() {
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  if (!limitArg) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = Number.parseInt(limitArg.split("=")[1], 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new Error("Invalid --limit value. Use --limit=<positive integer>.");
  }

  return parsed;
}

function parseStartAtArg() {
  const startAtArg = process.argv.find((arg) => arg.startsWith("--start-at="));
  if (!startAtArg) {
    return 1;
  }

  const parsed = Number.parseInt(startAtArg.split("=")[1], 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new Error("Invalid --start-at value. Use --start-at=<positive integer>.");
  }

  return parsed;
}

function parseTransportArg() {
  const transportArg = process.argv.find((arg) => arg.startsWith("--transport="));
  if (!transportArg) {
    return "auto";
  }

  const value = transportArg.split("=")[1];
  if (value === "auto" || value === TRANSPORT_QEMU || value === TRANSPORT_EMULATOR) {
    return value;
  }

  throw new Error("Invalid --transport value. Use --transport=auto|qemu|emulator.");
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function parseTimeArg() {
  const timeArg = process.argv.find((arg) => arg.startsWith("--time="));
  const value = timeArg ? timeArg.split("=")[1] : DEFAULT_CAPTURE_TIME;

  if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) {
    throw new Error("Invalid --time value. Use --time=HH:MM:SS.");
  }

  const [hours, minutes, seconds] = value.split(":").map((part) => Number.parseInt(part, 10));
  if (
    Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds) ||
    hours < 0 || hours > 23 ||
    minutes < 0 || minutes > 59 ||
    seconds < 0 || seconds > 59
  ) {
    throw new Error("Invalid --time value. Use a valid 24-hour time, e.g. --time=10:10:00.");
  }

  return { hours, minutes, seconds, text: value };
}

function detectTransport(preferred) {
  if (preferred === TRANSPORT_QEMU) {
    runPebbleWithRetry(["ping", "--qemu", QEMU_HOST], 3, 900, 12000);
    return TRANSPORT_QEMU;
  }

  if (preferred === TRANSPORT_EMULATOR) {
    return TRANSPORT_EMULATOR;
  }

  try {
    runPebbleWithRetry(["ping", "--qemu", QEMU_HOST], 2, 700, 10000);
    return TRANSPORT_QEMU;
  } catch (error) {
    return TRANSPORT_EMULATOR;
  }
}

function withTransportArgs(transport, args) {
  if (transport === TRANSPORT_QEMU) {
    return ["--qemu", QEMU_HOST].concat(args);
  }
  return ["--emulator", "gabbro"].concat(args);
}

function killEmulatorBestEffort(transport) {
  if (transport !== TRANSPORT_EMULATOR) {
    return;
  }

  try {
    runPebble(["kill", "--force"], 10000);
  } catch (error) {
    // Best-effort cleanup between captures.
  }
}

function runPeriodicMaintenance(processedCount) {
  if (!Number.isInteger(RESET_INTERVAL) || RESET_INTERVAL < 1) {
    return;
  }

  if (processedCount < 1 || processedCount % RESET_INTERVAL !== 0) {
    return;
  }

  const sdkVersion = process.env.PEBBLE_SDK_VERSION || "4.9.148";
  process.stdout.write(`Maintenance at ${processedCount} captures: wipe + sdk install ${sdkVersion}\n`);
  runPebble(["wipe", "--everything"], 180000);
  runPebble(["sdk", "install", sdkVersion], 300000);
}

function writeDebugOverride(preset, variant, captureTime) {
  const content = `#include "mdbl.h"\n\nvoid apply_debug_state(AppState *state) {\n  state->mode = ${variant.faceMode};\n  state->show_hands = ${variant.showHands ? "true" : "false"};\n  state->show_date_tiles = ${variant.showDateTiles ? "true" : "false"};\n  state->show_date_complication = ${variant.showDateComplication ? "true" : "false"};\n\n  state->bg_colour = GColorFromRGB(${parseInt(preset.bgColour.slice(1, 3), 16)}, ${parseInt(preset.bgColour.slice(3, 5), 16)}, ${parseInt(preset.bgColour.slice(5, 7), 16)});\n  state->hour_colour = GColorFromRGB(${parseInt(preset.hourColour.slice(1, 3), 16)}, ${parseInt(preset.hourColour.slice(3, 5), 16)}, ${parseInt(preset.hourColour.slice(5, 7), 16)});\n  state->minute_colour = GColorFromRGB(${parseInt(preset.minuteColour.slice(1, 3), 16)}, ${parseInt(preset.minuteColour.slice(3, 5), 16)}, ${parseInt(preset.minuteColour.slice(5, 7), 16)});\n\n  state->hour_hand_colour = GColorFromRGB(${parseInt(preset.hourHandColour.slice(1, 3), 16)}, ${parseInt(preset.hourHandColour.slice(3, 5), 16)}, ${parseInt(preset.hourHandColour.slice(5, 7), 16)});\n  state->minute_hand_colour = GColorFromRGB(${parseInt(preset.minuteHandColour.slice(1, 3), 16)}, ${parseInt(preset.minuteHandColour.slice(3, 5), 16)}, ${parseInt(preset.minuteHandColour.slice(5, 7), 16)});\n\n  state->complication_bg_colour = GColorFromRGB(${parseInt(preset.complicationBgColour.slice(1, 3), 16)}, ${parseInt(preset.complicationBgColour.slice(3, 5), 16)}, ${parseInt(preset.complicationBgColour.slice(5, 7), 16)});\n  state->complication_border_colour = GColorFromRGB(${parseInt(preset.complicationBorderColour.slice(1, 3), 16)}, ${parseInt(preset.complicationBorderColour.slice(3, 5), 16)}, ${parseInt(preset.complicationBorderColour.slice(5, 7), 16)});\n  state->complication_text_colour = GColorFromRGB(${parseInt(preset.complicationTextColour.slice(1, 3), 16)}, ${parseInt(preset.complicationTextColour.slice(3, 5), 16)}, ${parseInt(preset.complicationTextColour.slice(5, 7), 16)});\n\n  state->now.tm_hour = ${captureTime.hours};\n  state->now.tm_min = ${captureTime.minutes};\n  state->now.tm_sec = ${captureTime.seconds};\n}\n\nbool should_ignore_config_messages(void) {\n  return true;\n}\n`;

  fs.writeFileSync(DEBUG_FILE, content, "utf8");
}

function writeNoopOverride() {
  fs.writeFileSync(
    DEBUG_FILE,
    `#include "mdbl.h"\n\nvoid apply_debug_state(AppState *state) {\n  (void)state;\n}\n\nbool should_ignore_config_messages(void) {\n  return false;\n}\n`,
    "utf8"
  );
}

function renderIndex() {
  const outFile = path.join(OUT_DIR, "index_compare.html");
  const variantLabels = {
    analogue: "Analogue",
    analogue_comp_3: "Analogue + 3 Comp",
    analogue_comp_6: "Analogue + 6 Comp",
    digital_small: "Digital Small",
    digital_small_comp_3: "Digital Small + 3 Comp",
    digital_small_comp_6: "Digital Small + 6 Comp",
    digital_large: "Digital Large",
    digital_large_comp_3: "Digital Large + 3 Comp"
  };

  function titleCaseFromCamel(value) {
    return String(value || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (c) => c.toUpperCase());
  }

  function parseFile(fileName) {
    const match = fileName.match(/^(.+?)__(analogue(?:_comp_[36])?|digital_small(?:_comp_[36])?|digital_large(?:_comp_3)?)\.png$/);
    if (!match) {
      return null;
    }

    const presetKey = match[1];
    const variantKey = match[2];
    return {
      fileName,
      presetKey,
      presetLabel: titleCaseFromCamel(presetKey),
      variantKey,
      variantLabel: variantLabels[variantKey] || variantKey
    };
  }

  const files = fs.readdirSync(OUT_DIR).filter((name) => name.endsWith(".png"));
  const entries = files.map(parseFile).filter(Boolean);
  const presets = Array.from(new Set(entries.map((entry) => entry.presetKey))).sort();
  const variants = Array.from(new Set(entries.map((entry) => entry.variantKey))).sort();

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Preset Compare (Gabbro)</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 16px; background: #f1f1f1; color: #222; }
      h1 { margin: 0 0 12px; }
      .toolbar { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 14px; }
      label { font-size: 12px; color: #555; display: block; margin-bottom: 4px; }
      select { width: 100%; height: 36px; border-radius: 8px; border: 1px solid #ccc; background: #fff; padding: 0 10px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
      figure { margin: 0; padding: 8px; background: #fff; border: 1px solid #ddd; border-radius: 10px; }
      img { display: block; width: 100%; border-radius: 8px; image-rendering: pixelated; background: #ddd; }
      figcaption { margin-top: 8px; line-height: 1.25; }
      .name { font-weight: 700; }
      .meta { color: #444; font-size: 14px; }
    </style>
  </head>
  <body>
    <h1>Preset Compare (Gabbro)</h1>
    <div class="toolbar">
      <div>
        <label for="groupBy">Group By</label>
        <select id="groupBy">
          <option value="none">None</option>
          <option value="preset">Preset</option>
          <option value="type">Type</option>
        </select>
      </div>
      <div>
        <label for="sortBy">Sort By</label>
        <select id="sortBy">
          <option value="preset_type">Preset then Type</option>
          <option value="type_preset">Type then Preset</option>
          <option value="file">Filename</option>
        </select>
      </div>
      <div>
        <label for="presetFilter">Preset Filter</label>
        <select id="presetFilter">
          <option value="">All presets</option>
          ${presets.map((preset) => `<option value="${preset}">${titleCaseFromCamel(preset)}</option>`).join("\n")}
        </select>
      </div>
      <div>
        <label for="typeFilter">Type Filter</label>
        <select id="typeFilter">
          <option value="">All types</option>
          ${variants.map((variant) => `<option value="${variant}">${variantLabels[variant] || variant}</option>`).join("\n")}
        </select>
      </div>
    </div>
    <div id="grid" class="grid"></div>
    <script>
      const data = ${JSON.stringify(entries)};
      const grid = document.getElementById("grid");
      const groupByEl = document.getElementById("groupBy");
      const sortByEl = document.getElementById("sortBy");
      const presetFilterEl = document.getElementById("presetFilter");
      const typeFilterEl = document.getElementById("typeFilter");

      function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

      function sorted(list, sortBy) {
        return list.slice().sort((a, b) => {
          if (sortBy === "file") {
            return cmp(a.fileName, b.fileName);
          }
          if (sortBy === "type_preset") {
            return cmp(a.variantKey, b.variantKey) || cmp(a.presetKey, b.presetKey);
          }
          return cmp(a.presetKey, b.presetKey) || cmp(a.variantKey, b.variantKey);
        });
      }

      function groupKey(item, mode) {
        if (mode === "preset") return item.presetLabel;
        if (mode === "type") return item.variantLabel;
        return "";
      }

      function render() {
        const groupBy = groupByEl.value;
        const sortBy = sortByEl.value;
        const presetFilter = presetFilterEl.value;
        const typeFilter = typeFilterEl.value;

        const filtered = data.filter((item) => {
          if (presetFilter && item.presetKey !== presetFilter) return false;
          if (typeFilter && item.variantKey !== typeFilter) return false;
          return true;
        });

        const list = sorted(filtered, sortBy);
        grid.innerHTML = "";

        let lastGroup = null;
        for (const item of list) {
          const g = groupKey(item, groupBy);
          if (g && g !== lastGroup) {
            const header = document.createElement("div");
            header.style.gridColumn = "1 / -1";
            header.style.fontWeight = "700";
            header.style.marginTop = "8px";
            header.textContent = g;
            grid.appendChild(header);
            lastGroup = g;
          }

          const figure = document.createElement("figure");
          figure.innerHTML = \`
            <img src="./\${item.fileName}" alt="\${item.presetLabel} \${item.variantLabel}" />
            <figcaption>
              <div class="name">\${item.presetLabel}</div>
              <div class="meta">\${item.variantLabel}</div>
            </figcaption>
          \`;
          grid.appendChild(figure);
        }
      }

      groupByEl.addEventListener("change", render);
      sortByEl.addEventListener("change", render);
      presetFilterEl.addEventListener("change", render);
      typeFilterEl.addEventListener("change", render);
      render();
    </script>
  </body>
</html>`;

  fs.writeFileSync(outFile, html, "utf8");
}

function main() {
  if (hasFlag("--print-total")) {
    process.stdout.write(`${Object.keys(PRESETS).length * VARIANTS.length}\n`);
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const captureLimit = parseLimitArg();
  const startAt = parseStartAtArg();
  const requestedTransport = parseTransportArg();
  const captureTime = parseTimeArg();
  let capturedThisRun = 0;

  if (fs.existsSync(LOCK_FILE)) {
    throw new Error(`Capture lock exists at ${LOCK_FILE}. Delete it if no capture is running.`);
  }

  fs.writeFileSync(LOCK_FILE, `${Date.now()}\n`, "utf8");

  let done = 0;
  const total = Object.keys(PRESETS).length * VARIANTS.length;
  let stopRequested = false;

  try {
    const transport = detectTransport(requestedTransport);
    process.stdout.write(`Using transport: ${transport}\n`);
    process.stdout.write(`Capture time: ${captureTime.text}\n`);

    for (const presetKey of Object.keys(PRESETS)) {
      const preset = PRESETS[presetKey];

      for (const variant of VARIANTS) {
        const fileName = `${presetKey}__${variant.key}.png`;
        const outPath = path.join(OUT_DIR, fileName);
        if (done + 1 < startAt) {
          done += 1;
          process.stdout.write(`Skipping ${done}/${total}: ${fileName} (before start-at)\n`);
          continue;
        }
        if (fs.existsSync(outPath)) {
          done += 1;
          process.stdout.write(`Skipping ${done}/${total}: ${fileName}\n`);
          continue;
        }

        if (capturedThisRun >= captureLimit) {
          process.stdout.write(`Reached capture limit (${captureLimit}). Stopping run.\n`);
          stopRequested = true;
          break;
        }

        process.stdout.write(`Capturing ${done + 1}/${total}: ${fileName}\n`);
        killEmulatorBestEffort(transport);
        writeDebugOverride(preset, variant, captureTime);
        runPebble(["build"], 180000);
        runPebbleWithRetry(["install"].concat(withTransportArgs(transport, [PBW_PATH])), 2, 1200, 90000);
        sleep(400);
        runPebbleWithRetry(["emu-set-time"].concat(withTransportArgs(transport, [captureTime.text])), 3, 900, 8000);
        sleep(250);
        runPebbleWithRetry(["screenshot"].concat(withTransportArgs(transport, ["--no-open", outPath])), 3, 900, 20000);
        killEmulatorBestEffort(transport);

        done += 1;
        capturedThisRun += 1;
        process.stdout.write(`Captured ${done}/${total}: ${fileName}\n`);
        runPeriodicMaintenance(done);
      }

      if (stopRequested) {
        break;
      }
    }
  } finally {
    writeNoopOverride();
    try {
      runPebble(["build"], 180000);
    } catch (error) {
      process.stdout.write("Warning: failed to rebuild noop override during cleanup.\n");
    }
    fs.rmSync(LOCK_FILE, { force: true });
  }

  renderIndex();
  process.stdout.write(`\nGenerated real matrix in: ${OUT_DIR}\n`);
}

main();
