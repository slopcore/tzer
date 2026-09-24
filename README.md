# tzer

Stacked 24-hour day/night bars for multiple time zones, centred on your current time.

- Bars are shaded by the sun's real elevation at each zone's reference city (day, civil / nautical / astronomical twilight, night).
- Local times come from the browser's time zone database, so DST and half-hour offsets are handled, including a DST change inside the 24-hour window.
- Hover or drag across the bars to read every zone's time at that moment.
- Installable as a PWA and works offline once loaded (`manifest.webmanifest`, `sw.js`).

Plain static HTML/JS, no build step. Pushing to `main` deploys via `.github/workflows/pages.yml`, which stamps the commit SHA onto the script URLs to bust browser caches.

Zone coordinates in `zones.js` are generated from tzdata's `zone.tab`:

```sh
python3 scripts/build_zones.py /usr/share/zoneinfo/zone.tab
```

App icons in `icons/` are drawn by `python3 scripts/build_icons.py`.
