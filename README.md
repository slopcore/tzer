# tzer

Stacked 24-hour day/night bars for multiple time zones, centred on your current time.

- Bars are shaded by the sun's real elevation at each zone's reference city (day, civil / nautical / astronomical twilight, night).
- Local times come from the browser's time zone database, so DST and half-hour offsets are handled, including a DST change inside the 24-hour window.
- Hover or drag across the bars to read every zone's time at that moment.

Plain static HTML/JS, no build step. Served by GitHub Pages from `main`.

Zone coordinates in `zones.js` are generated from tzdata's `zone.tab`:

```sh
python3 scripts/build_zones.py /usr/share/zoneinfo/zone.tab
```
