# Feature Proposals & Community Backlog

This document tracks feature proposals, community-submitted ideas, and design explorations for **Merlay**.

Confirmed bugs, reported problems, and workarounds are tracked separately in [Known issues](KNOWN_ISSUES.md). Proposals here are not release commitments or delivery dates.

Every proposal is evaluated against Merlay's core architectural tenets (see [ARCHITECTURE.md](../ARCHITECTURE.md) and [AGENTS.md](../AGENTS.md)):
- **100% standard Mermaid**: No synthetic metadata or coordinate lock-in.
- **Pure AST mutations**: All visual operations map to clean, deterministic Mermaid text transformations.
- **Native Obsidian / VS Code experience**: Fast, minimal, and non-intrusive.

---

## Status Legend

- 💡 **Exploration / Under Consideration**: Community idea or proposed concept being evaluated for feasibility and UX fit.
- 📋 **Accepted / Backlog**: Validated design ready for implementation when prioritized.
- 🏗️ **In Development**: Actively being built.
- ✅ **Shipped**: Implemented and released.

---

## Active Proposals

### 1. Visual Node Reordering (Handle / Grabber)

- **Status:** 💡 Exploration / Under Consideration
- **Origin / Credit:** Proposed by [@DuendeInexistente](https://github.com/DuendeInexistente) in [#14](https://github.com/dev-hashemi/merlay/issues/14)
- **Applies to:** Flowchart, State, and other graph-based diagrams

#### Problem Statement
The host renderer computes layout automatically. Node declarations and connection order can influence sibling placement, but do not guarantee exact positions. Obsidian 1.15 uses Pele, while VS Code and earlier Obsidian versions use Mermaid.

Currently, if grouping nodes or adding edges causes Mermaid to position nodes in an undesired order, users have no visual way to reorder them on the canvas. To change their relative order, users have to open the raw code editor and manually reorder the Mermaid text lines.

The reported grouping behavior is tracked in [Known issues](KNOWN_ISSUES.md#grouping-can-change-node-order); its investigation is separate from adding reorder controls.

#### Proposed UX
Provide a visual affordance to reorder sibling nodes directly on the canvas:
1. **Reorder Handles / Grabbers**: A drag handle on selected nodes (or inside groups) that allows dragging a node across a sibling to swap their order.
2. **HUD / Action Controls**: Alternatively or in addition, a quick action in the Node Action HUD (e.g., *Move Left / Move Right* or *Shift Order*) for precision and mobile/touch ergonomics.

#### Technical Considerations
- **No Coordinate Storage**: Merlay never stores layout coordinates. Reordering must translate into reordering node declarations and/or edge sequences in the AST (`ast.nodes`, `subDef.nodeIds`, `ast.edges`).
- **Renderer Behavior**: Verify how declaration and edge order affect both Mermaid and Pele. Preserve predictable source ordering without promising identical placement across renderers.
- **Purity & Testing**: Implement as a pure AST mutation (e.g., `reorderGroupNodes(ast, groupId, fromIndex, toIndex)`) with round-trip test coverage.

---
