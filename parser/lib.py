"""
Support library for the scrape pipeline: MediaWiki network I/O, wikitext
parsing, and table-cell value coercion. Pure functions/classes only — no
CLI entry points here, see run_all.py.
"""

import json
import re
import sys
import urllib.request
import urllib.parse
from pathlib import Path


#  MediaWiki API client

class WikiClient:
    BASE = "https://tpdp.miraheze.org"
    API  = f"{BASE}/w/api.php"
    SPR  = f"{BASE}/wiki/Special:FilePath/"
    UA   = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    def fetch_wikitext(self, title: str) -> str | None:
        """Fetch raw wikitext for a wiki page. Returns None if not found."""
        params = urllib.parse.urlencode({
            "action": "query", "prop": "revisions",
            "rvprop": "content", "format": "json", "titles": title,
        })
        req = urllib.request.Request(
            f"{self.API}?{params}", headers={"User-Agent": self.UA}
        )
        try:
            with urllib.request.urlopen(req, timeout=40) as resp:
                data = json.loads(resp.read())
            pages = data["query"]["pages"]
            p = next(iter(pages.values()))
            if "revisions" not in p:
                return None
            return p["revisions"][0]["*"]
        except Exception as e:
            print(f"  ERR fetch({title!r}): {e}", file=sys.stderr)
            return None

    def download_file(self, url: str, dest: Path) -> bool:
        """Download a URL to dest, following redirects. Returns True on success."""
        req = urllib.request.Request(
            self._encode_url(url), headers={"User-Agent": self.UA}
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                ct = resp.headers.get("Content-Type", "")
                if not ct.startswith("image/"):
                    return False
                dest.write_bytes(resp.read())
            return True
        except Exception as e:
            print(f"  ERR download({dest.name!r}): {e}", file=sys.stderr)
            return False

    def sprite_urls(self, imagename: str, changed: bool = False) -> dict[str, str]:
        """
        Build the four sprite URLs for a puppet from its imagename.
        If changed=True, the base sprite uses the 'a' variant (changedsprites flag).
        """
        b = urllib.parse.quote(imagename)
        if changed:
            return {
                "normal":      f"{self.SPR}{b} a.gif",
                "alt_color":   f"{self.SPR}{b} 1a.gif",
                "alt_costume": f"{self.SPR}{b} 2a.gif",
                "wedding":     f"{self.SPR}{b} W.gif",
            }
        return {
            "normal":      f"{self.SPR}{b}.gif",
            "alt_color":   f"{self.SPR}{b} 1.gif",
            "alt_costume": f"{self.SPR}{b} 2.gif",
            "wedding":     f"{self.SPR}{b} W.gif",
        }

    @staticmethod
    def filename_from_url(url: str) -> str:
        """Extract and URL-decode the filename from a Special:FilePath URL."""
        after = url.split("Special:FilePath/", 1)[-1]
        return urllib.parse.unquote(after)

    @staticmethod
    def _encode_url(url: str) -> str:
        """Normalise a Special:FilePath URL: decode fully, then re-encode safely."""
        base = "https://tpdp.miraheze.org/wiki/Special:FilePath/"
        after = url[len(base):]
        return base + urllib.parse.quote(urllib.parse.unquote(after), safe="")


#  Template processing

def strip_templates(s: str) -> str:
    """
    Remove {{...}} template constructs from a string.

    Special case: {{tooltip|first|...}} emits its first argument, which holds
    the SoD 1.103 value when the wiki shows two versions side-by-side.
    Everything else is dropped entirely. Handles arbitrary nesting.
    """
    out: list[str] = []
    i = 0
    while i < len(s):
        if s[i:i+2] == "{{":
            # Walk forward to find the matching }}
            j = i + 2
            depth = 1
            while j < len(s) and depth > 0:
                if s[j:j+2] == "{{":   depth += 1; j += 2
                elif s[j:j+2] == "}}": depth -= 1; j += 2
                else:                              j += 1
            inner = s[i+2 : j-2]
            if inner.lower().startswith("tooltip|"):
                arg = inner[len("tooltip|"):]
                first: list[str] = []
                nd = 0
                for ch in arg:
                    if ch == "{":            nd += 1
                    elif ch == "}":          nd -= 1
                    elif ch == "|" and nd == 0: break
                    first.append(ch)
                out.append("".join(first))
            i = j
        else:
            out.append(s[i]); i += 1
    return "".join(out)


def find_template(wikitext: str, name: str) -> str | None:
    """
    Return the inner content of the first {{name ...}} block.
    Nesting-aware: handles templates-inside-templates correctly.
    """
    pat = re.compile(r"\{\{" + re.escape(name) + r"[\s\n|]", re.IGNORECASE)
    m = pat.search(wikitext)
    if not m:
        return None
    i = m.start() + 2
    depth = 1
    while i < len(wikitext) and depth > 0:
        if wikitext[i:i+2] == "{{":   depth += 1; i += 2
        elif wikitext[i:i+2] == "}}": depth -= 1; i += 2
        else:                                      i += 1
    return wikitext[m.start()+2 : i-2]


def parse_template_args(tmpl: str) -> dict[str, str]:
    """
    Parse | key = value pairs from template content into a dict.
    Handles multi-line values by accumulating continuation lines.
    """
    args: dict[str, str] = {}
    cur_key: str | None = None
    cur_val: list[str] = []
    for line in tmpl.split("\n"):
        s = line.strip()
        if s.startswith("|") and "=" in s:
            if cur_key is not None:
                args[cur_key] = "\n".join(cur_val).strip()
            k, _, v = s[1:].partition("=")
            cur_key = k.strip()
            cur_val = [v.strip()]
        elif cur_key and s:
            cur_val.append(s)
    if cur_key is not None:
        args[cur_key] = "\n".join(cur_val).strip()
    return args


#  Markup cleanup

# Matches leading attribute prefixes like:  style="color:red" |
# or multiple attributes:  scope="col" style="..." |
_ATTR_PREFIX = re.compile(
    r'^\s*(?:[\w-]+\s*=\s*(?:"[^"]*"|\'[^\']*\')\s*;?\s*)+\s*\|\s*'
)


def clean(s: str | None) -> str | None:
    """Strip all wiki/HTML markup and return plain text, or None if empty."""
    if not s:
        return None
    s = strip_templates(s)
    s = re.sub(r"<[^>]+>", "", s)                              # <span>, <br>, etc.
    s = re.sub(r"'{2,3}", "", s)                               # '''bold''' / ''italic''
    s = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", s)  # [[Link|text]] → text
    s = re.sub(r"\{\{[^}]*\}\}", "", s)                        # leftover {{...}}
    s = s.strip()
    return s if s else None


def extract_cell(raw: str | None) -> str | None:
    """
    Clean a raw table cell value.
    Strips the leading attribute prefix (e.g. style="..." |), then all markup.
    Returns None for empty, --, or N/A values.
    """
    if not raw:
        return None
    s = strip_templates(raw)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"'{2,3}", "", s)
    s = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", s)
    s = _ATTR_PREFIX.sub("", s)                                # strip style="..." |
    s = re.sub(r"\{\{[^}]*\}\}", "", s)
    s = s.strip()
    return s if s not in ("--", "N/A", "") else None


#  Cell splitting

def split_cells(line: str) -> list[str]:
    """
    Split a table row by || while respecting {{ }} and [[ ]] nesting.
    A bare || inside a template argument or link is not treated as a separator.
    """
    cells: list[str] = []
    cur: list[str] = []
    brace = bracket = 0
    i = 0
    while i < len(line):
        c2 = line[i:i+2]
        if c2 == "{{":   brace += 1;   cur.append(c2); i += 2
        elif c2 == "}}": brace -= 1;   cur.append(c2); i += 2
        elif c2 == "[[": bracket += 1; cur.append(c2); i += 2
        elif c2 == "]]": bracket -= 1; cur.append(c2); i += 2
        elif c2 == "||" and brace == 0 and bracket == 0:
            cells.append("".join(cur)); cur = []; i += 2
        else:
            cur.append(line[i]); i += 1
    if cur:
        cells.append("".join(cur))
    return cells


#  Tabber

def tabber_section(wikitext: str, tab_name: str) -> str:
    """
    Return the content of a named tabber tab.
    Falls back to the full wikitext if the tab isn't found — useful for
    puppet pages that don't use tabbers (single-version puppets).
    """
    pat = rf"\|-\|{re.escape(tab_name)}\s*=(.*?)(?=\|-\||</tabber>|\Z)"
    m = re.search(pat, wikitext, re.DOTALL)
    return m.group(1) if m else wikitext


def all_tabber_sections(wikitext: str) -> list[tuple[str, str]]:
    """Return all (tab_name, content) pairs from tabber markup."""
    parts = re.split(r"\|-\|([^=\n]+)=", wikitext)
    result = []
    for i in range(1, len(parts), 2):
        name = parts[i].strip()
        content = parts[i+1] if i+1 < len(parts) else ""
        content = re.sub(r"</tabber>.*", "", content, flags=re.DOTALL)
        result.append((name, content))
    return result


#  Table parsing

def parse_table(text: str) -> tuple[list[str], list[list[str | None]]]:
    """
    Parse a MediaWiki wikitable into (headers, data_rows).

    ! cells before any | data cell → column headers.
    ! cells after the first | data cell → treated as regular data cells.

    The second rule handles the Genso Network Puppetdex table, which uses
    ! rowspan="N" | CharacterName in data rows to group styles under one name.
    Without this, the character names would be consumed as extra headers and
    each row would only contain ["Normal"], ["Power"], etc. instead of
    ["Normal Shanghai.EXE"], ["Power Shanghai.EXE"], etc.
    """
    headers: list[str] = []
    rows: list[list[str | None]] = []
    current: list[str | None] = []
    in_table = False
    seen_data = False

    for raw in text.split("\n"):
        line = raw.strip()

        if line.startswith("{|"):
            in_table = True; continue
        if not in_table:
            continue
        if line.startswith("|}"):
            if current: rows.append(current); current = []
            in_table = False; continue
        if re.match(r"^\|-", line):
            if current: rows.append(current); current = []
            continue

        if line.startswith("!"):
            if not seen_data:
                for p in re.split(r"\s*!!\s*", line[1:]):
                    h = extract_cell(p)
                    if h is not None: headers.append(h)
            else:
                current.append(extract_cell(line[1:]))
            continue

        if line.startswith("|"):
            seen_data = True
            for part in split_cells(line[1:]):
                current.append(extract_cell(part))

    if current:
        rows.append(current)
    return headers, rows


def all_tables(content: str) -> list[str]:
    """Extract all {| ... |} raw table blocks from wikitext."""
    out: list[str] = []
    i = 0
    while True:
        ts = content.find("{|", i)
        if ts == -1: break
        te = content.find("|}", ts)
        if te == -1: break
        out.append(content[ts:te+2])
        i = te + 2
    return out


#  Value coercion

def to_int(v: str | None) -> int | None:
    """Convert a cell string to int. Handles --, N/A, and leading + sign."""
    if not v:
        return None
    v = v.strip().lstrip("+")
    if v in ("--", "N/A", ""):
        return None
    try:
        return int(v)
    except ValueError:
        return None


def parse_accuracy(v: str | None) -> int | None:
    """Convert '100%' → 100. Strips the percent sign before coercing."""
    if not v:
        return None
    return to_int(v.strip().rstrip("%"))


def parse_price(v: str | None) -> int | None:
    """
    Convert '15,000円' → 15000.
    Returns None for items that have no purchase price (--, N/A, empty).
    """
    if not v:
        return None
    v = v.strip().replace("円", "").replace(",", "").strip()
    return to_int(v)


def nullify(v: str | None) -> str | None:
    """Return None for empty/placeholder strings; strip whitespace otherwise."""
    if v is None:
        return None
    v = v.strip()
    return None if v.lower() in ("none", "n/a", "–", "--", "") else v
