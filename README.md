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

**Merlay** lets you create and edit Mermaid diagrams visually directly inside your Obsidian notes. Build **Flowcharts**, **State Diagrams**, **Sequence Diagrams**, and **Mindmaps** with single-click relational sprouting, drag-and-drop connections, and inline renaming — without writing code or fighting diagram syntax.

Everything you create is saved as **100% standard, clean Mermaid syntax** right inside your note. No proprietary lock-in, no layout drift, and fully compatible with Obsidian mobile, GitHub, and AI assistants.

<p align="center">
  <img src="assets/demo-merlay.webp" alt="Merlay Demo — visual diagram editing in Obsidian" width="760">
</p>

<p align="center"><em>Select → Sprout → Connect → Edit — all visual, all native Mermaid.</em></p>

---

## 📊 Supported Diagrams

Merlay provides interactive visual editing for 4 major Mermaid diagram types:

- **Flowcharts** (`flowchart`, `graph`)
- **State Diagrams** (`stateDiagram-v2`)
- **Sequence Diagrams** (`sequenceDiagram`)
- **Mindmaps** (`mindmap`)

*All other diagram types open in a high-performance view mode with smooth pan and zoom.*

---

## ✨ Features

- 🎯 **Visual-First Editing:** Click to select, sprout connected elements in one click, drag handles to connect, and double-click to edit text inline.
- 🎨 **Universal Themes:** Switch between Default, Dark, Neutral, Forest, and Base themes across all diagrams using standard Mermaid frontmatter.
- 🔄 **Two-Way Sync:** Changes reflect instantly in your note, with a slide-out drawer to view and tweak Mermaid source code live.
- ⚡ **Native Obsidian Flow:** Hover over any Mermaid block in Reading View or Live Preview and click **Visual Mode**, or insert templates via slash commands (`/flowchart`, `/state`, etc.).
- 📂 **Standalone Files:** Create and edit `.mmd` and `.mermaid` diagram files directly from the file explorer.
- 🔒 **Zero Lock-In:** Generates clean, human-readable Mermaid code with no custom comments or hidden layout data.

---

## ⚡ Quick Start

1. **Open:** Hover over any Mermaid block in your note and click **Visual Mode** (or type `/flowchart`, `/state`, `/sequence`, or `/mindmap`).
2. **Edit:** Sprout new items, drag connections, double-click to rename, or delete elements.
3. **Save:** Close the overlay — your note is updated automatically in real time.

---

## ⌨️ Controls

| Action | Shortcut / Gesture |
| :--- | :--- |
| **Select** | `Click` element |
| **Sprout Child** | Click `+` handle on selected element |
| **Connect** | `Drag` from handle to target element |
| **Edit Text** | `Double-Click` element or connection label |
| **Delete** | `Delete` or `Backspace` |
| **Pan** | `Click + Drag` canvas background (or hold `Space`) |
| **Zoom** | `Mouse Wheel` or pinch trackpad |
| **Toggle Syntax Drawer** | Click **`<> Syntax`** button |

---

## 💡 Why Merlay? (Structural, Not Spatial)

Mermaid is a declarative, code-first diagramming language that computes its own layout. Traditional visual editors often attempt to impose arbitrary spatial coordinates onto diagrams, leading to broken round-trips, syntax corruption, and layout drift.

**Merlay takes a structural approach:**
- **1:1 Native Parity:** Controls are overlaid directly on Obsidian's exact Mermaid SVG rendering — what you see is what you get.
- **Topological Operations:** You edit structure and relationships (elements and connections), while Mermaid computes clean, natural layouts automatically.
- **Ultra-Lean Footprint:** Zero heavy canvas framework dependencies. Bundled at just ~170 KB.

---

## 🚀 Installation

### Via BRAT (Beta)
1. Install [Obsidian BRAT](https://github.com/TfTHacker/obsidian42-brat).
2. In BRAT settings, click **Add Beta plugin** and enter:  
   `https://github.com/dev-hashemi/merlay`

### Manual
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/dev-hashemi/merlay/releases).
2. Place them in your vault under `.obsidian/plugins/merlay/`.
3. Enable **Merlay** in **Settings → Community plugins**.

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

## 📄 License

MIT License © 2026 Seyed Ali Hashemi

