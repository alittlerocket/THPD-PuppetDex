#!/usr/bin/env python3
"""
Single entry point for the data pipeline.

    python3 parser/run_all.py             # full refresh (scrapes the wiki)
    python3 parser/run_all.py --db-only   # rebuild the database, no network

Steps:
  1. Scrape master pages       → data/tpdp_data.json
  2. Enrich per-puppet pages   (detail scraper, ~600 requests)
  3. Download sprites          (~850 files)
  4. Build the SQLite database → data/puppetdex.db

tpdp_data.json and data/sprites are committed, so the database can be rebuilt
offline with --db-only. Use the full run only when the wiki has actually
changed: it makes several hundred requests to a volunteer-run site.
"""

import argparse
import json
import sys
from pathlib import Path

from scrape import scrape_all, enrich_all, download_all_sprites
import build_db

DATA_PATH = Path(__file__).parent.parent / "data" / "tpdp_data.json"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--db-only",
        action="store_true",
        help="rebuild data/puppetdex.db from the committed JSON without scraping",
    )
    args = parser.parse_args()

    if args.db_only:
        if not DATA_PATH.exists():
            print(f"{DATA_PATH} not found — run without --db-only first.", file=sys.stderr)
            return 1
        print("Building SQLite database from existing JSON", file=sys.stderr)
        build_db.build()
        return 0

    print("Step 1: Scrape master pages", file=sys.stderr)
    data = scrape_all()
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Saved to {DATA_PATH}", file=sys.stderr)

    print("Step 2: Enrich per-puppet details", file=sys.stderr)
    enrich_all(DATA_PATH)

    print("Step 3: Download sprites", file=sys.stderr)
    download_all_sprites(DATA_PATH)

    print("Step 4: Build SQLite database", file=sys.stderr)
    build_db.build()

    print("Pipeline complete.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
