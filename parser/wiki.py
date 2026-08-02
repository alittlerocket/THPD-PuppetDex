"""
MediaWiki API client for tpdp.miraheze.org.
Handles all network I/O: page fetching and file downloading.
"""

import json
import sys
import urllib.request
import urllib.parse
from pathlib import Path


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
