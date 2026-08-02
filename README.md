# THPD Puppetdex

A desktop solution for looking up puppet information for the game
[Touhou Puppet Dance Performance](http://www.fo-lens.net/gn_enbu/).

Built with Tauri 2 + SvelteKit, backed by a SQLite database generated from the [TPDP wiki](https://tpdp.miraheze.org).

## Prerequisites for Devs

- [Deno](https://deno.com) 2.x
- [Rust](https://rustup.rs) + Cargo (for the Tauri build)
- Python 3.10+

## Setup

`data/` is gitignored since it's entirely generated/scraped content. Build it once before running the app:

```bash
python3 parser/run_all.py
```

This scrapes the wiki (~1,500 requests, several minutes), downloads sprites, and builds `data/puppetdex.db`.

## Running the app

```bash
cd gui
deno install
deno task tauri dev
```

## Updating the data

Re-run `python3 parser/run_all.py` any time the wiki changes. Each step (scrape, enrich, sprites, build DB) is also individually importable from `parser/scrape.py` and `parser/build_db.py`
