"""
TPDP scrape pipeline: master pages, per-puppet detail pages, and sprites.
No CLI entry point here — called from run_all.py.
"""

import re
import json
import sys
import time
from pathlib import Path

from lib import (
    WikiClient,
    tabber_section, all_tabber_sections, parse_table, all_tables,
    find_template, parse_template_args, clean,
    to_int, parse_accuracy, parse_price, nullify,
)

wiki = WikiClient()

DATA_PATH   = Path(__file__).parent.parent / "data" / "tpdp_data.json"
SPRITES_DIR = Path(__file__).parent.parent / "data" / "sprites"
SPRITE_KEYS = ("normal", "alt_color", "alt_costume", "wedding")
PAGE_DELAY   = 0.35  # between per-puppet detail page fetches
SPRITE_DELAY = 0.10  # between sprite downloads
STYLE_PREFIXES = ["Normal", "Defense", "Power", "Extra", "Speed", "Assist"]


#  Master page: puppet table parser

def parse_puppets(tab_content: str) -> list[dict]:
    """
    Parse a Puppetdex table tab into a list of puppet dicts.

    Two table layouts exist:
    - Standard (SoD base / SoD Extended):
        Columns: ID, Name, Type1, Type2, HP, Fo.Atk, Fo.Def, Sp.Atk, Sp.Def, Spd, BST, Cost, Ability1, Ability2
    - Style layout (Genso Network / FanChara):
        Columns: ID, [CharName], Style, Type1, ...
        CharName appears only on the first row for each character (rowspan);
        subsequent rows for the same character omit it (14 cells instead of 15).
    """
    headers, rows = parse_table(tab_content)
    style_layout = any(h is not None and h.strip().lower() == "style" for h in headers)

    puppets: list[dict] = []
    current_char: str | None = None

    for row in rows:
        if not row or not any(row):
            continue
        raw_id = row[0]
        if not raw_id or not re.match(r"^\d+$", raw_id.strip()):
            continue

        if style_layout:
            if len(row) >= 15:
                # First row for this character — name cell present
                current_char = nullify(row[1])
                off = 2
            else:
                # Continuation row — name carried from the rowspan above
                off = 1

            style = nullify(row[off]) if len(row) > off else None
            name = f"{style} {current_char}" if style and current_char else style or current_char

            puppets.append({
                "id":       int(raw_id.strip()),
                "name":     name,
                "type1":    nullify(row[off + 1]) if len(row) > off + 1 else None,
                "type2":    nullify(row[off + 2]) if len(row) > off + 2 else None,
                "hp":       to_int(row[off + 3]) if len(row) > off + 3 else None,
                "fo_atk":   to_int(row[off + 4]) if len(row) > off + 4 else None,
                "fo_def":   to_int(row[off + 5]) if len(row) > off + 5 else None,
                "sp_atk":   to_int(row[off + 6]) if len(row) > off + 6 else None,
                "sp_def":   to_int(row[off + 7]) if len(row) > off + 7 else None,
                "spd":      to_int(row[off + 8]) if len(row) > off + 8 else None,
                "bst":      to_int(row[off + 9]) if len(row) > off + 9 else None,
                "cost":     to_int(row[off + 10]) if len(row) > off + 10 else None,
                "ability1": nullify(row[off + 11]) if len(row) > off + 11 else None,
                "ability2": nullify(row[off + 12]) if len(row) > off + 12 else None,
            })
        else:
            puppets.append({
                "id":       int(raw_id.strip()),
                "name":     nullify(row[1]) if len(row) > 1 else None,
                "type1":    nullify(row[2]) if len(row) > 2 else None,
                "type2":    nullify(row[3]) if len(row) > 3 else None,
                "hp":       to_int(row[4]) if len(row) > 4 else None,
                "fo_atk":   to_int(row[5]) if len(row) > 5 else None,
                "fo_def":   to_int(row[6]) if len(row) > 6 else None,
                "sp_atk":   to_int(row[7]) if len(row) > 7 else None,
                "sp_def":   to_int(row[8]) if len(row) > 8 else None,
                "spd":      to_int(row[9]) if len(row) > 9 else None,
                "bst":      to_int(row[10]) if len(row) > 10 else None,
                "cost":     to_int(row[11]) if len(row) > 11 else None,
                "ability1": nullify(row[12]) if len(row) > 12 else None,
                "ability2": nullify(row[13]) if len(row) > 13 else None,
            })
    return puppets


#  Master page: skill parsers

def parse_skills_base(tab_content: str) -> list[dict]:
    """Parse the SoD 1.103 skills table (includes JP name column)."""
    _, rows = parse_table(tab_content)
    skills = []
    for row in rows:
        name = nullify(row[0]) if row else None
        if not name:
            continue
        skills.append({
            "name":        name,
            "jp_name":     nullify(row[1]) if len(row) > 1 else None,
            "type":        nullify(row[2]) if len(row) > 2 else None,
            "category":    nullify(row[3]) if len(row) > 3 else None,
            "class":       nullify(row[4]) if len(row) > 4 else None,
            "power":       to_int(row[5]) if len(row) > 5 else None,
            "accuracy":    parse_accuracy(row[6]) if len(row) > 6 else None,
            "max_sp":      to_int(row[7]) if len(row) > 7 else None,
            "priority":    to_int(row[8]) if len(row) > 8 else None,
            "description": nullify(row[9]) if len(row) > 9 else None,
        })
    return skills


def parse_skills_mod(tab_content: str) -> list[dict]:
    """Parse a mod skills table (no JP name column)."""
    _, rows = parse_table(tab_content)
    skills = []
    for row in rows:
        name = nullify(row[0]) if row else None
        if not name:
            continue
        skills.append({
            "name":        name,
            "type":        nullify(row[1]) if len(row) > 1 else None,
            "category":    nullify(row[2]) if len(row) > 2 else None,
            "class":       nullify(row[3]) if len(row) > 3 else None,
            "power":       to_int(row[4]) if len(row) > 4 else None,
            "accuracy":    parse_accuracy(row[5]) if len(row) > 5 else None,
            "max_sp":      to_int(row[6]) if len(row) > 6 else None,
            "priority":    to_int(row[7]) if len(row) > 7 else None,
            "description": nullify(row[8]) if len(row) > 8 else None,
        })
    return skills


#  Master page: ability parsers

def parse_abilities_base(tab_content: str) -> list[dict]:
    """
    Parse the SoD abilities table.
    The table has 6 columns — three name/effect pairs per row — so each
    physical row produces up to three ability dicts.
    """
    _, rows = parse_table(tab_content)
    abilities = []
    for row in rows:
        for offset in range(0, 6, 2):
            name = nullify(row[offset]) if len(row) > offset else None
            if not name:
                continue
            abilities.append({
                "name":   name,
                "effect": nullify(row[offset + 1]) if len(row) > offset + 1 else None,
            })
    return abilities


def parse_abilities_mod(tab_content: str) -> list[dict]:
    """Parse a mod abilities table (2 columns: name, effect)."""
    _, rows = parse_table(tab_content)
    abilities = []
    for row in rows:
        name = nullify(row[0]) if row else None
        if not name:
            continue
        abilities.append({
            "name":   name,
            "effect": nullify(row[1]) if len(row) > 1 else None,
        })
    return abilities


#  Master page: item parser

def parse_items(wikitext: str) -> list[dict]:
    """
    Parse the Items page.
    Sections use ==Level 2== and ===Level 3=== headers for categories.
    All tables share columns: Name, Japanese Name, Description, Price.
    """
    items: list[dict] = []
    segments = re.split(r"(={2,3}[^=\n]+={2,3})", wikitext)

    section = "Unknown"
    subsection: str | None = None

    for seg in segments:
        seg_stripped = seg.strip()

        m3 = re.match(r"^===([^=]+)===$", seg_stripped)
        m2 = re.match(r"^==([^=]+)==$", seg_stripped)
        if m3:
            subsection = m3.group(1).strip(); continue
        if m2:
            section = m2.group(1).strip(); subsection = None; continue

        for table_text in re.findall(r"\{\|.*?\|\}", seg, re.DOTALL):
            _, rows = parse_table(table_text)
            for row in rows:
                if not row or not any(row):
                    continue
                name = nullify(row[0])
                if not name or name.lower() in (
                    "name", "japanese name", "description", "price", "effect", "card"
                ):
                    continue
                name = re.sub(r"\[.*?\]", "", name).strip() or None
                items.append({
                    "name":        name,
                    "jp_name":     nullify(row[1]) if len(row) > 1 else None,
                    "description": nullify(row[2]) if len(row) > 2 else None,
                    "price":       parse_price(row[3]) if len(row) > 3 else None,
                    "category":    subsection or section,
                })

    return items


#  Master page: scrape functions

def scrape_puppets() -> tuple[list[dict], list[dict]]:
    """Fetch and parse the base and mod Puppetdex pages."""
    raw = wiki.fetch_wikitext("Puppetdex")
    base = parse_puppets(tabber_section(raw, "SoD 1.103"))

    raw = wiki.fetch_wikitext("Mod:Mod_Puppetdex")
    mod: list[dict] = []
    for tab_name, tab_content in all_tabber_sections(raw):
        if "quick select" in tab_name.lower():
            continue
        puppets = parse_puppets(tab_content)
        for p in puppets:
            p["mod_tab"] = tab_name
        mod.extend(puppets)

    print(f"Puppets: {len(base)} base, {len(mod)} mod", file=sys.stderr)
    return base, mod


def scrape_skills() -> tuple[list[dict], list[dict]]:
    """Fetch and parse the base SoD and mod skills pages."""
    raw = wiki.fetch_wikitext("Skills")
    base = parse_skills_base(tabber_section(raw, "SoD 1.103"))

    raw = wiki.fetch_wikitext("Mod:_Mod_Skills")
    mod: list[dict] = []
    for tab_name, tab_content in all_tabber_sections(raw):
        skills = parse_skills_mod(tab_content)
        for s in skills:
            s["mod_tab"] = tab_name
        mod.extend(skills)

    print(f"Skills: {len(base)} base, {len(mod)} mod", file=sys.stderr)
    return base, mod


def scrape_abilities() -> tuple[list[dict], list[dict]]:
    """Fetch and parse the base SoD and mod abilities pages."""
    raw = wiki.fetch_wikitext("Abilities")
    base = parse_abilities_base(tabber_section(raw, "SoD 1.103"))

    raw = wiki.fetch_wikitext("Mod:Abilities")
    mod: list[dict] = []
    for tab_name, tab_content in all_tabber_sections(raw):
        abilities = parse_abilities_mod(tab_content)
        for a in abilities:
            a["mod_tab"] = tab_name
        mod.extend(abilities)

    print(f"Abilities: {len(base)} base, {len(mod)} mod", file=sys.stderr)
    return base, mod


def scrape_items() -> list[dict]:
    """Fetch and parse the Items page."""
    raw = wiki.fetch_wikitext("Items")
    items = parse_items(raw)
    print(f"Items: {len(items)}", file=sys.stderr)
    return items


def scrape_all() -> dict:
    """Run all master-page scrapes and return the complete data dict."""
    puppets, mod_puppets       = scrape_puppets()
    skills, mod_skills         = scrape_skills()
    abilities, mod_abilities   = scrape_abilities()
    return {
        "puppets":      puppets,
        "mod_puppets":  mod_puppets,
        "skills":       skills,
        "mod_skills":   mod_skills,
        "abilities":    abilities,
        "mod_abilities": mod_abilities,
        "items":        scrape_items(),
    }


#  Per-puppet detail extractors

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


#  Per-puppet section parsers

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


#  Per-puppet enrich helpers

def _checkpoint(data: dict, path: Path, done: int) -> None:
    with open(path, "w", encoding="utf-8") as f:
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


def enrich_all(data_path: Path = DATA_PATH) -> None:
    """Load the JSON at data_path, enrich all puppets with per-page detail, and save back."""
    with open(data_path, encoding="utf-8") as f:
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
        time.sleep(PAGE_DELAY)
        if total_done % 50 == 0:
            _checkpoint(data, data_path, total_done)

    print(f"Enriching {len(unique_pages)} mod puppet pages...", file=sys.stderr)
    for page_title in unique_pages:
        _enrich_one_mod_page(page_title, data["mod_puppets"], mod_by_name)
        total_done += 1
        time.sleep(PAGE_DELAY)
        if total_done % 50 == 0:
            _checkpoint(data, data_path, total_done)

    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Done. {total} pages fetched. Saved to {data_path}", file=sys.stderr)


#  Sprite download

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
        time.sleep(SPRITE_DELAY)
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


def download_all_sprites(data_path: Path = DATA_PATH) -> None:
    """Download all sprites and rewrite the JSON at data_path with local filenames."""
    SPRITES_DIR.mkdir(parents=True, exist_ok=True)

    with open(data_path, encoding="utf-8") as f:
        d = json.load(f)

    _rebuild_variant_urls(d)
    queue = _collect_queue(d)
    print(f"Downloading {len(queue)} sprites to {SPRITES_DIR}", file=sys.stderr)

    downloaded, skipped, failed = _download_queue(queue)
    print(f"Done: {downloaded} downloaded, {skipped} skipped, {failed} failed", file=sys.stderr)

    _rewrite_filenames(d)

    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
    print(f"JSON updated: {data_path}", file=sys.stderr)
