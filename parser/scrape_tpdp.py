#!/usr/bin/env python3
"""
TPDP master-page scraper.
Fetches 7 wiki pages and produces base JSON for all puppets, skills,
abilities, and items.  Outputs JSON to stdout — redirect to save:

    python3 parser/scrape_tpdp.py > data/tpdp_data.json
"""

import re
import json
import sys

from wiki import WikiClient
from wikitext import tabber_section, all_tabber_sections, parse_table
from coerce import to_int, parse_accuracy, parse_price, nullify

wiki = WikiClient()


#  Puppet parser 

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


#  Skill parsers 

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


#  Ability parsers 

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


#  Item parser 

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


#  Scrape functions 

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
    """Run all scrapes and return the complete data dict."""
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




def main():
    print(json.dumps(scrape_all(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
