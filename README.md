# TrioWay

A Pebble Alloy watchface for **TrioWay** with:

- Dynamic three-colour sectors that move with hour and minute position.
- A date/day tile complication near the 6 position (`08` + `MON` style).
- Three selectable face modes:
  - `hands`: moving colours + analogue hands
  - `colour`: moving colours only
  - `digital`: moving colours + digital `HHMM` tiles
- Phone settings for all three colours and face mode.

## Build and install

1. Install the latest rePebble SDK.
2. Build from this project root:

```bash
pebble build
```

3. Install on the TrioWay emulator:

```bash
pebble install --emulator emery
```

## Configuration

Open the watchface settings in the Pebble mobile app to edit:

- Face mode
- 5-minute edge markers toggle
- Colour preset (optional)
- Base colour
- Hour colour
- Minute colour
