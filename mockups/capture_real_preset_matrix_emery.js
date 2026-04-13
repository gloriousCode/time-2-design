const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { PRESETS } = require("../src/pkjs/constants");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(__dirname, "preset_matrix_emery_real");
const PBW_PATH = path.join(PROJECT_ROOT, "build", "time-2-design.pbw");
const TMP_CONFIG_HTML = "/tmp/pebble_cfg_payload.html";
const LOCK_FILE = path.join(OUT_DIR, ".capture.lock");
const QEMU_HOST = "localhost";
const FIXED_TIME = "10:09:00";
const TRANSPORT_QEMU = "qemu";
const TRANSPORT_EMULATOR = "emulator";

const VARIANTS = [
  { key: "analogue", label: "Analogue", faceMode: "hands", showHands: true, showDateComplication: false, showDateTiles: false },
  { key: "analogue_comp_3", label: "Analogue + 3 Comp", faceMode: "hands", showHands: true, showDateComplication: true, showDateTiles: false },
  { key: "analogue_comp_6", label: "Analogue + 6 Comp", faceMode: "hands", showHands: true, showDateComplication: false, showDateTiles: true },
  { key: "digital_small", label: "Digital Small", faceMode: "digital", showHands: false, showDateComplication: false, showDateTiles: false },
  { key: "digital_small_comp_3", label: "Digital Small + 3 Comp", faceMode: "digital", showHands: false, showDateComplication: true, showDateTiles: false },
  { key: "digital_small_comp_6", label: "Digital Small + 6 Comp", faceMode: "digital", showHands: false, showDateComplication: false, showDateTiles: true },
  { key: "digital_large", label: "Digital Large", faceMode: "largedigital", showHands: false, showDateComplication: false, showDateTiles: false },
  { key: "digital_large_comp_3", label: "Digital Large + 3 Comp", faceMode: "largedigital", showHands: false, showDateComplication: true, showDateTiles: false }
];

function runPebble(args, options = {}) {
  return execFileSync("pebble", args, {
    cwd: PROJECT_ROOT,
    stdio: "pipe",
    timeout: options.timeoutMs || 120000
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

function runPebbleWithRetry(args, options = {}, retries = 3, delayMs = 800) {
  let lastError = null;

  for (let i = 0; i < retries; i += 1) {
    try {
      return runPebble(args, options);
    } catch (error) {
      lastError = error;
      if (!shouldRetryPebbleError(error)) {
        throw error;
      }
      process.stdout.write(`Retry ${i + 1}/${retries}: pebble ${args.join(" ")}\n`);
      sleep(delayMs);
    }
  }

  throw lastError;
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

function detectTransport(preferred) {
  if (preferred === TRANSPORT_QEMU) {
    runPebble(["ping", "--qemu", QEMU_HOST], { timeoutMs: 8000 });
    return TRANSPORT_QEMU;
  }

  if (preferred === TRANSPORT_EMULATOR) {
    return TRANSPORT_EMULATOR;
  }

  try {
    runPebble(["ping", "--qemu", QEMU_HOST], { timeoutMs: 8000 });
    return TRANSPORT_QEMU;
  } catch (error) {
    return TRANSPORT_EMULATOR;
  }
}

function withTransportArgs(transport, args) {
  if (transport === TRANSPORT_QEMU) {
    return ["--qemu", QEMU_HOST].concat(args);
  }
  return ["--emulator", "emery"].concat(args);
}

function killEmulatorBestEffort(transport) {
  if (transport !== TRANSPORT_EMULATOR) {
    return;
  }

  try {
    runPebble(["kill", "--force"], { timeoutMs: 10000 });
  } catch (error) {
    // Best-effort cleanup between captures.
  }
}

function writeConfigHtml(payload) {
  const html = `<!doctype html><html><body><script>
window.location = "pebblejs://close#" + encodeURIComponent(JSON.stringify(${JSON.stringify(payload)}));
</script></body></html>`;

  fs.writeFileSync(TMP_CONFIG_HTML, html, "utf8");
}

function applyConfig(payload, transport) {
  writeConfigHtml(payload);

  try {
    runPebbleWithRetry(["emu-app-config"].concat(withTransportArgs(transport, ["--file", TMP_CONFIG_HTML])), { timeoutMs: 2500 }, 2, 500);
  } catch (error) {
    // emu-app-config can block even after config is applied; timeout is expected.
  }

  sleep(350);
}

function screenshot(filePath, transport) {
  runPebbleWithRetry(["screenshot"].concat(withTransportArgs(transport, ["--no-open", filePath])), { timeoutMs: 20000 }, 3, 800);
}

function setTimeFixed(transport) {
  runPebbleWithRetry(["emu-set-time"].concat(withTransportArgs(transport, [FIXED_TIME])), { timeoutMs: 12000 }, 3, 800);
}

function ensureBuiltAndInstalled(transport) {
  runPebble(["build"], { timeoutMs: 180000 });
  runPebbleWithRetry(["install"].concat(withTransportArgs(transport, [PBW_PATH])), { timeoutMs: 20000 }, 3, 800);
  setTimeFixed(transport);
}

function createPayload(preset, variant) {
  return {
    faceMode: variant.faceMode,
    showHands: variant.showHands,
    showDateTiles: variant.showDateTiles,
    showDateComplication: variant.showDateComplication,
    bgColour: preset.bgColour,
    hourColour: preset.hourColour,
    minuteColour: preset.minuteColour,
    hourHandColour: preset.hourHandColour,
    minuteHandColour: preset.minuteHandColour,
    complicationBgColour: preset.complicationBgColour,
    complicationBorderColour: preset.complicationBorderColour,
    complicationTextColour: preset.complicationTextColour
  };
}

function renderIndex() {
  const cards = [];

  for (const presetKey of Object.keys(PRESETS)) {
    const preset = PRESETS[presetKey];

    for (const variant of VARIANTS) {
      const fileName = `${presetKey}__${variant.key}.png`;
      cards.push(`
        <figure>
          <img src="./${fileName}" alt="${preset.label} ${variant.label}" />
          <figcaption><strong>${preset.label}</strong><br/>${variant.label}</figcaption>
        </figure>
      `);
    }
  }

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Real Pebble Preset Matrix</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 16px; background: #f1f1f1; color: #222; }
      h1 { margin-top: 0; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
      figure { margin: 0; padding: 8px; background: white; border: 1px solid #ddd; border-radius: 8px; }
      img { display: block; width: 100%; height: auto; background: #ddd; border-radius: 6px; image-rendering: pixelated; }
      figcaption { font-size: 12px; margin-top: 6px; line-height: 1.4; }
    </style>
  </head>
  <body>
    <h1>Real Pebble Emulator Preset Matrix (Emery @ ${FIXED_TIME})</h1>
    <p>${Object.keys(PRESETS).length} presets × ${VARIANTS.length} variants.</p>
    <div class="grid">${cards.join("\n")}</div>
  </body>
</html>`;

  fs.writeFileSync(path.join(OUT_DIR, "index.html"), html, "utf8");
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const captureLimit = parseLimitArg();
  const requestedTransport = parseTransportArg();
  let capturedThisRun = 0;

  if (fs.existsSync(LOCK_FILE)) {
    throw new Error(`Capture lock exists at ${LOCK_FILE}. Remove it if no capture is running.`);
  }

  fs.writeFileSync(LOCK_FILE, `${Date.now()}\n`, "utf8");

  try {
    const transport = detectTransport(requestedTransport);
    process.stdout.write(`Using transport: ${transport}\n`);
    ensureBuiltAndInstalled(transport);

    let done = 0;
    const total = Object.keys(PRESETS).length * VARIANTS.length;

    for (const presetKey of Object.keys(PRESETS)) {
      const preset = PRESETS[presetKey];

      for (const variant of VARIANTS) {
        const payload = createPayload(preset, variant);
        const fileName = `${presetKey}__${variant.key}.png`;
        const outPath = path.join(OUT_DIR, fileName);

        if (fs.existsSync(outPath)) {
          done += 1;
          process.stdout.write(`Skipping ${done}/${total}: ${fileName}\n`);
          continue;
        }

        if (capturedThisRun >= captureLimit) {
          process.stdout.write(`Reached capture limit (${captureLimit}). Stopping run.\n`);
          break;
        }

        process.stdout.write(`Capturing ${done + 1}/${total}: ${fileName}\n`);
        killEmulatorBestEffort(transport);
        applyConfig(payload, transport);
        setTimeFixed(transport);
        screenshot(outPath, transport);
        killEmulatorBestEffort(transport);

        done += 1;
        capturedThisRun += 1;
        process.stdout.write(`Captured ${done}/${total}: ${fileName}\n`);
      }

      if (capturedThisRun >= captureLimit) {
        break;
      }
    }

    renderIndex();
    process.stdout.write(`\nGenerated real screenshot matrix in: ${OUT_DIR}\n`);
  } finally {
    fs.rmSync(LOCK_FILE, { force: true });
  }
}

main();
