#!/usr/bin/env python3
"""
Check relative paths in student HTML submissions for Assignment 2.

Usage:
    python check_paths.py <student_dir>          # grade one student
    python check_paths.py <subs_dir> --all       # grade every student in subs_dir
"""

import os
import re
import sys
from pathlib import Path

# Local resource patterns that must NOT be absolute paths
FORBIDDEN_PREFIXES = re.compile(r'^([A-Za-z]:[/\\]|/)')

# Attributes to extract and what type they are
IMG_SRC    = re.compile(r'<img\b[^>]+\bsrc=["\']([^"\']+)["\']', re.IGNORECASE)
CSS_HREF   = re.compile(
    r'<link\b[^>]+\brel=["\']stylesheet["\'][^>]+\bhref=["\']([^"\']+)["\']'
    r'|<link\b[^>]+\bhref=["\']([^"\']+)["\'][^>]+\brel=["\']stylesheet["\']',
    re.IGNORECASE,
)
A_HREF     = re.compile(r'<a\b[^>]+\bhref=["\']([^"\']+)["\']', re.IGNORECASE)
TARGET_BLANK = re.compile(r'target=["\']_blank["\']', re.IGNORECASE)


def check_submission(student_dir: Path):
    errors = []
    notes  = []

    html_files = sorted(student_dir.rglob("*.html"))

    if not html_files:
        errors.append("No HTML files found")
        return errors, notes

    img_count  = 0
    css_count  = 0
    link_count = 0

    for html_file in html_files:
        html_dir = html_file.parent
        label    = str(html_file.relative_to(student_dir))
        text     = html_file.read_text(encoding="utf-8", errors="replace")

        # --- target="_blank" check ---
        if TARGET_BLANK.search(text):
            errors.append(f"{label}: uses target=\"_blank\" (not allowed)")

        # --- CSS links ---
        for m in CSS_HREF.finditer(text):
            href = m.group(1) or m.group(2)
            css_count += 1
            _check(href, "CSS", label, html_dir, student_dir, errors, notes)

        # --- Images ---
        for m in IMG_SRC.finditer(text):
            src = m.group(1)
            img_count += 1
            _check(src, "img", label, html_dir, student_dir, errors, notes)

        # --- Hyperlinks (skip external) ---
        for m in A_HREF.finditer(text):
            href = m.group(1)
            if href.startswith(("http://", "https://", "mailto:", "#", "javascript:")):
                continue
            link_count += 1
            _check(href, "link", label, html_dir, student_dir, errors, notes)

    # Expected counts from the assignment rubric
    expected = {"img": 12, "CSS": 8, "link": 14}
    actual   = {"img": img_count, "CSS": css_count, "link": link_count}
    for kind, exp in expected.items():
        got = actual[kind]
        if got != exp:
            notes.append(
                f"Count mismatch — expected {exp} {kind} paths, found {got}"
            )

    return errors, notes


def _check(path, kind, label, html_dir, student_dir, errors, notes):
    if FORBIDDEN_PREFIXES.match(path):
        errors.append(f"{label}: {kind} absolute path → {path}")
        return

    resolved = (html_dir / path).resolve()
    if not resolved.exists():
        errors.append(f"{label}: {kind} broken → {path}")
        return

    # Warn if path escapes the submission folder
    try:
        resolved.relative_to(student_dir.resolve())
    except ValueError:
        errors.append(f"{label}: {kind} escapes submission dir → {path}")


def grade(student_dir: Path):
    errors, notes = check_submission(student_dir)
    name = student_dir.name

    print(f"\n{'─'*60}")
    print(f"  {name}")
    print(f"{'─'*60}")

    if not errors and not notes:
        print("  ✓ All paths correct")
    else:
        for e in errors:
            print(f"  ERROR  {e}")
        for n in notes:
            print(f"  NOTE   {n}")

    status = "PASS" if not errors else f"FAIL ({len(errors)} errors)"
    if notes:
        status += f" + {len(notes)} notes"
    print(f"  → {status}")
    return errors, notes


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    target = Path(sys.argv[1])

    if "--all" in sys.argv:
        results = {}
        students = sorted(p for p in target.iterdir() if p.is_dir())
        for s in students:
            errors, notes = grade(s)
            results[s.name] = (errors, notes)

        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        for name, (errors, notes) in results.items():
            status = "PASS" if not errors else f"FAIL ({len(errors)})"
            print(f"  {name:<35} {status}")
    else:
        grade(target)


if __name__ == "__main__":
    main()
