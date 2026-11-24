<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/dev-hashemi/merlay/main/assets/merlay-logo-plus-title-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/dev-hashemi/merlay/main/assets/merlay-logo-plus-title.svg">
    <img alt="Merlay Logo" src="https://raw.githubusercontent.com/dev-hashemi/merlay/main/assets/merlay-logo-plus-title.svg" width="460">
  </picture>
</p>

# Merlay

> **Mermaid, your way.**  
> A visual overlay editor for [Mermaid](https://mermaid.js.org/) diagrams in [Obsidian](https://obsidian.md).

[![GitHub release](https://img.shields.io/github/v/release/dev-hashemi/merlay?label=version&logo=github)](https://github.com/dev-hashemi/merlay/releases)
[![Obsidian](https://img.shields.io/badge/Obsidian-Community%20Plugin-7C3AED?logo=obsidian&logoColor=white)](https://community.obsidian.md/plugins/merlay)
[![VS Code Marketplace](https://img.shields.io/badge/VS_Code_Marketplace-007ACC?logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=dev-hashemi.merlay)
[![Open VSX](https://img.shields.io/open-vsx/v/dev-hashemi/merlay?label=Open%20VSX)](https://open-vsx.org/extension/dev-hashemi/merlay)
[![License: MIT](https://img.shields.io/github/license/dev-hashemi/merlay)](https://github.com/dev-hashemi/merlay/blob/main/LICENSE)
[![CI](https://github.com/dev-hashemi/merlay/actions/workflows/ci.yml/badge.svg)](https://github.com/dev-hashemi/merlay/actions/workflows/ci.yml)

**Merlay** lets you create and edit Mermaid diagrams visually directly inside your Obsidian notes. Build **Flowcharts**, **State Diagrams**, **Sequence Diagrams**, **Mindmaps**, and **Class Diagrams** with single-click relational sprouting, drag-and-drop connections, and inline renaming.

Edits are saved as **standard Mermaid text** right inside your note, with no proprietary layout metadata. Your source stays portable across editors and tools that support Mermaid. For syntax limitations and the current testing scope, see [Known issues](docs/KNOWN_ISSUES.md).

**Merlay is also available for VS Code** and its forks (Devin, Cursor, VSCodium) on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=dev-hashemi.merlay) and [Open VSX](https://open-vsx.org/extension/dev-hashemi/merlay) — same visual editor, same core.

<p align="center">
  <img src="assets/demo-merlay.webp" alt="Merlay Demo — visual diagram editing in Obsidian" width="760">
</p>

<p align="center"><em>Select → Sprout → Connect → Edit — all visual, all native Mermaid.</em></p>

---

## 📊 Supported Diagrams

Merlay provides interactive visual editing for five Mermaid diagram types in both Obsidian and VS Code:

- **Flowcharts** (`flowchart`, `graph`)
- **State Diagrams** (`stateDiagram-v2`)
- **Sequence Diagrams** (`sequenceDiagram`)
- **Mindmaps** (`mindmap`)
- **Class Diagrams** (`classDiagram`)

*Other diagram types open in view-only mode with pan and zoom when supported by the host renderer.* Support for a diagram type does not mean every Mermaid syntax feature is visually editable; see [Known issues](docs/KNOWN_ISSUES.md).

---

## ✨ Features

- 🎯 **Visual-First Editing:** Click to select, sprout connected elements in one click, drag handles to connect, and double-click to edit text inline.
- 🎨 **Diagram Themes:** Choose Auto, Default, Dark, Neutral, Forest, or Base using standard Mermaid frontmatter. Appearance depends on the host renderer.
- 🔄 **Two-Way Sync:** Changes reflect instantly in your note, with a slide-out drawer to view and tweak Mermaid source code live.
- ⚡ **Native Obsidian Flow:** Hover over any Mermaid block in Reading View or Live Preview and click **Visual Mode**, or insert templates via slash commands (`/flowchart`, `/state`, etc.).
- 📂 **Standalone Files:** Create and edit `.mmd` and `.mermaid` diagram files directly from the file explorer.
- 🖼️ **Export:** Use **Export** in the toolbar to copy PNG or SVG, download SVG, or download PNG at 1×, 2×, or 3× resolution. Choose whether to include a background.
- 🔒 **Zero Lock-In:** Generates clean, human-readable Mermaid code with no custom comments or hidden layout data.

---

## ⚡ Quick Start

1. **Open:** Hover over any Mermaid block in your note and click **Visual Mode** (or type `/flowchart`, `/state`, `/sequence`, `/mindmap`, or `/class`).
2. **Edit:** Sprout new items, drag connections, double-click to rename, or delete elements.
3. **Save:** Visual edits save automatically after Merlay checks that the updated diagram renders. If an edit fails that check, Merlay keeps the original source and shows a notice.

---

## ⌨️ Controls

| Action | Shortcut / Gesture |
| :--- | :--- |
| **Select** | `Click` element |
| **Sprout Child** | Click `+` handle on selected element |
| **Connect** | `Drag` from handle to target element |
| **Edit Text** | `Double-Click` element or connection label |
| **Delete** | `Delete` or `Backspace` |
| **Pan** | Hand tool (`H`) + drag, or hold `Space` and drag |
| **Zoom** | `Ctrl` / `Cmd` + mouse wheel, or pinch |
| **Undo / Redo** | `Ctrl` / `Cmd` + `Z` / `Shift+Z` |
| **Toggle Syntax Drawer** | Click **`<> Syntax`** button |

---

## 💡 Why Merlay? (Structural, Not Spatial)

Mermaid is a declarative, code-first diagramming language that computes its own layout. Traditional visual editors often attempt to impose arbitrary spatial coordinates onto diagrams, leading to broken round-trips, syntax corruption, and layout drift.

**Merlay takes a structural approach:**
- **1:1 Native Parity:** Controls are overlaid directly on Obsidian's exact Mermaid SVG rendering — what you see is what you get.
- **Topological Operations:** You edit structure and relationships (elements and connections), while Mermaid computes clean, natural layouts automatically.
- **Lean Canvas:** SVG overlays provide the editing controls without an additional canvas framework.

Obsidian supplies its native renderer: Pele in Obsidian 1.15, and Mermaid in earlier versions. VS Code uses the bundled Mermaid library. Layout and available syntax can differ between hosts. See [compatibility checks and verification gaps](docs/KNOWN_ISSUES.md#compatibility-checks-and-verification-gaps) for the current source's testing scope and release availability.

---

## 🚀 Installation

### Obsidian
Install directly inside Obsidian:
1. Open **Settings → Community plugins** (ensure Restricted mode is turned off).
2. Click **Browse** and search for **Merlay**.
3. Click **Install**, then **Enable**.

*(Or view on the [Obsidian Community Directory](https://community.obsidian.md/plugins/merlay)).*

### VS Code & Forks (Cursor, Devin, VSCodium)
Install directly from:
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=dev-hashemi.merlay)
- [Open VSX Registry](https://open-vsx.org/extension/dev-hashemi/merlay)

*(Or search **Merlay** in your editor's Extensions view).*

---

## 🛠️ Development

```bash
npm install     # Install dependencies
npm test        # Run tests
npm run build   # Build production bundles
```

### Testing in the real apps

```bash
cp .env.example .env   # once: point MERLAY_VAULT_DIR at your vault
npm run install:obsidian   # build + install into your Obsidian vault (then Ctrl+R)
npm run install:vscode     # build + package + install into VS Code (then reload window)
```

For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Support

Check [Known issues and workarounds](docs/KNOWN_ISSUES.md) before reporting a problem. For a new report, include your Merlay version, host app/version, operating system or device, a minimal Mermaid snippet, and the expected and actual behavior in [GitHub issues](https://github.com/dev-hashemi/merlay/issues).

Feature ideas are tracked in [Proposals](docs/PROPOSALS.md).

If Merlay saves you time, consider starring the repo — it helps others discover it.

---

## 📄 License

MIT License © 2026 Seyed Ali Hashemi

