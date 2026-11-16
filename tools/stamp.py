#!/usr/bin/env python3
"""Stamps every page with a version code so browsers never run stale code.

Browsers keep copies of script and style files. Without this, a browser can
mix an old copy of one file with a new copy of another, and a page breaks.
Each page tells the browser to load every file as "file.js?v=<code>"; the code
changes whenever any file in js/ or css/ changes, which forces a fresh download.

Run after changing anything in js/ or css/:   python3 tools/stamp.py
"""
import hashlib
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
scripts = sorted((root / "js").glob("*.js"))
styles = sorted((root / "css").glob("*.css"))

digest = hashlib.sha256()
for path in scripts + styles:
    digest.update(path.name.encode())
    digest.update(path.read_bytes())
version = digest.hexdigest()[:10]

imports = {f"./js/{p.name}": f"./js/{p.name}?v={version}" for p in scripts}
block = (
    "<!-- version:start (written by tools/stamp.py; do not edit by hand) -->\n"
    '    <script type="importmap">\n'
    + "\n".join("      " + line for line in json.dumps({"imports": imports}, indent=2).splitlines())
    + "\n    </script>\n"
    "    <!-- version:end -->"
)

for page in sorted(root.glob("*.html")):
    html = page.read_text()
    if "<!-- version:start" in html:
        html = re.sub(r"<!-- version:start.*?<!-- version:end -->", lambda _: block, html, flags=re.S)
    else:
        html = html.replace("</head>", f"  {block}\n  </head>", 1)
    html = re.sub(r'(href="css/[\w.-]+\.css)(\?v=\w+)?"', rf'\1?v={version}"', html)
    html = re.sub(r'(src="js/[\w.-]+\.js)(\?v=\w+)?"', rf'\1?v={version}"', html)
    page.write_text(html)
    print(f"stamped {page.name}")
print(f"version {version}")
