#!/usr/bin/env python3
"""
TPDP puppet detail scraper.
Enriches data/tpdp_data.json with per-puppet page data:
  dex_entry, jp_name, lv100_exp, low_drops, high_drops, style_changes,
  stat_ranges, locations, level_up_skills, skill_cards, sprites.
Runs sequentially (~600 requests, ~3 min) to avoid overloading the server.
"""

import re
import json
import time
import sys
from pathlib import Path

from wiki import WikiClient
from wikitext import (
    tabber_section, all_tabber_sections,
    parse_table, all_tables,
    find_template, parse_template_args, clean,
)
from coerce import to_int, nullify

wiki = WikiClient()

DELAY      = 0.35
DATA_PATH  = Path(__file__).parent.parent / "data" / "tpdp_data.json"
STYLE_PREFIXES = ["Normal", "Defense", "Power", "Extra", "Speed", "Assist"]


#  Detail extractors 

def get_dex_entry(content: str) -> str | None:
    m = re.search(r"Dex Entry\s*\|\s*(.*?)(?:\n|\|\})", content, re.DOTALL)
    return clean(m.group(1).strip()) if m else None


def get_stat_ranges(content: str) -> dict | None:
    """
    Find the level-50 stat range table and extract min/max for each stat.
    Looks for rows containing values like "125-172".
    """
    range_re = re.compile(r"^(\d+)-(\d+)$")
    stat_keys = ["hp", "fo_atk", "fo_def", "sp_atk", "sp_def", "spd"]
    for tbl in all_tables(content):
        if not any(k in tbl for k in ("HP", "Fo.Att", "Fo.Def")):
            continue
        _, rows = parse_table(tbl)
        for row in rows:
            ranges = [v for v in row if v and range_re.match(v)]
            if len(ranges) >= 5:
                result = {}
                for i, key in enumerate(stat_keys):
                    if i < len(ranges):
                        m = range_re.match(ranges[i])
                        if m:
                            result[key] = {"min": int(m.group(1)), "max": int(m.group(2))}
                if result:
                    return result
    return None


def get_stat_ranges_from_template(args: dict) -> dict | None:
    """Parse stat ranges from {{PuppetStats}} template args (used by mod puppets)."""
    key_map = [
        ("hp", "hp"), ("foatk", "fo_atk"), ("fodef", "fo_def"),
        ("spatk", "sp_atk"), ("spdef", "sp_def"), ("speed", "spd"),
    ]
    result = {}
    for tmpl_key, stat_key in key_map:
        r = args.get(f"{tmpl_key}-range", "")
        if r:
            parts = r.split("-")
            if len(parts) == 2:
                try:
                    result[stat_key] = {"min": int(parts[0]), "max": int(parts[1])}
                except ValueError:
                    pass
    return result if result else None


def get_locations(content: str) -> list[dict]:
    locs: list[dict] = []
    for tbl in all_tables(content):
        if "Location" not in tbl or "Level Range" not in tbl:
            continue
        _, rows = parse_table(tbl)
        for row in rows:
            if len(row) >= 3 and row[0]:
                locs.append({
                    "location":       row[0],
                    "level_range":    row[1],
                    "encounter_rate": row[2],
                })
    return locs


def get_learnset(content: str) -> list[dict]:
    """Parse the Level Up Skills table (10-col SoD format or 9-col fallback)."""
    for tbl in all_tables(content):
        if "Level Up Skills" not in tbl and "|+ Level Up" not in tbl:
            continue
        if "Skill Name" not in tbl:
            continue
        _, rows = parse_table(tbl)
        skills = []
        for row in rows:
            if not any(row):
                continue
            name = row[1] if len(row) > 1 else None
            if not name or "Bold" in name:
                continue
            if len(row) >= 10:
                skills.append({
                    "level":    row[0],
                    "name":     name,
                    "type":     row[2] if len(row) > 2 else None,
                    "category": row[3] if len(row) > 3 else None,
                    "class":    row[4] if len(row) > 4 else None,
                    "power":    to_int(row[5]) if len(row) > 5 else None,
                    "accuracy": to_int(row[6]) if len(row) > 6 else None,
                    "max_sp":   to_int(row[7]) if len(row) > 7 else None,
                    "priority": to_int(row[8]) if len(row) > 8 else None,
                    "pp":       to_int(row[9]) if len(row) > 9 else None,
                })
            elif len(row) >= 9:
                skills.append({
                    "level":    row[0],
                    "name":     name,
                    "type":     row[2] if len(row) > 2 else None,
                    "category": row[3] if len(row) > 3 else None,
                    "class":    None,
                    "power":    to_int(row[4]) if len(row) > 4 else None,
                    "accuracy": to_int(row[5]) if len(row) > 5 else None,
                    "max_sp":   to_int(row[6]) if len(row) > 6 else None,
                    "priority": to_int(row[7]) if len(row) > 7 else None,
                    "pp":       to_int(row[8]) if len(row) > 8 else None,
                })
        return skills  # only the first matching table
    return []


def get_skill_cards(content: str) -> list[dict]:
    """Parse the Skill Cards compatibility table."""
    for tbl in all_tables(content):
        if "Skill Cards" not in tbl and "|+ Skill" not in tbl:
            continue
        if "Skill Name" not in tbl:
            continue
        _, rows = parse_table(tbl)
        cards = []
        for row in rows:
            if not any(row):
                continue
            sc   = row[0] if row else None
            name = row[1] if len(row) > 1 else None
            if not name or "Bold" in name:
                continue
            if sc and ("Bold" in sc or sc.startswith("-")):
                continue
            if len(row) >= 9:
                cards.append({
                    "sc":       sc,
                    "name":     name,
                    "type":     row[2] if len(row) > 2 else None,
                    "category": row[3] if len(row) > 3 else None,
                    "class":    row[4] if len(row) > 4 else None,
                    "power":    to_int(row[5]) if len(row) > 5 else None,
                    "accuracy": to_int(row[6]) if len(row) > 6 else None,
                    "max_sp":   to_int(row[7]) if len(row) > 7 else None,
                    "priority": to_int(row[8]) if len(row) > 8 else None,
                })
            elif len(row) >= 8:
                cards.append({
                    "sc":       sc,
                    "name":     name,
                    "type":     row[2] if len(row) > 2 else None,
                    "category": row[3] if len(row) > 3 else None,
                    "class":    None,
                    "power":    to_int(row[4]) if len(row) > 4 else None,
                    "accuracy": to_int(row[5]) if len(row) > 5 else None,
                    "max_sp":   to_int(row[6]) if len(row) > 6 else None,
                    "priority": to_int(row[7]) if len(row) > 7 else None,
                })
        return cards  # only the first matching table
    return []


#  Section parsers 

def parse_base_section(content: str) -> dict:
    """
    Extract all detail fields from the SoD 1.103 section of a base puppet page.
    Base puppet pages use the {{InfoBoxYNK}} template.
    """
    ib_raw = find_template(content, "InfoBoxYNK")
    ib = parse_template_args(ib_raw) if ib_raw else {}

    imagename = ib.get("imagename", "")
    changed   = bool(ib.get("changedsprites", ""))

    try:
        lv100_exp: int | None = int(ib.get("lv100exp", "").replace(",", ""))
    except ValueError:
        lv100_exp = None

    style_changes = [
        clean(ib.get("style1")),
        clean(ib.get("style2")),
        clean(ib.get("style3")),
    ]

    return {
        "jp_name":         clean(ib.get("jname")),
        "imagename":       imagename or None,
        "lv100_exp":       lv100_exp,
        "low_drops":       clean(ib.get("lowdrops")),
        "high_drops":      clean(ib.get("highdrops")),
        "style_changes":   [s for s in style_changes if s],
        "dex_entry":       get_dex_entry(content),
        "stat_ranges":     get_stat_ranges(content),
        "locations":       get_locations(content),
        "level_up_skills": get_learnset(content),
        "skill_cards":     get_skill_cards(content),
        "sprites":         wiki.sprite_urls(imagename, changed) if imagename else {},
    }


def parse_mod_section(content: str) -> dict:
    """
    Extract all detail fields from a style tab on a mod puppet page.
    Mod puppet pages use {{InfoBoxMOD}} and optionally {{PuppetStats}} for stat ranges.
    """
    ib_raw = find_template(content, "InfoBoxMOD")
    ib = parse_template_args(ib_raw) if ib_raw else {}

    imagename = ib.get("imagename", "")
    changed   = bool(ib.get("changedsprites", ""))

    try:
        lv100_exp: int | None = int(ib.get("lv100exp", "").replace(",", ""))
    except ValueError:
        lv100_exp = None

    ps_raw = find_template(content, "PuppetStats")
    ps = parse_template_args(ps_raw) if ps_raw else {}
    stat_ranges = get_stat_ranges_from_template(ps) or get_stat_ranges(content)

    return {
        "jp_name":         clean(ib.get("jname")),
        "imagename":       imagename or None,
        "lv100_exp":       lv100_exp,
        "low_drops":       clean(ib.get("lowdrops")),
        "high_drops":      clean(ib.get("highdrops")),
        "dex_entry":       get_dex_entry(content),
        "stat_ranges":     stat_ranges,
        "locations":       get_locations(content),
        "level_up_skills": get_learnset(content),
        "skill_cards":     get_skill_cards(content),
        "sprites":         wiki.sprite_urls(imagename, changed) if imagename else {},
    }


#  Enrich helpers 

def _checkpoint(data: dict, path: Path, done: int) -> None:
    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"  checkpoint: {done} pages done", file=sys.stderr)


def _enrich_alt_form_base(
    puppet: dict, wt: str, base_imagenames: set[str]
) -> None:
    """
    Enrich a * puppet (alternate form) from the parent page's wikitext.
    base_imagenames: imagenames already used by non-* puppets — these tabs
    are the regular forms and should be excluded from alt-form matching.
    Matches the remaining tabs by type1, or uses the sole remaining tab.
    """
    puppet_type = (puppet.get("type1") or "").lower()
    candidates = []
    for _tab_name, content in all_tabber_sections(wt):
        ib_raw = find_template(content, "InfoBoxYNK")
        if not ib_raw:
            continue
        ib = parse_template_args(ib_raw)
        imagename = ib.get("imagename", "").strip()
        if not imagename or imagename in base_imagenames:
            continue
        candidates.append((ib.get("type1", "").lower(), content))

    match = next((c for t, c in candidates if puppet_type and t == puppet_type), None)
    if match is None and len(candidates) == 1:
        match = candidates[0][1]
    if match:
        puppet.update(parse_base_section(match))


def _enrich_one_base(puppet: dict, base_imagenames: set[str]) -> None:
    """Fetch and enrich a single base puppet dict in-place."""
    name = puppet["name"]
    is_alt = name.endswith("*")
    page_name = name.rstrip("*").strip().replace(" ", "_")
    wt = wiki.fetch_wikitext(page_name)
    if not wt:
        return
    if is_alt:
        _enrich_alt_form_base(puppet, wt, base_imagenames)
    else:
        puppet.update(parse_base_section(tabber_section(wt, "SoD 1.103")))


def _build_mod_pages(mod_puppets: list[dict]) -> dict[str, str]:
    """Return {page_title: mod_tab} for each unique mod puppet wiki page."""
    pages: dict[str, str] = {}
    for puppet in mod_puppets:
        pname   = puppet["name"]
        mod_tab = puppet.get("mod_tab", "")
        style   = next((s for s in STYLE_PREFIXES if pname.startswith(s + " ")), None)
        if not style:
            continue
        char_name = pname[len(style) + 1:]
        pages[f"Mod:{mod_tab}/{char_name}"] = mod_tab
    return pages


def _enrich_one_mod_page(
    page_title: str,
    mod_puppets: list[dict],
    mod_by_name: dict[str, int],
) -> None:
    """Fetch a mod puppet page and enrich all style variants in-place."""
    char_name = page_title.split("/", 1)[-1]
    wt = wiki.fetch_wikitext(page_title)
    if not wt:
        return

    style_imagenames: set[str] = set()
    for tab_name, content in all_tabber_sections(wt):
        puppet_name = f"{tab_name} {char_name}"
        if puppet_name in mod_by_name:
            details = parse_mod_section(content)
            mod_puppets[mod_by_name[puppet_name]].update(details)
            if details.get("imagename"):
                style_imagenames.add(details["imagename"])

    # Tabs whose imagename differs from all style tabs are alt forms.
    alt_forms: dict[str, dict] = {}
    for tab_name, content in all_tabber_sections(wt):
        ib_raw = find_template(content, "InfoBoxMOD")
        if not ib_raw:
            continue
        ib = parse_template_args(ib_raw)
        imagename = ib.get("imagename", "").strip()
        if not imagename or imagename in style_imagenames:
            continue
        changed = bool(ib.get("changedsprites", ""))
        ps_raw = find_template(content, "PuppetStats")
        ps = parse_template_args(ps_raw) if ps_raw else {}
        alt_forms[tab_name] = {
            "sprite": wiki.sprite_urls(imagename, changed)["normal"],
            "stat_ranges": get_stat_ranges_from_template(ps) or get_stat_ranges(content),
        }

    if alt_forms:
        for puppet in mod_puppets:
            if puppet.get("name", "").endswith(f" {char_name}"):
                puppet["alt_forms"] = alt_forms


#  Public entry point 

def enrich_all(data_path: Path = DATA_PATH) -> None:
    """Load the JSON at data_path, enrich all puppets, and save back."""
    with open(data_path) as f:
        data = json.load(f)

    total_done = 0
    base = data["puppets"]
    unique_pages = _build_mod_pages(data["mod_puppets"])
    mod_by_name  = {p["name"]: i for i, p in enumerate(data["mod_puppets"])}
    total = len(base) + len(unique_pages)

    # Imagenames of non-* puppets: used to exclude base-form tabs when enriching * puppets.
    base_imagenames = {p["imagename"] for p in base if not p["name"].endswith("*") and p.get("imagename")}

    print(f"Enriching {len(base)} base puppets...", file=sys.stderr)
    for puppet in base:
        _enrich_one_base(puppet, base_imagenames)
        total_done += 1
        time.sleep(DELAY)
        if total_done % 50 == 0:
            _checkpoint(data, data_path, total_done)

    print(f"Enriching {len(unique_pages)} mod puppet pages...", file=sys.stderr)
    for page_title in unique_pages:
        _enrich_one_mod_page(page_title, data["mod_puppets"], mod_by_name)
        total_done += 1
        time.sleep(DELAY)
        if total_done % 50 == 0:
            _checkpoint(data, data_path, total_done)

    with open(data_path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Done. {total} pages fetched. Saved to {data_path}", file=sys.stderr)




def main():
    enrich_all()


if __name__ == "__main__":
    main()
