# opencli-plugin-travel-hotel

OpenCLI plugin + agent skill for hotel-focused travel research.

This repository contains three pieces that work together:

1. An OpenCLI command for querying Trip single-night hotel prices
2. A reusable skill for hotel-matrix travel planning
3. An HTML generator for turning hotel matrices into shareable reports

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
- compare `1+4`, `2+3`, `1+1+3` stay combinations

### HTML generator

The bundled HTML generator lives at:

- `skills/opencli-travel-hotel-matrix/scripts/generate_hotel_matrix_html.mjs`

It takes a JSON input and renders a hotel comparison page with:

- nightly price columns
- Xiaohongshu pros/cons
- filter chips
- combo cards with total price and average nightly cost

## Install The Plugin

### From GitHub

```bash
opencli plugin install github:haoyueb2/opencli-plugin-travel-hotel
```

### From a local checkout

```bash
opencli plugin install file:///absolute/path/to/opencli-plugin-travel-hotel
```

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

If you prefer manual install, copy this folder into your Codex skills directory:

```bash
cp -R skills/opencli-travel-hotel-matrix ~/.codex/skills/
```

After installing a skill, restart Codex so it is picked up.

## Use The Skill

The skill entrypoint is:

- `skills/opencli-travel-hotel-matrix/SKILL.md`

The skill assumes this workflow:

1. `opencli xiaohongshu search` and `opencli xiaohongshu note` for hotel pool and pros/cons
2. `opencli ctrip search` for name normalization when needed
3. `opencli trip hotel-night-price` for nightly pricing
4. matrix generation
5. HTML output
6. stay-combo comparison

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

## Limitations

- This command is optimized for matrix building, not for enumerating every room type.
- Trip pricing is live and can shift fast.
- The adapter is designed around Trip's current DOM and keyword search response shape, so site changes may require updates.
