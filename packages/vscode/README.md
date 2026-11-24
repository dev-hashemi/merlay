# Merlay — Visual Editor for Mermaid

**Mermaid, your way.** Edit diagrams visually instead of hand-writing syntax:
click to sprout nodes, drag to connect them, double-click to rename — the
clean Mermaid code writes itself.

![Merlay visual editor](https://raw.githubusercontent.com/dev-hashemi/merlay/main/assets/demo-merlay.webp)

## Features

- **Visual editing for `.mmd` / `.mermaid` files** — open any Mermaid file and
  it opens in the visual editor: sprout nodes, drag-to-connect, inline rename,
  marquee select, duplicate, undo/redo.
- **Markdown fences** — a ✨ Edit visually lens above every ` ```mermaid `
  block opens the visual editor for that block; edits write straight back
  into the fence.
- **Diagram themes** — Auto plus Default, Dark, Forest, Neutral and Base presets,
  stored as Mermaid frontmatter.
- **Syntax drawer** — a slide-out panel shows the live Mermaid source for
  reading or hand-editing; it stays in sync both ways.
- **Export** — copy PNG or SVG, download SVG, or download PNG at 1×, 2× or 3×
  resolution, with an optional background, all from the toolbar.
- **Clean output, no lock-in** — edits serialize to 100% standard Mermaid.
  No metadata, no proprietary format. The code is always the source of truth:
  typing, VS Code undo, and formatters sync live into the open editor.

## Supported diagrams

Merlay provides visual editing for five Mermaid diagram types:

- **Flowcharts** (`flowchart`, `graph`)
- **State diagrams** (`stateDiagram-v2`)
- **Sequence diagrams** (`sequenceDiagram`)
- **Mindmaps** (`mindmap`)
- **Class diagrams** (`classDiagram`)

Other diagram types supported by the bundled Mermaid renderer open in view-only mode with pan and zoom.

## Usage

| I want to… | How |
|---|---|
| Edit a `.mmd` / `.mermaid` file | Just open it (or _Open With…_ → _Merlay Visual Editor_) |
| Edit a fence inside markdown | Click **✨ Edit visually** above the block |
| Edit a fence in the Markdown preview | Hover a diagram → **✨ Edit visually** (allow the one-time URI prompt) |
| Start a new diagram | Command palette → _Merlay: New Diagram_ |
| Undo / redo | Toolbar buttons or `Ctrl+Z` / `Ctrl+Shift+Z` (`Cmd` on macOS) |
| Pan / zoom | Hand tool (`H`) + drag, or hold `Space` and drag; `Ctrl` / `Cmd` + scroll to zoom |

## Extension Settings

- `merlay.defaultDirection` — flow direction for new diagrams (`LR` by default).

## Feedback & Source

- Known syntax limitations and workarounds: [Known issues](https://github.com/dev-hashemi/merlay/blob/main/docs/KNOWN_ISSUES.md).
- Issues and ideas: [GitHub issues](https://github.com/dev-hashemi/merlay/issues)
- Source: [github.com/dev-hashemi/merlay](https://github.com/dev-hashemi/merlay)
- Also available as an [Obsidian plugin](https://github.com/dev-hashemi/merlay),
  powered by the same portable core.

⭐ Enjoying Merlay? Please [star it on GitHub](https://github.com/dev-hashemi/merlay) —
it takes a second and helps others discover the project.
