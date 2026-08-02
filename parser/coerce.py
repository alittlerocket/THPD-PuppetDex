"""
Value coercion helpers for TPDP wiki table data.
All functions accept str | None and return a typed value or None.
"""


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
