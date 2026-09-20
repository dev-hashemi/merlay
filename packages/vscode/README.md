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
- **Flowchart, state, sequence & class diagrams** — each type gets its own
  tailored toolbar (states, participants and messages, members and methods).
- **Diagram themes** — Auto plus Default, Dark, Forest and Neutral presets,
  stored as a directive in the code.
- **Syntax drawer** — a slide-out panel shows the live Mermaid source for
  reading or hand-editing; it stays in sync both ways.
- **Export** — copy the diagram as PNG or SVG, or download a high-resolution
  PNG, all from the toolbar.
- **Clean output, no lock-in** — edits serialize to 100% standard Mermaid.
  No metadata, no proprietary format. The code is always the source of truth:
  typing, VS Code undo, and formatters sync live into the open editor.

## Usage

| I want to… | How |
|---|---|
| Edit a `.mmd` / `.mermaid` file | Just open it (or _Open With…_ → _Merlay Visual Editor_) |
| Edit a fence inside markdown | Click **✨ Edit visually** above the block |
| Start a new diagram | Command palette → _Merlay: New Diagram_ |
| Undo / redo | Toolbar buttons or `Ctrl+Z` / `Ctrl+Shift+Z` (`Cmd` on macOS) |
| Pan / zoom | Drag empty canvas or hold `Space`; `Ctrl` + scroll to zoom, double-click background to fit |

## Extension Settings

- `merlay.defaultDirection` — flow direction for new diagrams (`LR` by default).

## Feedback & Source

- Issues and ideas: [GitHub issues](https://github.com/dev-hashemi/merlay/issues)
- Source: [github.com/dev-hashemi/merlay](https://github.com/dev-hashemi/merlay)
- Also available as an [Obsidian plugin](https://github.com/dev-hashemi/merlay),
  powered by the same portable core.
