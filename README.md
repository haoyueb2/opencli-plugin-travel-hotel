# opencli-plugin-travel-hotel

OpenCLI plugin + agent skill for hotel-focused travel research.

This repository contains three pieces that work together:

1. An OpenCLI command for querying Trip single-night hotel prices
2. A reusable skill for hotel-matrix travel planning
3. An HTML generator for turning hotel matrices into shareable reports

## Prerequisite

Before using this repository, install OpenCLI first.

OpenCLI repository:

- [https://github.com/jackwener/OpenCLI](https://github.com/jackwener/OpenCLI)

Typical install and self-check flow:

```bash
npm install -g @jackwener/opencli
opencli doctor --no-live
```

## What You Get

### Plugin command

After installation, the main command is:

```bash
opencli trip hotel-night-price '<hotel-name>' \
  --city '<city>' \
  --check-in YYYY-MM-DD \
  --check-out YYYY-MM-DD \
  -f json
```

Important: the plugin directory name is `travel-hotel`, but the command namespace is still `trip`, because the adapter registers `site: 'trip'`.

### Bundled skill

The bundled skill is:

- `opencli-travel-hotel-matrix`

It is meant for agent workflows such as:

- search Xiaohongshu for high-frequency hotel candidates
- normalize hotel names
- call `opencli trip hotel-night-price` repeatedly
- build nightly price matrices
- generate HTML reports
- let the matrix decide whether the best strategy is one hotel, one switch, or two switches

### HTML generator

The bundled HTML generator lives at:

- `skills/opencli-travel-hotel-matrix/scripts/generate_hotel_matrix_html.mjs`

It takes a JSON input and renders a hotel comparison page with:

- nightly price columns
- Xiaohongshu pros/cons
- Trip, Ctrip, and Xiaohongshu source links
- filter chips
- combo cards with total price and average nightly cost

## Install The Plugin

Recommended: use the GitHub install path for normal use. That is the standard OpenCLI plugin lifecycle.

### From GitHub

```bash
opencli plugin install github:haoyueb2/opencli-plugin-travel-hotel
```

What OpenCLI does during GitHub install:

1. clone this repo into `~/.opencli/plugins/travel-hotel`
2. run `npm install` inside the plugin directory
3. create `node_modules/@jackwener/opencli` as a symlink to the host OpenCLI package

That `node_modules` folder inside the installed plugin is expected. It is how imports like `@jackwener/opencli/registry` resolve correctly at runtime.

### From a local checkout

```bash
opencli plugin install file:///absolute/path/to/opencli-plugin-travel-hotel
```

Use local checkout install only for plugin development. It is not the recommended end-user path.

Then restart your shell or open a new terminal, and confirm the command exists:

```bash
opencli list | rg 'trip.+hotel-night-price'
```

## Use The Plugin

### Example: single-night price

```bash
opencli trip hotel-night-price 'Peninsula Hotel Danang' \
  --city 'Da Nang' \
  --check-in 2026-05-03 \
  --check-out 2026-05-04 \
  -f json
```

```bash
opencli trip hotel-night-price 'Paris Deli Danang Beach Hotel' \
  --city 'Da Nang' \
  --check-in 2026-05-03 \
  --check-out 2026-05-04 \
  -f json
```

Typical output fields include:

- `price`
- `totalPrice`
- `roomType`
- `breakfast`
- `freeCancel`
- `availability`
- `detailUrl`

## Install The Skill

If you already use `skills.sh`, install the bundled skill with:

```bash
npx skills add haoyueb2/opencli-plugin-travel-hotel@opencli-travel-hotel-matrix -g -y
```

If you want a local one-command install from this repo:

```bash
./scripts/install-codex-skill.sh
```

If you prefer manual install, copy this folder into your Codex skills directory:

```bash
cp -R skills/opencli-travel-hotel-matrix ~/.codex/skills/
```

After installing a skill, restart Codex so it is picked up.

## Use The Skill

The skill entrypoint is:

- `skills/opencli-travel-hotel-matrix/SKILL.md`

The skill assumes this workflow:

1. ask or confirm trip dates, budget ceiling, and whether hotel switching is acceptable
2. ask or infer the travel intent, such as resort stay, city sightseeing, business, family, food/nightlife, transit, or side trips
3. create a working JSON file for hotel candidates, prices, and source links
4. `opencli xiaohongshu search` and `opencli xiaohongshu note` for hotel pool and pros/cons
5. `opencli ctrip search` for name normalization and Ctrip links when available
6. `opencli trip hotel-night-price` for nightly pricing and Trip detail links
7. build a nightly matrix first
8. let the matrix reveal whether the best answer is `0 switch`, `1 switch`, or `2 switches`
9. HTML output and final recommendation

The important design rule is that links are captured during research and stored in the JSON input. The HTML generator reads fields such as `tripUrl`, `ctripUrl`, `xiaohongshu.searchUrl`, `xiaohongshu.noteLinks[]`, and `sourceLinks[]`; it does not search the web or invent links at render time.

## Generate HTML

You can generate a report from JSON like this:

```bash
node skills/opencli-travel-hotel-matrix/scripts/generate_hotel_matrix_html.mjs \
  --input skills/opencli-travel-hotel-matrix/assets/sample-hotel-matrix.json \
  --output sample-hotel-matrix.html \
  --title 'Da Nang Hotel Matrix'
```

The sample input file is:

- `skills/opencli-travel-hotel-matrix/assets/sample-hotel-matrix.json`

The data schema is documented in:

- `skills/opencli-travel-hotel-matrix/references/data-schema.md`

## Examples

Ready-to-open examples are included in:

- [examples/danang-hotel-matrix.sample.json](./examples/danang-hotel-matrix.sample.json)
- [examples/danang-hotel-matrix.sample.html](./examples/danang-hotel-matrix.sample.html)

You can regenerate the example HTML yourself:

```bash
node skills/opencli-travel-hotel-matrix/scripts/generate_hotel_matrix_html.mjs \
  --input examples/danang-hotel-matrix.sample.json \
  --output examples/danang-hotel-matrix.sample.html \
  --title 'Da Nang Hotel Matrix Example'
```

## Verify Fixture

This repo includes a verify fixture for the adapter:

- `verify/hotel-night-price.json`

Install it into the OpenCLI verify path with:

```bash
./scripts/install-verify-fixture.sh
```

Then verify the adapter:

```bash
opencli browser verify trip/hotel-night-price
```

## Troubleshooting

### `Cannot find module '@jackwener/opencli/registry'`

This usually means the OpenCLI host symlink inside the installed plugin is broken.

Reinstall from GitHub:

```bash
opencli plugin uninstall travel-hotel
opencli plugin install github:haoyueb2/opencli-plugin-travel-hotel
```

This issue is usually in the OpenCLI install/runtime linkage, not in the plugin command code itself.

### Why is there a `node_modules` folder inside the installed plugin?

This is expected for OpenCLI plugins installed from GitHub.

- OpenCLI runs `npm install` inside the plugin directory.
- OpenCLI links the host package into `node_modules/@jackwener/opencli`.
- The plugin command imports from that host package at runtime.

## Repository Layout

```text
opencli-plugin-travel-hotel/
├── opencli-plugin.json
├── package.json
├── hotel-night-price.js
├── examples/
│   ├── danang-hotel-matrix.sample.json
│   └── danang-hotel-matrix.sample.html
├── verify/
│   └── hotel-night-price.json
├── scripts/
│   └── install-verify-fixture.sh
└── skills/
    └── opencli-travel-hotel-matrix/
        ├── SKILL.md
        ├── scripts/
        ├── assets/
        └── references/
```

## Development Notes

- OpenCLI plugin discovery scans `.js` and `.ts` command files flat at the plugin root, so `hotel-night-price.js` stays in the top level.
- The skill can stay nested under `skills/`.
- The adapter currently uses Trip's keyword search HTTP endpoint to resolve the hotel, then opens the final results page and extracts the visible single-night offer.
- The intended planning philosophy is not to hardcode `1+4`, `2+3`, or `1+1+3`; those are only common outputs after the nightly matrix is built.
- The skill is city-agnostic. Beach and resort hotels are examples, not defaults; the hotel pool should follow the user's travel intent.

## Limitations

- This command is optimized for matrix building, not for enumerating every room type.
- Trip pricing is live and can shift fast.
- The adapter is designed around Trip's current DOM and keyword search response shape, so site changes may require updates.
