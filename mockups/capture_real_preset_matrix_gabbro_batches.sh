#!/usr/bin/env bash
set -euo pipefail

PEBBLE_HOME="${PEBBLE_HOME:-$HOME/Library/Application Support/Pebble SDK}"
PEBBLE_SDK_VERSION="${PEBBLE_SDK_VERSION:-4.9.148}"
PEBBLE_TOOLCHAIN_BIN="$PEBBLE_HOME/SDKs/$PEBBLE_SDK_VERSION/toolchain/bin"
PATH="$PEBBLE_TOOLCHAIN_BIN:$PATH"
export PEBBLE_HOME PEBBLE_SDK_VERSION PEBBLE_TOOLCHAIN_BIN PATH

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CAPTURE_SCRIPT="$PROJECT_ROOT/mockups/capture_real_preset_matrix_gabbro_build_override.js"
LOCK_FILE="$PROJECT_ROOT/mockups/preset_matrix_gabbro_real/.capture.lock"

START_AT="${1:-1}"
BATCH_SIZE="${2:-35}"
CAPTURE_TIME="${3:-10:10:00}"

cd "$PROJECT_ROOT"

TOTAL="$(node "$CAPTURE_SCRIPT" --print-total)"
echo "Total captures in queue: $TOTAL"
echo "Starting from: $START_AT"
echo "Batch size: $BATCH_SIZE"
echo "Capture time: $CAPTURE_TIME"

current="$START_AT"
while [ "$current" -le "$TOTAL" ]; do
  echo ""
  echo "=== Batch starting at $current ==="

  pebble kill --force || true
  pkill -9 -f qemu-pebble || true
  pkill -9 -f "pebble ping --emulator gabbro" || true

  mkdir -p "$PEBBLE_HOME"
  printf "{}\n" > "$PEBBLE_HOME/settings.json"

  pebble wipe --everything || true
  pebble sdk install "$PEBBLE_SDK_VERSION"

  which qemu-pebble
  qemu-pebble --version || true

  rm -f "$LOCK_FILE"
  node "$CAPTURE_SCRIPT" --transport=emulator --time="$CAPTURE_TIME" --start-at="$current" --limit="$BATCH_SIZE"

  current=$((current + BATCH_SIZE))
done

echo ""
echo "All batches complete."
