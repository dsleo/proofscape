#!/usr/bin/env python3
"""Helpers for the verbatim-proof extraction pass (one process per agent).

  python3 scripts/verbatim_tools.py fetch URL OUTDIR      -> OUTDIR/<n>.dat + prints type/size
  python3 scripts/verbatim_tools.py text FILE             -> prints plain text (HTML via bs4 with MathML flattened, PDF via pdftotext -layout)
  python3 scripts/verbatim_tools.py pages PDF FIRST LAST OUTDIR [DPI]  -> renders PNG pages with ghostscript (view them with the Read tool)
  python3 scripts/verbatim_tools.py slice TEXTFILE START END  -> prints text from START through END (whitespace tolerant)
  python3 scripts/verbatim_tools.py shot URL OUT.png [WIDTH HEIGHT]  -> headless-Chrome screenshot of a web page (default 1000x3000)
  python3 scripts/verbatim_tools.py crop IN.png OUT.png X Y W H      -> crop (pixels), trims and quantizes for small files
  python3 scripts/verbatim_tools.py find PDF "phrase"                -> 1-based PDF page numbers whose text layer contains the phrase
Proof excerpt images go in data/collection/proof-images/<routeId>-<k>.png (<= ~1100 px wide, <= ~1.2 MB each).
Slice exact markers rather than retyping whenever the text layer is clean.
"""
import re, subprocess, sys, hashlib
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

def fetch(url, outdir):
    out = Path(outdir); out.mkdir(parents=True, exist_ok=True)
    name = hashlib.md5(url.encode()).hexdigest()[:10] + ".dat"
    p = out / name
    r = subprocess.run(["curl", "-sL", "-m", "60", "-A", "Mozilla/5.0 (Macintosh)", "-o", str(p), "-w", "%{http_code} %{content_type} %{size_download}", url], capture_output=True, text=True)
    print(f"{r.stdout.strip()} {p}")
    return p

def text(path):
    p = Path(path)
    head = p.read_bytes()[:5]
    if head == b"%PDF-":
        return subprocess.run(["pdftotext", "-layout", str(p), "-"], capture_output=True).stdout.decode("utf-8", "replace")
    from verbatim_html2text import conv
    return conv(str(p))

def pages(pdf, first, last, outdir, dpi="100"):
    Path(outdir).mkdir(parents=True, exist_ok=True)
    subprocess.run(["gs", "-q", "-dNOPAUSE", "-dBATCH", "-sDEVICE=png16m", f"-r{dpi}", f"-dFirstPage={first}", f"-dLastPage={last}", f"-sOutputFile={outdir}/p%d.png", pdf], check=True)
    print(f"rendered pages {first}-{last} to {outdir}/p1.png ... (numbering restarts at 1)")

def rx(s): return re.compile(r"\s+".join(re.escape(w) for w in s.split()))

def slice_(t, a, b):
    m = rx(a).search(t); e = rx(b).search(t, m.end())
    return t[m.start():e.end()].strip()

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

def shot(url, out, w="1000", h="3000"):
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=8000", f"--window-size={w},{h}", f"--screenshot={out}", url], capture_output=True, timeout=120)
    print("wrote", out)

def crop(src, out, x, y, w, h):
    subprocess.run(["magick", src, "-crop", f"{w}x{h}+{x}+{y}", "+repage", "-trim", "+repage", "-bordercolor", "white", "-border", "12", "-colors", "64", "-strip", out], check=True)
    print("wrote", out)

def find(pdf, phrase):
    t = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True).stdout.decode("utf-8", "replace").split("\f")
    r = rx(phrase)
    print([i + 1 for i, p in enumerate(t) if r.search(p)])

if __name__ == "__main__":
    c = sys.argv[1]
    if c == "fetch": fetch(sys.argv[2], sys.argv[3])
    elif c == "text": print(text(sys.argv[2]))
    elif c == "pages": pages(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], *(sys.argv[6:7]))
    elif c == "shot": shot(*sys.argv[2:])
    elif c == "crop": crop(*sys.argv[2:])
    elif c == "find": find(sys.argv[2], sys.argv[3])
    elif c == "slice": print(slice_(Path(sys.argv[2]).read_text(errors="replace"), sys.argv[3], sys.argv[4]))
