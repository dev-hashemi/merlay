# Feature Proposals & Community Backlog

This document tracks feature proposals, community-submitted ideas, and design explorations for **Merlay**.

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
Mermaid delegates layout to automatic layout engines (such as Dagre). The relative placement of sibling nodes (e.g. left-to-right or top-to-bottom order within the same rank or subgraph) is largely determined by the declaration sequence of nodes and connection lines in the Mermaid text.

Currently, if grouping nodes or adding edges causes Mermaid to position nodes in an undesired order, users have no visual way to reorder them on the canvas. To change their relative order, users have to open the raw code editor and manually reorder the Mermaid text lines.

#### Proposed UX
Provide a visual affordance to reorder sibling nodes directly on the canvas:
1. **Reorder Handles / Grabbers**: A drag handle on selected nodes (or inside groups) that allows dragging a node across a sibling to swap their order.
2. **HUD / Action Controls**: Alternatively or in addition, a quick action in the Node Action HUD (e.g., *Move Left / Move Right* or *Shift Order*) for precision and mobile/touch ergonomics.

#### Technical Considerations
- **No Coordinate Storage**: Merlay never stores layout coordinates. Reordering must translate into reordering node declarations and/or edge sequences in the AST (`ast.nodes`, `subDef.nodeIds`, `ast.edges`).
- **Deterministic Dagre Behavior**: Investigate how Dagre ranks sibling nodes when declaration order vs edge order differ, ensuring the serializer outputs lines in a predictable order that matches the user's intended layout.
- **Purity & Testing**: Implement as a pure AST mutation (e.g., `reorderGroupNodes(ast, groupId, fromIndex, toIndex)`) with round-trip test coverage.

---
