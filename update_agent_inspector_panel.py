#!/usr/bin/env python3

from pathlib import Path
import argparse
import datetime
import re
import shutil
import sys


EXCLUDED_DIRS = {
    "node_modules",
    "dist",
    "build",
    ".angular",
    ".git",
    "coverage",
    ".nx",
    ".cache",
}


NEW_HOST_BLOCK = """:host {
  display: block;
  width: 100%;
  min-width: 0;
}
"""


NEW_AGENT_OVERLAY_BLOCK = """.agent-overlay {
  position: static;
  width: auto;
  max-width: none;
  margin: 0 0 8px 0;
  box-sizing: border-box;

  background: var(--sbb-color-white, #fff);
  border: 1px solid var(--sbb-color-cloud, #d2d2d2);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 10px 12px;
}
"""


def is_excluded(path: Path) -> bool:
    return any(part in EXCLUDED_DIRS for part in path.parts)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def make_backup(path: Path) -> Path:
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = path.with_name(path.name + f".bak_{timestamp}")
    shutil.copy2(path, backup)
    return backup


def find_matching_brace(content: str, open_brace_index: int) -> int:
    depth = 0
    in_string = False
    string_char = ""
    escaped = False

    for i in range(open_brace_index, len(content)):
        ch = content[i]

        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == string_char:
                in_string = False
            continue

        if ch in ("'", '"'):
            in_string = True
            string_char = ch
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i

    return -1


def replace_css_rule(content: str, selector: str, new_block: str) -> tuple[str, bool]:
    """
    Replaces first top-level CSS rule for a selector.
    More robust than simple regex because it scans braces.
    """
    pattern = re.compile(rf"(^|\n)([ \t]*){re.escape(selector)}\s*\{{", re.MULTILINE)
    match = pattern.search(content)

    if not match:
        appended = content.rstrip() + "\n\n" + new_block.strip() + "\n"
        return appended, True

    rule_start = match.start(0)
    # If match starts with newline, keep newline outside replacement.
    prefix_newline = ""
    if content[rule_start] == "\n":
        prefix_newline = "\n"
        rule_start += 1

    open_brace = content.find("{", match.start(0))
    close_brace = find_matching_brace(content, open_brace)

    if close_brace == -1:
        raise ValueError(f"Could not find closing brace for selector: {selector}")

    old = content[rule_start:close_brace + 1]
    replacement = new_block.strip()

    new_content = content[:rule_start] + replacement + content[close_brace + 1:]
    return new_content, new_content != content


def update_agent_inspector_css(root: Path, dry_run: bool) -> int:
    css_files = [
        p for p in root.rglob("agent-inspector.component.css")
        if not is_excluded(p)
    ]

    if not css_files:
        print("[WARN] Keine agent-inspector.component.css gefunden.")
        return 0

    changed_count = 0

    for css_file in sorted(css_files):
        original = read_text(css_file)
        content = original

        content, _ = replace_css_rule(content, ":host", NEW_HOST_BLOCK)
        content, _ = replace_css_rule(content, ".agent-overlay", NEW_AGENT_OVERLAY_BLOCK)

        if content == original:
            print(f"[OK] CSS unverändert: {css_file}")
            continue

        changed_count += 1

        if dry_run:
            print(f"[DRY-RUN] CSS würde geändert: {css_file}")
        else:
            backup = make_backup(css_file)
            write_text(css_file, content)
            print(f"[UPDATED] CSS geändert: {css_file}")
            print(f"          Backup: {backup}")

    return changed_count


def inside_open_tag(content: str, pos: int, tag_name: str) -> bool:
    """
    Textual heuristic:
    Checks whether pos appears inside an unclosed parent tag such as sbb-expansion-panel.
    """
    open_pat = re.compile(rf"<{re.escape(tag_name)}\b[^>]*>", re.IGNORECASE)
    close_pat = re.compile(rf"</{re.escape(tag_name)}>", re.IGNORECASE)

    last_open = None
    for m in open_pat.finditer(content, 0, pos):
        last_open = m

    if not last_open:
        return False

    last_close = None
    for m in close_pat.finditer(content, 0, pos):
        last_close = m

    return last_close is None or last_close.end() < last_open.start()


def already_wrapped(content: str, pos: int) -> bool:
    return (
        inside_open_tag(content, pos, "sbb-expansion-panel")
        or inside_open_tag(content, pos, "app-panel-shell")
    )


def detect_indent(content: str, start: int) -> str:
    line_start = content.rfind("\n", 0, start) + 1
    line = content[line_start:start]
    m = re.match(r"[ \t]*", line)
    return m.group(0) if m else ""


def indent_block(block: str, indent: str) -> str:
    lines = block.splitlines()
    return "\n".join(indent + line if line.strip() else line for line in lines)


def build_panel_wrapper(original_tag: str, title: str, indent: str) -> str:
    inner = "  "

    wrapper = f"""<sbb-expansion-panel
  color="white"
  size="s"
  class="layout-panel-shell layout-panel-shell--expansion"
  data-panel-type="agent-inspector"
  data-panel-zone="right"
  expanded
>
  <sbb-expansion-panel-header slot="header">
    <div class="layout-panel-shell__header">
      <span class="layout-panel-shell__title">{title}</span>
    </div>
  </sbb-expansion-panel-header>

  <sbb-expansion-panel-content
    class="layout-panel-shell__content"
    slot="content"
  >
    <div class="layout-panel-shell__body layout-panel-shell__body--scroll">
      {original_tag.strip()}
    </div>
  </sbb-expansion-panel-content>
</sbb-expansion-panel>"""

    return indent_block(wrapper, indent)


def update_html_wrapping(root: Path, dry_run: bool, title: str) -> int:
    html_files = [
        p for p in root.rglob("*.html")
        if not is_excluded(p)
    ]

    tag_pattern = re.compile(
        r"<app-agent-inspector\b[^>]*(?:/>\s*|>\s*</app-agent-inspector>)",
        re.IGNORECASE | re.DOTALL,
    )

    changed_count = 0

    for html_file in sorted(html_files):
        # Do not wrap inside the component's own template if ever present.
        if html_file.name == "agent-inspector.component.html":
            continue

        original = read_text(html_file)

        if "app-agent-inspector" not in original:
            continue

        replacements = []
        changed = False

        for match in tag_pattern.finditer(original):
            start = match.start()
            original_tag = match.group(0)

            if already_wrapped(original, start):
                continue

            indent = detect_indent(original, start)
            wrapper = build_panel_wrapper(original_tag, title, indent)
            replacements.append((match.start(), match.end(), wrapper))
            changed = True

        if not changed:
            print(f"[OK] HTML bereits gewrappt oder keine Änderung nötig: {html_file}")
            continue

        content = original
        for start, end, replacement in reversed(replacements):
            content = content[:start] + replacement + content[end:]

        changed_count += 1

        if dry_run:
            print(f"[DRY-RUN] HTML würde geändert: {html_file}")
        else:
            backup = make_backup(html_file)
            write_text(html_file, content)
            print(f"[UPDATED] HTML geändert: {html_file}")
            print(f"          Backup: {backup}")

    return changed_count


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fix und Umbau für app-agent-inspector als sichtbares SBB Panel."
    )

    parser.add_argument(
        "--root",
        default=".",
        help="Projekt-Root. Default: aktuelles Verzeichnis.",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Nur anzeigen, was geändert würde. Keine Dateien schreiben.",
    )

    parser.add_argument(
        "--no-wrap",
        action="store_true",
        help="Nur CSS fixen, HTML nicht in sbb-expansion-panel umbauen.",
    )

    parser.add_argument(
        "--title",
        default="Agent Inspector",
        help="Panel-Titel. Default: Agent Inspector.",
    )

    args = parser.parse_args()
    root = Path(args.root).resolve()

    if not root.exists():
        print(f"[ERROR] Root existiert nicht: {root}", file=sys.stderr)
        return 1

    print(f"[INFO] Root: {root}")
    print(f"[INFO] Dry run: {args.dry_run}")
    print("")

    css_changed = update_agent_inspector_css(root, args.dry_run)

    print("")

    html_changed = 0
    if args.no_wrap:
        print("[INFO] HTML-Umbau übersprungen wegen --no-wrap")
    else:
        html_changed = update_html_wrapping(root, args.dry_run, args.title)

    print("")
    print("[DONE]")
    print(f"  CSS-Dateien geändert/geplant:  {css_changed}")
    print(f"  HTML-Dateien geändert/geplant: {html_changed}")

    if args.dry_run:
        print("")
        print("Dry-run war aktiv. Es wurden keine Dateien geschrieben.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
