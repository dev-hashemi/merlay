# Merlay for VS Code

Visual overlay editor for Mermaid diagrams. Mermaid, your way.

## Features

- **Visual editing for `.mmd` / `.mermaid` files** — open any Mermaid file to edit it
  visually: sprout nodes, drag-to-connect, inline rename, undo/redo, themes, export.
- **Markdown fences** — a `✨ Edit visually` lens above every ` ```mermaid ` block
  opens the visual editor; edits write straight back into the fence.
- **Clean output** — edits serialize to 100% standard Mermaid. No lock-in, no metadata.

## Usage

| Action | How |
|---|---|
| Edit a `.mmd` file | Just open it (or _Open With…_ → _Merlay Visual Editor_) |
| Edit a fence in markdown | Click _✨ Edit visually_ above the block |
| New diagram | Command palette → _Merlay: New Diagram_ |

## Settings

- `merlay.defaultDirection` — flow direction for new diagrams (`LR` by default).

## Notes

- Source of truth is always the Mermaid code. External edits (typing, undo,
  formatters) sync live into the open visual editor.
- Part of the [Merlay monorepo](https://github.com/dev-hashemi/merlay) —
  the same portable core also powers the Obsidian plugin.
