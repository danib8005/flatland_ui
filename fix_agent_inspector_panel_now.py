#!/usr/bin/env python3

from pathlib import Path
import datetime
import re
import shutil
import sys

EXCLUDED = {
    "node_modules",
    ".git",
    "dist",
    "build",
    ".angular",
    ".nx",
    "coverage",
    ".cache",
}

HOST_BLOCK = """:host {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}
"""

OVERLAY_BLOCK = """.agent-overlay {
  position: static;
  left: auto;
  right: auto;
  top: auto;
  bottom: auto;
  z-index: auto;

  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin: 0;
  box-sizing: border-box;

  background: var(--sbb-color-white, #fff);
  border: 1px solid var(--sbb-color-cloud, #d2d2d2);
  border-radius: 4px;
  box-shadow: none;
  padding: 10px 12px;
}
"""

GLOBAL_MARKER_START = "/* AGENT_INSPECTOR_PANEL_FIX_START */"
GLOBAL_MARKER_END = "/* AGENT_INSPECTOR_PANEL_FIX_END */"

GLOBAL_OVERRIDE = f"""
{GLOBAL_MARKER_START}
app-agent-inspector {{
  display: block !important;
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
  flex: 0 0 auto !important;
}}

app-agent-inspector .agent-overlay {{
  position: static !important;
  left: auto !important;
  right: auto !important;
  top: auto !important;
  bottom: auto !important;
  z-index: auto !important;

  display: block !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  margin: 0 !important;
  box-sizing: border-box !important;

  background: var(--sbb-color-white, #fff) !important;
  border: 1px solid var(--sbb-color-cloud, #d2d2d2) !important;
  border-radius: 4px !important;
  box-shadow: none !important;
  padding: 10px 12px !important;
}}

.right-pane > app-agent-inspector,
.right-pane > sbb-expansion-panel[data-panel-type="agent-inspector"] {{
  flex: 0 0 auto !important;
  min-width: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}}

sbb-expansion-panel[data-panel-type="agent-inspector"] {{
  display: block !important;
  width: 100% !important;
}}
{GLOBAL_MARKER_END}
""".strip() + "\n"


def excluded(path: Path) -> bool:
    return any(part in EXCLUDED for part in path.parts)


def backup(path: Path) -> Path:
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    bak = path.with_name(path.name + f".bak_{stamp}")
    shutil.copy2(path, bak)
    return bak


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def find_matching_brace(text: str, open_idx: int) -> int:
    depth = 0
    for i in range(open_idx, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return i
    return -1


def replace_css_rule(text: str, selector: str, replacement: str) -> tuple[str, bool]:
    pat = re.compile(rf"(^|\n)([ \t]*){re.escape(selector)}\s*\{{", re.MULTILINE)
    m = pat.search(text)

    if not m:
        return text.rstrip() + "\n\n" + replacement.strip() + "\n", True

    start = m.start()
    if text[start] == "\n":
        start += 1

    open_idx = text.find("{", m.start())
    close_idx = find_matching_brace(text, open_idx)
    if close_idx < 0:
        raise RuntimeError(f"Could not parse CSS rule for {selector}")

    new_text = text[:start] + replacement.strip() + text[close_idx + 1:]
    return new_text, new_text != text


def patch_agent_css(root: Path) -> int:
    files = []
    for pattern in [
        "**/agent-inspector.component.css",
        "**/agent-inspector.component.scss",
        "**/agent-inspector.component.sass",
    ]:
        files.extend([p for p in root.glob(pattern) if not excluded(p)])

    changed = 0

    if not files:
        print("[WARN] Keine agent-inspector.component.css/scss/sass gefunden.")
        return 0

    for path in sorted(set(files)):
        original = read(path)
        text = original

        text, _ = replace_css_rule(text, ":host", HOST_BLOCK)
        text, _ = replace_css_rule(text, ".agent-overlay", OVERLAY_BLOCK)

        if text != original:
            bak = backup(path)
            write(path, text)
            changed += 1
            print(f"[UPDATED] Komponenten-CSS: {path}")
            print(f"          Backup: {bak}")
        else:
            print(f"[OK] Komponenten-CSS bereits passend: {path}")

    return changed


def find_styles_file(root: Path) -> Path | None:
    candidates = [
        root / "src" / "styles.css",
        root / "src" / "styles.scss",
        root / "styles.css",
        root / "styles.scss",
    ]

    for c in candidates:
        if c.exists():
            return c

    found = [
        p for p in root.glob("**/styles.css")
        if not excluded(p)
    ] + [
        p for p in root.glob("**/styles.scss")
        if not excluded(p)
    ]

    return found[0] if found else None


def patch_global_styles(root: Path) -> int:
    path = find_styles_file(root)
    if not path:
        print("[WARN] Keine styles.css/styles.scss gefunden. Globaler Override übersprungen.")
        return 0

    original = read(path)

    if GLOBAL_MARKER_START in original and GLOBAL_MARKER_END in original:
        pattern = re.compile(
            re.escape(GLOBAL_MARKER_START) + r".*?" + re.escape(GLOBAL_MARKER_END),
            re.DOTALL,
        )
        text = pattern.sub(GLOBAL_OVERRIDE.strip(), original)
    else:
        text = original.rstrip() + "\n\n" + GLOBAL_OVERRIDE

    if text != original:
        bak = backup(path)
        write(path, text)
        print(f"[UPDATED] Globaler CSS-Override: {path}")
        print(f"          Backup: {bak}")
        return 1

    print(f"[OK] Globaler CSS-Override bereits vorhanden: {path}")
    return 0


def is_inside_wrapper(text: str, pos: int) -> bool:
    before = text[:pos]

    # Grobe, aber praktische Heuristik:
    last_panel_open = max(
        before.lower().rfind("<sbb-expansion-panel"),
        before.lower().rfind("<app-panel-shell"),
    )
    last_panel_close = max(
        before.lower().rfind("</sbb-expansion-panel>"),
        before.lower().rfind("</app-panel-shell>"),
    )

    return last_panel_open > last_panel_close


def line_indent(text: str, pos: int) -> str:
    line_start = text.rfind("\n", 0, pos) + 1
    line = text[line_start:pos]
    m = re.match(r"[ \t]*", line)
    return m.group(0) if m else ""


def indent_block(block: str, indent: str) -> str:
    return "\n".join(
        indent + line if line.strip() else line
        for line in block.splitlines()
    )


def wrapper_for(tag: str, indent: str) -> str:
    block = f"""<sbb-expansion-panel
  color="white"
  size="s"
  class="layout-panel-shell layout-panel-shell--expansion"
  data-panel-type="agent-inspector"
  data-panel-zone="right"
  expanded
>
  <sbb-expansion-panel-header slot="header">
    <div class="layout-panel-shell__header">
      <span class="layout-panel-shell__title">Agent Inspector</span>
    </div>
  </sbb-expansion-panel-header>

  <sbb-expansion-panel-content
    class="layout-panel-shell__content"
    slot="content"
  >
    <div class="layout-panel-shell__body layout-panel-shell__body--scroll">
      {tag.strip()}
    </div>
  </sbb-expansion-panel-content>
</sbb-expansion-panel>"""
    return indent_block(block, indent)


def patch_html(root: Path) -> int:
    html_files = [
        p for p in root.glob("**/*.html")
        if not excluded(p) and p.name != "agent-inspector.component.html"
    ]

    tag_re = re.compile(
        r"<app-agent-inspector\b[^>]*(?:/>\s*|>\s*</app-agent-inspector>)",
        re.IGNORECASE | re.DOTALL,
    )

    changed = 0

    for path in sorted(html_files):
        original = read(path)

        if "app-agent-inspector" not in original:
            continue

        replacements = []

        for m in tag_re.finditer(original):
            if is_inside_wrapper(original, m.start()):
                continue

            indent = line_indent(original, m.start())
            wrapped = wrapper_for(m.group(0), indent)
            replacements.append((m.start(), m.end(), wrapped))

        if not replacements:
            print(f"[OK] HTML bereits gewrappt oder keine direkte Stelle: {path}")
            continue

        text = original
        for start, end, repl in reversed(replacements):
            text = text[:start] + repl + text[end:]

        bak = backup(path)
        write(path, text)
        changed += 1

        print(f"[UPDATED] HTML gewrappt: {path}")
        print(f"          Backup: {bak}")

    return changed


def main() -> int:
    root = Path(".").resolve()

    print(f"[INFO] Projekt-Root: {root}")
    print("")

    css_changed = patch_agent_css(root)
    print("")

    global_changed = patch_global_styles(root)
    print("")

    html_changed = patch_html(root)
    print("")

    print("[DONE]")
    print(f"  Komponenten-CSS geändert: {css_changed}")
    print(f"  Global Styles geändert:   {global_changed}")
    print(f"  HTML geändert:            {html_changed}")
    print("")
    print("Wichtig: Danach Vite/Angular Dev Server neu starten:")
    print("  Ctrl+C")
    print("  npm start")
    print("oder")
    print("  ng serve")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
