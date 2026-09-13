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

**Merlay** lets you create and edit Mermaid diagrams visually directly inside your Obsidian notes. Build flowcharts with single-click node sprouting, drag-and-drop connections, and inline renaming — without writing code or fighting diagram syntax.

Everything you create is saved as **100% standard, clean Mermaid syntax** right inside your note. No proprietary lock-in, no layout drift, and fully compatible with Obsidian mobile, GitHub, and AI assistants.

<p align="center">
  <img src="assets/demo-merlay.webp" alt="Merlay Demo — visual flowchart editing in Obsidian" width="760">
</p>

<p align="center"><em>Select → Sprout → Connect → Edit — all visual, all native Mermaid.</em></p>

---

## ⚡ Quick Start (In 10 Seconds)

1. **Open Visual Mode:**
   - **Hover** over any ````mermaid```` code block in your note (Reading View or Live Preview) and click the **"Visual Mode"** button next to *Edit this block*.
   - Or simply type `/flowchart` or `/Insert Mermaid Diagram` anywhere in your note.
2. **Edit Visually:**
   - **Click a node** to select it and click **`+ Next Step`** to sprout a connected child node.
   - **Double-click** any node to edit its label inline.
   - **Drag** from a node's handle to connect it to another node.
   - **Click an edge** to edit its condition label or delete it.
3. **Save Automatically:**
   - Close the editor when you're done — your note's Mermaid block is updated automatically in real time.

---

## ✨ Features

- 🎯 **Native Obsidian Integration:**
  - Appears seamlessly on hover alongside Obsidian's native block controls in both Reading View and Live Preview.
  - Matches your active Obsidian theme (dark and light mode).
  - Opens in a clean, focused visual overlay modal.
- ⚡ **Relational Sprouting (`+ Next Step`):**
  - Select any node to reveal the directional sprout button (oriented to your diagram flow: `LR` or `TD`). Spawns a downstream connected step in one click.
- 🔗 **Drag-to-Connect Handles:**
  - Hover any node to grab an anchor handle; drag and release onto any other step to create a new connection.
- ✏️ **Inline Label Editing:**
  - Double-click any node to rename it directly on the canvas.
  - Click any arrow to open the floating Edge HUD for editing edge labels or removing connections.
- 💻 **Live Syntax Drawer:**
  - Slide out the live syntax panel at any time to inspect, edit, or copy the underlying Mermaid source code.
- 📂 **Standalone File Editor:**
  - Create and edit standalone `.mmd` and `.mermaid` diagram files directly from Obsidian's File Explorer.
- 🤖 **Zero Lock-In & AI-Friendly:**
  - Generates pristine, human-readable Mermaid syntax without comment hacks (`%% mv: ... %%`). Fully compatible with LLMs, git diffs, and other Markdown tools.

---

## 🎯 How to Use

### 1. In Your Notes
- **Slash Commands (`/`):** Type `/flowchart` or `/state` to insert a diagram template and immediately launch Visual Mode.
- **Hover Button:** Hover over any Mermaid diagram in your note and click **"Visual Mode"**.
- **Right-Click Menu:** Right-click anywhere in your note editor → **Insert Mermaid Diagram**, or right-click inside an existing Mermaid code block → **Edit Diagram in Visual Mode**.

### 2. Standalone `.mmd` Files
- **File Explorer:** Right-click any folder in the Obsidian File Explorer → **New Mermaid Diagram**.
- **Ribbon Icon:** Click the **Merlay** icon in the left ribbon sidebar.
- **Command Palette (`Ctrl/Cmd + P`):** Run `Merlay: Create New Mermaid Diagram (File)`.

---

## ⌨️ Interaction Cheat Sheet

| Action | Shortcut / Gesture |
| :--- | :--- |
| **Select Node** | `Click` node |
| **Sprout Child Step** | Click **`+ Next Step`** on selected node |
| **Connect Nodes** | `Drag` from node handle onto target node |
| **Edit Node Label** | `Double-Click` node |
| **Edit Edge Label** | `Click` edge arrow |
| **Delete Node / Edge** | Select node/edge and press `Delete` or `Backspace` |
| **Pan Canvas** | `Click + Drag` canvas background |
| **Zoom** | `Mouse Wheel` or trackpad pinch |
| **Toggle Syntax Drawer** | Click **`<> Syntax`** button in top bar |

---

## 💡 Why Merlay? (Structural, Not Spatial)

Mermaid is a declarative, code-first diagramming language that computes its own layout. Traditional visual diagramming tools often attempt to impose arbitrary spatial coordinates (like React Flow or Excalidraw), leading to broken round-trips, messy syntax, and layout drift.

**Merlay takes a different approach:**
- **1:1 Native Parity:** Controls are overlaid directly on Obsidian's exact Mermaid SVG rendering — what you see is what you get.
- **Topological Operations:** You manipulate relationships (nodes and connections), and Mermaid handles clean layout automatically.
- **Ultra-Lean Footprint:** Zero heavy canvas framework dependencies. Bundled at just ~170 KB.

---

## 🚀 Installation

### Via BRAT (Beta Testing)
1. Install the [Obsidian BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.
2. Open BRAT settings → click **"Add Beta plugin"**.
3. Enter: `https://github.com/dev-hashemi/merlay`
4. Click **"Add Plugin"**.

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [GitHub Release](https://github.com/dev-hashemi/merlay/releases).
2. Copy them into your vault folder under `.obsidian/plugins/merlay/`.
3. In Obsidian, open **Settings → Community plugins** and toggle on **Merlay**.

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build production bundle
npm run build

# Run unit tests
npm test
```

### Architecture & Contributing
- [Architecture Guide](ARCHITECTURE.md): Design philosophy, module map, and engineering rules.
- [Adding a New Diagram Type](docs/ADDING_NEW_DIAGRAM.md): 5-phase procedure for extending diagram driver support.

---

## 📄 License

MIT License © 2026 Seyed Ali Hashemi

