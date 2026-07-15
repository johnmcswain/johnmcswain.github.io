#!/usr/bin/env python3
"""
build.py — dual-deliverable pipeline:
    dist/orbita.html + dist/js/**   native ES modules: the browser resolves
        the import graph itself, so the deployed code IS the source —
        const/let preserved, readable on GitHub Pages. type="module" will
        not run from file:// ; serve locally (python3 -m http.server) or
        deploy. Ship orbita.html and js/ together.
    dist/sketch.js   flat IIFE for the p5.js Web Editor. The var bindings
        in it are esbuild's generated lowering (esbuild rewrites top-level
        module bindings to var when bundling, every format) — generated
        artifact, not source style.
Run `node test/smoke.mjs` first — the suite imports src/ directly.
"""
import pathlib, re, shutil, subprocess, sys

ROOT = pathlib.Path(__file__).parent

def run():
    # guard: source must be var-free (declarations; property names excused)
    for f in (ROOT / "src").rglob("*.js"):
        if re.search(r"\bvar\s+\w", f.read_text()):
            sys.exit(f"var declaration in {f} — use let/const")

    dist = ROOT / "dist"
    if (dist / "js").exists():
        shutil.rmtree(dist / "js")
    shutil.copytree(ROOT / "src", dist / "js")
    shutil.copy(ROOT / "template.html", dist / "orbita.html")
    n = sum(1 for _ in (dist / "js").rglob("*.js"))
    print(f"deployed {n} ES modules -> dist/js/ + dist/orbita.html")

    r = subprocess.run(
        ["npx", "esbuild", "src/main.js", "--bundle", "--format=iife",
         "--charset=utf8", "--outfile=dist/sketch.js"],
        cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr)
    print(r.stderr.strip() or "bundled dist/sketch.js (p5 editor)")

if __name__ == "__main__":
    run()
