#!/usr/bin/env python3
"""
Single entry point for the full data pipeline.

    python3 parser/run_all.py

Steps:
  1. Scrape master pages       → data/tpdp_data.json
  2. Enrich per-puppet pages   (detail scraper, ~600 requests)
  3. Download sprites          (~850 files)
  4. Build the SQLite database → data/puppetdex.db
"""

import json
import sys
from pathlib import Path

from scrape import scrape_all, enrich_all, download_all_sprites
import build_db

DATA_PATH = Path(__file__).parent.parent / "data" / "tpdp_data.json"


def main():
    print("Step 1: Scrape master pages", file=sys.stderr)
    data = scrape_all()
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Saved to {DATA_PATH}", file=sys.stderr)

    print("Step 2: Enrich per-puppet details", file=sys.stderr)
    enrich_all(DATA_PATH)

    print("Step 3: Download sprites", file=sys.stderr)
    download_all_sprites(DATA_PATH)

    print("Step 4: Build SQLite database", file=sys.stderr)
    build_db.build()

    print("Pipeline complete.", file=sys.stderr)


if __name__ == "__main__":
    main()
