import json
import sqlite3
import sys
from pathlib import Path

DATA_JSON = Path(__file__).parent.parent / "data" / "tpdp_data.json"
DATA_DB   = Path(__file__).parent.parent / "data" / "puppetdex.db"
CALC_EXTRAS = Path(__file__).parent.parent / "data" / "calc_extras.json"


SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE puppets (
    rowid        INTEGER PRIMARY KEY,
    id           INTEGER,
    name         TEXT    NOT NULL,
    is_mod       INTEGER NOT NULL DEFAULT 0,
    mod_tab      TEXT,
    type1        TEXT,
    type2        TEXT,
    hp           INTEGER,
    fo_atk       INTEGER,
    fo_def       INTEGER,
    sp_atk       INTEGER,
    sp_def       INTEGER,
    spd          INTEGER,
    bst          INTEGER,
    cost         INTEGER,
    ability1     TEXT,
    ability2     TEXT,
    imagename    TEXT,
    sprite_normal       TEXT,
    sprite_alt_color    TEXT,
    sprite_alt_costume  TEXT,
    sprite_wedding      TEXT,
    jp_name      TEXT,
    lv100_exp    INTEGER,
    low_drops    TEXT,
    high_drops   TEXT,
    style_changes TEXT,
    dex_entry    TEXT,
    stat_ranges  TEXT
);

CREATE TABLE puppet_locations (
    id           INTEGER PRIMARY KEY,
    puppet_rowid INTEGER NOT NULL REFERENCES puppets(rowid),
    location     TEXT,
    level_range  TEXT,
    encounter_rate TEXT
);

CREATE TABLE puppet_learnset (
    id           INTEGER PRIMARY KEY,
    puppet_rowid INTEGER NOT NULL REFERENCES puppets(rowid),
    level        TEXT,
    name         TEXT,
    type         TEXT,
    category     TEXT,
    class        TEXT,
    power        INTEGER,
    accuracy     INTEGER,
    max_sp       INTEGER,
    priority     INTEGER,
    pp           INTEGER
);

CREATE TABLE puppet_skill_cards (
    id           INTEGER PRIMARY KEY,
    puppet_rowid INTEGER NOT NULL REFERENCES puppets(rowid),
    sc           TEXT,
    name         TEXT,
    type         TEXT,
    category     TEXT,
    class        TEXT,
    power        INTEGER,
    accuracy     INTEGER,
    max_sp       INTEGER,
    priority     INTEGER
);

CREATE TABLE puppet_alt_forms (
    id           INTEGER PRIMARY KEY,
    puppet_rowid INTEGER NOT NULL REFERENCES puppets(rowid),
    form_name    TEXT,
    sprite       TEXT,
    stat_ranges  TEXT
);

CREATE TABLE skills (
    id           INTEGER PRIMARY KEY,
    name         TEXT NOT NULL,
    is_mod       INTEGER NOT NULL DEFAULT 0,
    mod_tab      TEXT,
    jp_name      TEXT,
    type         TEXT,
    category     TEXT,
    class        TEXT,
    power        INTEGER,
    accuracy     INTEGER,
    max_sp       INTEGER,
    priority     INTEGER,
    description  TEXT
);

CREATE TABLE abilities (
    id           INTEGER PRIMARY KEY,
    name         TEXT NOT NULL,
    is_mod       INTEGER NOT NULL DEFAULT 0,
    mod_tab      TEXT,
    effect       TEXT
);

CREATE TABLE items (
    id           INTEGER PRIMARY KEY,
    name         TEXT NOT NULL,
    jp_name      TEXT,
    description  TEXT,
    price        INTEGER,
    category     TEXT
);

-- Damage-calculator tables.
-- The wiki publishes neither the type-effectiveness chart nor the mechanical
-- move flags the engine needs, so they are curated in data/calc_extras.json
-- and materialised here. Keeping them in the database means the app has a
-- single source of truth and never ships duplicate copies of game data.
CREATE TABLE type_chart (
    attacking    TEXT NOT NULL,
    defending    TEXT NOT NULL,
    multiplier   REAL NOT NULL,
    PRIMARY KEY (attacking, defending)
);

CREATE TABLE calc_moves (
    name         TEXT PRIMARY KEY,
    type         TEXT,
    category     TEXT,
    bp           INTEGER,
    accuracy     INTEGER,
    -- Remaining engine flags as a JSON object; they are sparse and the set
    -- grows upstream, so columns would mostly be NULL.
    flags        TEXT
);

-- Selectable ability/held-item names, unioned at build time from the dex and
-- the calculator so the app can just query one list.
CREATE TABLE calc_abilities (
    name         TEXT PRIMARY KEY
);

CREATE TABLE calc_items (
    name         TEXT PRIMARY KEY
);

CREATE INDEX idx_puppets_name    ON puppets(name);
CREATE INDEX idx_puppets_type1   ON puppets(type1);
CREATE INDEX idx_puppets_is_mod  ON puppets(is_mod);
CREATE INDEX idx_puppets_mod_tab ON puppets(mod_tab);
CREATE INDEX idx_puppet_locations_rowid   ON puppet_locations(puppet_rowid);
CREATE INDEX idx_puppet_learnset_rowid    ON puppet_learnset(puppet_rowid);
CREATE INDEX idx_puppet_skill_cards_rowid ON puppet_skill_cards(puppet_rowid);
CREATE INDEX idx_puppet_alt_forms_rowid   ON puppet_alt_forms(puppet_rowid);
"""


def _insert_puppet(cur: sqlite3.Cursor, p: dict, is_mod: bool) -> int:
    sp = p.get("sprites") or {}
    cur.execute("""
        INSERT INTO puppets (
            id, name, is_mod, mod_tab,
            type1, type2, hp, fo_atk, fo_def, sp_atk, sp_def, spd, bst, cost,
            ability1, ability2, imagename,
            sprite_normal, sprite_alt_color, sprite_alt_costume, sprite_wedding,
            jp_name, lv100_exp, low_drops, high_drops,
            style_changes, dex_entry, stat_ranges
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        p.get("id"), p["name"], int(is_mod), p.get("mod_tab"),
        p.get("type1"), p.get("type2"),
        p.get("hp"), p.get("fo_atk"), p.get("fo_def"),
        p.get("sp_atk"), p.get("sp_def"), p.get("spd"),
        p.get("bst"), p.get("cost"),
        p.get("ability1"), p.get("ability2"), p.get("imagename"),
        sp.get("normal"), sp.get("alt_color"), sp.get("alt_costume"), sp.get("wedding"),
        p.get("jp_name"), p.get("lv100_exp"),
        p.get("low_drops"), p.get("high_drops"),
        json.dumps(p.get("style_changes")) if p.get("style_changes") else None,
        p.get("dex_entry"),
        json.dumps(p.get("stat_ranges")) if p.get("stat_ranges") else None,
    ))
    return cur.lastrowid


def _insert_puppet_details(cur: sqlite3.Cursor, rowid: int, p: dict) -> None:
    for loc in p.get("locations") or []:
        cur.execute(
            "INSERT INTO puppet_locations (puppet_rowid, location, level_range, encounter_rate) VALUES (?,?,?,?)",
            (rowid, loc.get("location"), loc.get("level_range"), loc.get("encounter_rate")),
        )

    for sk in p.get("level_up_skills") or []:
        cur.execute("""
            INSERT INTO puppet_learnset
                (puppet_rowid, level, name, type, category, class, power, accuracy, max_sp, priority, pp)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (
            rowid, sk.get("level"), sk.get("name"), sk.get("type"), sk.get("category"),
            sk.get("class"), sk.get("power"), sk.get("accuracy"),
            sk.get("max_sp"), sk.get("priority"), sk.get("pp"),
        ))

    for sc in p.get("skill_cards") or []:
        cur.execute("""
            INSERT INTO puppet_skill_cards
                (puppet_rowid, sc, name, type, category, class, power, accuracy, max_sp, priority)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (
            rowid, sc.get("sc"), sc.get("name"), sc.get("type"), sc.get("category"),
            sc.get("class"), sc.get("power"), sc.get("accuracy"),
            sc.get("max_sp"), sc.get("priority"),
        ))

    for form_name, form in (p.get("alt_forms") or {}).items():
        cur.execute(
            "INSERT INTO puppet_alt_forms (puppet_rowid, form_name, sprite, stat_ranges) VALUES (?,?,?,?)",
            (rowid, form_name, form.get("sprite"),
             json.dumps(form.get("stat_ranges")) if form.get("stat_ranges") else None),
        )


# Held-item categories; the rest are skill cards, key items and consumables
# that can't be equipped in battle.
_HELD_CATEGORIES = ("Hold 1", "Hold 2")


def _derive_move_fields(name: str, type_: str | None, category: str | None,
                        cls: str | None, power: int | None, accuracy: int | None,
                        priority: int | None) -> dict:
    """
    Reconstruct the calculator's move fields from scraped dex columns.

    These are all recoverable, so they are not duplicated in calc_extras.json:
      bp          power, except NULL means 0 for Status moves and 1 for damaging
                  ones -- the engine treats 1 as "power computed at runtime" and
                  returns no damage at all on 0.
      acc100      accuracy == 100
      isEN        class == 'EN'
      isVoid      type == 'Void'
      isJavelin   name ends with ' Javelin'
      priority    only when positive; the engine just asks "does this go first?"
    """
    cat = category if category in ("Focus", "Spread") else "Status"
    bp = power if power is not None else (0 if cat == "Status" else 1)

    derived: dict = {"type": type_, "category": cat, "bp": bp}
    if accuracy is not None:
        if accuracy == 100:
            derived["acc100"] = True
        else:
            derived["accuracy"] = accuracy
    if cls == "EN":
        derived["isEN"] = True
    if type_ == "Void":
        derived["isVoid"] = True
    if name.endswith(" Javelin"):
        derived["isJavelin"] = True
    if priority and priority > 0:
        derived["priority"] = priority
    return derived


def _insert_calc_data(cur: sqlite3.Cursor) -> None:
    if not CALC_EXTRAS.exists():
        raise FileNotFoundError(
            f"{CALC_EXTRAS} is missing, so the calculator tables cannot be built. "
            "It is committed to the repo -- check it wasn't excluded by .gitignore."
        )

    with open(CALC_EXTRAS, encoding="utf-8") as f:
        extras = json.load(f)

    for attacking, row in extras["type_chart"].items():
        for defending, multiplier in row.items():
            cur.execute(
                "INSERT INTO type_chart (attacking, defending, multiplier) VALUES (?,?,?)",
                (attacking, defending, multiplier),
            )

    move_flags = extras["move_flags"]
    seen: set[str] = set()
    rows = cur.execute(
        "SELECT DISTINCT name, type, category, class, power, accuracy, priority FROM skills"
    ).fetchall()
    for name, type_, category, cls, power, accuracy, priority in rows:
        if name in seen:
            continue
        seen.add(name)
        move = _derive_move_fields(name, type_, category, cls, power, accuracy, priority)
        move.update(move_flags.get(name, {}))
        flags = {k: v for k, v in move.items()
                 if k not in ("type", "category", "bp", "accuracy")}
        cur.execute(
            "INSERT INTO calc_moves (name, type, category, bp, accuracy, flags) VALUES (?,?,?,?,?,?)",
            (name, move["type"], move["category"], move["bp"], move.get("accuracy"),
             json.dumps(flags) if flags else None),
        )

    # A handful of curated moves aren't in the dex at all; keep them as-is.
    for name, move in move_flags.items():
        if name in seen:
            continue
        flags = {k: v for k, v in move.items()
                 if k not in ("type", "category", "bp", "accuracy")}
        cur.execute(
            "INSERT INTO calc_moves (name, type, category, bp, accuracy, flags) VALUES (?,?,?,?,?,?)",
            (name, move.get("type"), move.get("category"), move.get("bp"),
             move.get("accuracy"), json.dumps(flags) if flags else None),
        )
        seen.add(name)

    # Union the dex's own names with the few the calculator needs but the dex lacks.
    abilities = set(extras["extra_abilities"])
    abilities.update(n for (n,) in cur.execute("SELECT name FROM abilities WHERE name IS NOT NULL"))
    for name in sorted(abilities):
        cur.execute("INSERT INTO calc_abilities (name) VALUES (?)", (name,))

    placeholders = ",".join("?" * len(_HELD_CATEGORIES))
    items = set(extras["extra_items"])
    items.update(n for (n,) in cur.execute(
        f"SELECT name FROM items WHERE name IS NOT NULL AND category IN ({placeholders})",
        _HELD_CATEGORIES,
    ))
    for name in sorted(items):
        cur.execute("INSERT INTO calc_items (name) VALUES (?)", (name,))

    print(f"  calc:      {len(seen)} moves ({len(move_flags)} with curated flags), "
          f"{len(abilities)} abilities, {len(items)} items, "
          f"{len(extras['type_chart'])} types", file=sys.stderr)


def build(data_json: Path = DATA_JSON, data_db: Path = DATA_DB) -> None:
    with open(data_json, encoding="utf-8") as f:
        data = json.load(f)

    data_db.unlink(missing_ok=True)
    con = sqlite3.connect(data_db)
    cur = con.cursor()
    cur.executescript(SCHEMA)

    for p in data["puppets"]:
        rowid = _insert_puppet(cur, p, is_mod=False)
        _insert_puppet_details(cur, rowid, p)

    for p in data["mod_puppets"]:
        rowid = _insert_puppet(cur, p, is_mod=True)
        _insert_puppet_details(cur, rowid, p)

    for sk in data["skills"]:
        cur.execute(
            "INSERT INTO skills (name, is_mod, jp_name, type, category, class, power, accuracy, max_sp, priority, description) VALUES (?,0,?,?,?,?,?,?,?,?,?)",
            (sk["name"], sk.get("jp_name"), sk.get("type"), sk.get("category"), sk.get("class"),
             sk.get("power"), sk.get("accuracy"), sk.get("max_sp"), sk.get("priority"), sk.get("description")),
        )
    for sk in data["mod_skills"]:
        cur.execute(
            "INSERT INTO skills (name, is_mod, mod_tab, type, category, class, power, accuracy, max_sp, priority, description) VALUES (?,1,?,?,?,?,?,?,?,?,?)",
            (sk["name"], sk.get("mod_tab"), sk.get("type"), sk.get("category"), sk.get("class"),
             sk.get("power"), sk.get("accuracy"), sk.get("max_sp"), sk.get("priority"), sk.get("description")),
        )

    for ab in data["abilities"]:
        cur.execute("INSERT INTO abilities (name, is_mod, effect) VALUES (?,0,?)", (ab["name"], ab.get("effect")))
    for ab in data["mod_abilities"]:
        cur.execute("INSERT INTO abilities (name, is_mod, mod_tab, effect) VALUES (?,1,?,?)", (ab["name"], ab.get("mod_tab"), ab.get("effect")))

    for it in data["items"]:
        cur.execute(
            "INSERT INTO items (name, jp_name, description, price, category) VALUES (?,?,?,?,?)",
            (it["name"], it.get("jp_name"), it.get("description"), it.get("price"), it.get("category")),
        )

    _insert_calc_data(cur)

    con.commit()
    con.close()

    print(f"Built {data_db}", file=sys.stderr)
    print(f"  puppets:   {len(data['puppets'])} base, {len(data['mod_puppets'])} mod", file=sys.stderr)
    print(f"  skills:    {len(data['skills'])} base, {len(data['mod_skills'])} mod", file=sys.stderr)
    print(f"  abilities: {len(data['abilities'])} base, {len(data['mod_abilities'])} mod", file=sys.stderr)
    print(f"  items:     {len(data['items'])}", file=sys.stderr)
