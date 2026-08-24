# THPD Puppetdex

A desktop app for looking up puppet information for the game
[Touhou Puppet Dance Performance](http://www.fo-lens.net/gn_enbu/), including a
damage calculator that covers the modded rosters as well as the official one.

Built with Tauri 2 + SvelteKit, backed by a SQLite database generated from the
[TPDP wiki](https://tpdp.miraheze.org).

## Layout

```
data/       Scraped JSON, curated calculator data, sprites, and the built DB
parser/     Python pipeline: wiki -> tpdp_data.json -> puppetdex.db
gui/src/    SvelteKit frontend (routes, viewmodels, repositories)
gui/src-tauri/  Rust shell: installs the bundled DB and hands the app a DSN
```

## Prerequisites

- [Deno](https://deno.com) 2.x
- [Rust](https://rustup.rs) + Cargo (for the Tauri build)
- Python 3.10+ (standard library only — no pip install needed)

## Setup

The scraped data (`data/tpdp_data.json`), the curated calculator tables
(`data/calc_extras.json`) and every sprite are committed, so you do **not** need
to scrape the wiki to run the app. Build the database from what's already here:

```bash
python3 parser/run_all.py --db-only
```

That writes `data/puppetdex.db` and needs no network access. Then:

```bash
cd gui
deno install
deno task tauri dev
```

## Updating the data

Only when the wiki has actually changed:

```bash
python3 parser/run_all.py
```

This runs the full pipeline - scrape master pages, get ~600 per-puppet pages,
download ~850 sprites, rebuild the database. It takes several minutes and makes
several hundred requests to a volunteer-run wiki, so avoid running it casually.
Each stage is also importable on its own from `parser/scrape.py` and
`parser/build_db.py`.

## Checks

```bash
cd gui
deno task check
deno task format
deno task format:check
```

## Releases

Pushing a `v*` tag runs `.github/workflows/release.yml`, which rebuilds the
database with `--db-only`, replaces the `gui/static` symlinks with real copies
(Git on Windows checks symlinks out as text files), and publishes a draft release
with Linux and Windows bundles.

## Licensing

The project is MIT. The damage engine under `gui/src/lib/calc/` is ported from
[tpdpextcalc](https://github.com/Gengetsu12/tpdpextcalc), itself derived from the
Pokémon Showdown damage calculator — see `gui/src/lib/calc/LICENSE`.
