# Route Builder 3.0 — Foundation 01

Fresh implementation, separate from V24. This is a planning prototype, not a production navigation tool. No Google Maps API key or old source code is used.

## Deploy separately
Create a **new** GitHub repository, e.g. `route-builder-3`, and upload `index.html`, `src/` (including all four .mjs files and style.css), and `.nojekyll` if convenient. Enable GitHub Pages from main / root. Do not overwrite the V24 repository. Serve over HTTP(S); opening index.html directly may block ES modules. For local development: `python -m http.server 8000` in this directory and open http://localhost:8000/.

## First workflow
1. Routes → enter a name → New. Select operating mode before creating a route.
2. Import GPX and CSV (either order). GPX waypoints are imported if the route has no stops. CSV replaces current stops only after confirmation. CSV requires Address, Latitude, Longitude; supports Order and Status. Address-only CSV geocoding is deferred.
3. Build → Calculate recorded-GPX sequence. Inspect proposal and flagged orange stops in Stops. Apply only after reviewing; discarding restores prior order. Recorded GPX bytes are never modified by sequencing. A match is geometric, not proof of service or road name.
4. Review → replay original track, export original GPX or current CSV, or restore imported stop order. Replay speed is illustrative, not recorded time.
5. Back up library as JSON; local browser storage only, separate from V24. No account sync or legacy backup conversion yet. Keep customer files private; do not commit them to a public GitHub repository.

Dark UI is default; light toggle is independent of imagery. Numbers can be forced on with the map's Numbers button. Online Esri imagery is not bundled; availability and terms must be checked before production use. The overlay works without imagery.

## Scope and tests
`node tests/sequence.test.mjs` tests right-side collection on a synthetic double pass, track immutability, unmatched stops, GPX segment gaps, CSV parsing and export. Optional actual route test: `node tests/sequence.test.mjs /path/to/route.gpx /path/to/customers.csv` (test fixture extraction supports the supplied Demo 3 GPX format).
Demo 3: 1,014 customers, 2,998 GPS points, 74 flagged, 0 without a nearby pass, 996 positions changed, 28.90 miles. 461/451/441 Coopers Way appear at proposed 392/393/394. This does not establish the actual collection order. Browser navigation testing was blocked by the environment; live imagery, responsive UI and device operation are unverified.

Deferred: verified named-road matching, optimization/new GPX generation, live driver mode/turn-by-turn, accounts/cloud migration, route restrictions and automatic geocoding. Do not use the proposal as truck navigation without independent validation.
