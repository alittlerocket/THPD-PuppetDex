#!/usr/bin/env python3
"""
Sprite downloader.
Reads data/tpdp_data.json, downloads each sprite URL to data/sprites/,
then rewrites the JSON so sprite fields contain local filenames only.
Skips already-downloaded files (safe to re-run).
"""

import json
import sys
import time
from pathlib import Path

from wiki import WikiClient

wiki = WikiClient()

DELAY       = 0.10
DATA        = Path(__file__).parent.parent / "data" / "tpdp_data.json"
SPRITES_DIR = Path(__file__).parent.parent / "data" / "sprites"
SPRITE_KEYS = ("normal", "alt_color", "alt_costume", "wedding")


#  Download helpers 

def _collect_queue(data: dict) -> list[tuple[str, str]]:
    """Return unique (url, local_filename) pairs across all puppets."""
    queue: list[tuple[str, str]] = []
    seen: set[str] = set()
    for puppet in data["puppets"] + data["mod_puppets"]:
        for key in SPRITE_KEYS:
            url = (puppet.get("sprites") or {}).get(key)
            if url and url not in seen:
                seen.add(url)
                queue.append((url, wiki.filename_from_url(url)))
        for form in (puppet.get("alt_forms") or {}).values():
            url = form.get("sprite")
            if url and url not in seen:
                seen.add(url)
                queue.append((url, wiki.filename_from_url(url)))
    return queue


def _download_queue(queue: list[tuple[str, str]]) -> tuple[int, int, int]:
    """Download each (url, filename) to SPRITES_DIR. Returns (downloaded, skipped, failed)."""
    downloaded = skipped = failed = 0
    for url, fname in queue:
        dest = SPRITES_DIR / fname
        if dest.exists():
            skipped += 1
            continue
        if wiki.download_file(url, dest):
            downloaded += 1
        else:
            failed += 1
        time.sleep(DELAY)
    return downloaded, skipped, failed


def _rewrite_filenames(data: dict) -> None:
    """Replace sprite URLs with local filenames; null out any that didn't download."""
    for puppet in data["puppets"] + data["mod_puppets"]:
        sp = puppet.get("sprites") or {}
        for key in SPRITE_KEYS:
            url = sp.get(key)
            if not url:
                continue
            fname = wiki.filename_from_url(url) if url.startswith("http") else url
            sp[key] = fname if (SPRITES_DIR / fname).exists() else None
        for form in (puppet.get("alt_forms") or {}).values():
            url = form.get("sprite")
            if not url:
                continue
            fname = wiki.filename_from_url(url) if url.startswith("http") else url
            form["sprite"] = fname if (SPRITES_DIR / fname).exists() else None


#  Recovery helper

def _rebuild_variant_urls(data: dict) -> None:
    """
    Repopulate null sprite variant URLs from each puppet's imagename.
    Detects changed=True from the normal sprite filename (ends with ' a.gif').
    Called before _collect_queue when variants are missing due to a bad prior run.
    """
    seen: set[str] = set()
    for puppet in data["puppets"] + data["mod_puppets"]:
        imagename = puppet.get("imagename")
        if not imagename or imagename in seen:
            continue
        seen.add(imagename)
        sp = puppet.get("sprites") or {}
        normal = sp.get("normal") or ""
        changed = normal.endswith(" a.gif")
        urls = wiki.sprite_urls(imagename, changed)
        for puppet2 in data["puppets"] + data["mod_puppets"]:
            if puppet2.get("imagename") == imagename:
                sp2 = puppet2.get("sprites") or {}
                for key in SPRITE_KEYS:
                    if sp2.get(key) is None:
                        sp2[key] = urls[key]
                puppet2["sprites"] = sp2


#  Public entry point

def download_all_sprites(data_path: Path = DATA) -> None:
    """Download all sprites and rewrite the JSON at data_path with local filenames."""
    SPRITES_DIR.mkdir(parents=True, exist_ok=True)

    with open(data_path) as f:
        d = json.load(f)

    _rebuild_variant_urls(d)
    queue = _collect_queue(d)
    print(f"Downloading {len(queue)} sprites to {SPRITES_DIR}", file=sys.stderr)

    downloaded, skipped, failed = _download_queue(queue)
    print(f"Done: {downloaded} downloaded, {skipped} skipped, {failed} failed", file=sys.stderr)

    _rewrite_filenames(d)

    with open(data_path, "w") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
    print(f"JSON updated: {data_path}", file=sys.stderr)



def main():
    download_all_sprites()


if __name__ == "__main__":
    main()
